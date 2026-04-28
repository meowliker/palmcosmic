import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config({ path: ".env.local" });
dotenv.config();

const OHMANDA_API_URL = "https://ohmanda.com/api/horoscope";
const NEWASTRO_API_URL = "https://newastro.vercel.app";
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const ZODIAC_SIGNS = [
  "aries",
  "taurus",
  "gemini",
  "cancer",
  "leo",
  "virgo",
  "libra",
  "scorpio",
  "sagittarius",
  "capricorn",
  "aquarius",
  "pisces",
];

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function safeTimezone(value: string | undefined) {
  if (!value) return "America/New_York";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "America/New_York";
  }
}

function getDateKey(timeZone: string, offsetDays = 0) {
  const baseDate = new Date();
  baseDate.setUTCDate(baseDate.getUTCDate() + offsetDays);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(baseDate);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function displaySign(sign: string) {
  return sign.charAt(0).toUpperCase() + sign.slice(1);
}

function stripProviderDatePrefix(text: string) {
  return text
    .replace(
      /^(?:[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}|\d{4}-\d{2}-\d{2})\s*[-–—:]\s*/u,
      ""
    )
    .trim();
}

function normalizeFallbackHoroscope(text: string, day: "today" | "tomorrow") {
  const cleaned = stripProviderDatePrefix(text);
  if (day === "tomorrow") {
    return cleaned
      .replace(/\btoday\b/gi, "tomorrow")
      .replace(/\bthis morning\b/gi, "tomorrow morning")
      .replace(/\bthis evening\b/gi, "tomorrow evening");
  }
  return cleaned;
}

function getCacheId(sign: string, date: string) {
  return `sign_${sign}_${date}`;
}

async function fetchTodayHoroscope(sign: string) {
  const response = await fetch(`${OHMANDA_API_URL}/${sign}/`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Ohmanda failed for ${sign}: ${response.status}`);
  const data = await response.json();
  return normalizeFallbackHoroscope(data.horoscope || "", "today");
}

async function generateDatedHoroscope(sign: string, targetDate: string, day: "today" | "tomorrow") {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 420,
    system: `You write concise daily zodiac horoscopes for a consumer astrology app.

Rules:
- Write in plain, warm English.
- Return only these four markdown sections, with no intro or outro:
  **Overview**
  [1-2 sentences]

  **Love & Relationships**
  [1-2 sentences]

  **Health & Wellness**
  [1-2 sentences]

  **Career & Finance**
  [1-2 sentences]
- Do not include a date prefix.
- Do not mention that this is AI-generated.
- If this is for tomorrow, use "tomorrow" where a day reference is needed.
- If this is for today, use "today" where a day reference is needed.
- Avoid medical, financial, or legal certainty.`,
    messages: [
      {
        role: "user",
        content: `Write ${day}'s horoscope for ${displaySign(sign)} for ${targetDate}.`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  return textContent?.type === "text" ? textContent.text.trim() : null;
}

async function fetchTomorrowHoroscope(sign: string, targetDate: string) {
  const generated = await generateDatedHoroscope(sign, targetDate, "tomorrow");
  if (generated) return generated;

  const response = await fetch(`${NEWASTRO_API_URL}/${sign}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Newastro failed for ${sign}: ${response.status}`);
  const data = await response.json();
  return normalizeFallbackHoroscope(data.horoscope || "", "tomorrow");
}

async function main() {
  const timezone = safeTimezone(process.env.HOROSCOPE_SEED_TIMEZONE);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL");

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const jobs = [
    { day: "today", period: "daily", date: getDateKey(timezone, 0), fetcher: (sign: string, date: string) => fetchTodayHoroscope(sign) },
    { day: "tomorrow", period: "tomorrow", date: getDateKey(timezone, 1), fetcher: fetchTomorrowHoroscope },
  ];

  console.log(`Seeding horoscope_cache for timezone ${timezone}`);

  for (const job of jobs) {
    for (const sign of ZODIAC_SIGNS) {
      const id = getCacheId(sign, job.date);
      const horoscopeText = await job.fetcher(sign, job.date);
      const payload = {
        horoscope_data: horoscopeText,
        sign,
        period: job.period,
        date: job.date,
        timezone,
        source: job.day === "tomorrow" && process.env.ANTHROPIC_API_KEY ? "anthropic" : job.day === "tomorrow" ? "newastro_fallback" : "ohmanda",
      };

      const { error } = await supabase.from("horoscope_cache").upsert(
        {
          id,
          horoscope: payload,
          data: payload,
          sign,
          date: job.date,
          period: job.period,
          cache_key: job.date,
          fetched_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) throw error;
      console.log(`Seeded ${job.day}: ${sign} (${job.date})`);
    }
  }

  console.log("Horoscope cache seed complete.");
}

main().catch((error) => {
  console.error("Horoscope cache seed failed:", error);
  process.exit(1);
});
