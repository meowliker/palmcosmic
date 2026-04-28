import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// Two different APIs for different content
const OHMANDA_API_URL = "https://ohmanda.com/api/horoscope";
const NEWASTRO_API_URL = "https://newastro.vercel.app";

export const dynamic = "force-dynamic";

const ZODIAC_SIGNS = new Set([
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
]);

const DISPLAY_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

function normalizeSign(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ZODIAC_SIGNS.has(normalized) ? normalized : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeSign(record.name || record.sign || record.id);
  }
  return null;
}

function displaySign(sign: string) {
  return DISPLAY_SIGNS.find((item) => item.toLowerCase() === sign) || "Aries";
}

function safeTimezone(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "America/New_York";
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

async function getUserTimezone(userId: string | null) {
  if (!userId) return "America/New_York";
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from("users")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return safeTimezone(data?.timezone);
}

function normalizeCachedHoroscope(row: any): string | null {
  const payload = row?.horoscope || row?.data;
  if (!payload) return null;
  if (typeof payload === "string") return payload;
  return payload.horoscope_data || payload.horoscope || null;
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

function adaptRelativeDayLanguage(text: string, day: "today" | "tomorrow") {
  const target = day === "tomorrow" ? "tomorrow" : "today";
  const replacement = (match: string) => {
    const value = match.toLowerCase() === "tomorrow" || match.toLowerCase() === "today" ? target : match;
    return match[0] === match[0]?.toUpperCase()
      ? value.charAt(0).toUpperCase() + value.slice(1)
      : value;
  };

  return text.replace(/\b(today|tomorrow)\b/gi, replacement);
}

function getCacheId(sign: string, date: string) {
  return `sign_${sign}_${date}`;
}

// Fetch TODAY's horoscope from ohmanda.com
async function fetchTodayHoroscope(sign: string): Promise<string> {
  const response = await fetch(`${OHMANDA_API_URL}/${sign.toLowerCase()}/`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Ohmanda API request failed: ${response.status}`);
  }

  const data = await response.json();
  return normalizeFallbackHoroscope(data.horoscope || "", "today");
}

async function generateDatedHoroscope(sign: string, targetDate: string, day: "today" | "tomorrow"): Promise<string | null> {
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

// Fallback only. Newastro currently returns current-day text with an unreliable embedded date.
async function fetchTomorrowHoroscope(sign: string, targetDate: string): Promise<string> {
  const generated = await generateDatedHoroscope(sign, targetDate, "tomorrow");
  if (generated) return generated;

  const response = await fetch(`${NEWASTRO_API_URL}/${sign.toLowerCase()}`, {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Newastro API request failed: ${response.status}`);
  }

  const data = await response.json();
  return normalizeFallbackHoroscope(data.horoscope || "", "tomorrow");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sign = normalizeSign(searchParams.get("sign"));
  const day = searchParams.get("day") || "today"; // today or tomorrow
  const userId = searchParams.get("userId")?.trim() || null;
  const requestedTimezone = searchParams.get("timezone");

  if (!sign) {
    return NextResponse.json(
      { success: false, error: "Valid sign is required" },
      { status: 400 }
    );
  }

  try {
    const timezone = requestedTimezone ? safeTimezone(requestedTimezone) : await getUserTimezone(userId);
    const requestedDay = day === "tomorrow" ? "tomorrow" : "today";
    const requestedPeriod = day === "tomorrow" ? "tomorrow" : "daily";
    const targetDate = getDateKey(timezone, day === "tomorrow" ? 1 : 0);
    const cacheId = getCacheId(sign, targetDate);
    const supabase = getSupabaseAdmin();

    // Check if horoscope is already cached for this sign+date
    const { data: cached } = await supabase
      .from("horoscope_cache")
      .select("*")
      .eq("id", cacheId)
      .maybeSingle();

    const cachedHoroscope = normalizeCachedHoroscope(cached);
    if (cachedHoroscope) {
      return NextResponse.json({
        success: true,
        horoscope: adaptRelativeDayLanguage(cachedHoroscope, requestedDay),
        sign,
        date: targetDate,
        timezone,
        cached: true,
      });
    }

    // Not cached - create/fetch the horoscope for this actual sign+date.
    const horoscopeText = day === "tomorrow"
      ? await fetchTomorrowHoroscope(sign, targetDate)
      : await fetchTodayHoroscope(sign);

    const horoscopePayload = {
      horoscope_data: horoscopeText,
      sign: displaySign(sign),
      period: requestedPeriod,
      date: targetDate,
      timezone,
      source: day === "tomorrow" && process.env.ANTHROPIC_API_KEY ? "anthropic" : day === "tomorrow" ? "newastro_fallback" : "ohmanda",
    };

    await supabase.from("horoscope_cache").upsert({
      id: cacheId,
      horoscope: horoscopePayload,
      data: horoscopePayload,
      sign,
      date: targetDate,
      period: requestedPeriod,
      cache_key: targetDate,
      fetched_at: new Date().toISOString(),
    }, { onConflict: "id" });

    return NextResponse.json({
      success: true,
      horoscope: adaptRelativeDayLanguage(horoscopeText, requestedDay),
      sign,
      date: targetDate,
      timezone,
      cached: false,
    });
  } catch (error) {
    console.error("Horoscope API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch horoscope" },
      { status: 500 }
    );
  }
}
