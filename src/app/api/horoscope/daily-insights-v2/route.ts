import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const VALID_SIGNS = new Set([
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
]);

const INSIGHTS_PROMPT = `You are an expert astrologer creating daily app insights by zodiac sign.

Return ONLY valid JSON:
{
  "lucky_number": 7,
  "lucky_color": "Blue",
  "lucky_time": "10:00 AM - 12:00 PM",
  "mood": "Optimistic",
  "daily_tip": "One concise, actionable tip for today.",
  "dos": ["Short action 1", "Short action 2", "Short action 3"],
  "donts": ["Short avoid 1", "Short avoid 2", "Short avoid 3"]
}

Rules:
- Write in plain simple English.
- Do not mention planets, transits, houses, dashas, aspects, or astrology jargon.
- dos/donts must have exactly 3 items each, under 8 words each.
- mood must be one word.
- lucky_time must be a varied 2-hour range in 12-hour format.
- Make the content specific to the zodiac sign and date, but practical enough for all users of that sign.`;

function normalizeSign(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    for (const sign of VALID_SIGNS) {
      if (sign.toLowerCase() === normalized) return sign;
    }
    return null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeSign(record.name || record.sign || record.id);
  }
  return null;
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

function getDateKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

async function getUserContext(userId: string) {
  const supabase = getSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("id,sun_sign,zodiac_sign,timezone")
    .eq("id", userId)
    .maybeSingle();

  let sign = normalizeSign(user?.sun_sign) || normalizeSign(user?.zodiac_sign);
  let timezone = safeTimezone(user?.timezone);

  if (!sign || !user?.timezone) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("sun_sign,zodiac_sign")
      .eq("id", userId)
      .maybeSingle();
    sign = sign || normalizeSign(profile?.sun_sign) || normalizeSign(profile?.zodiac_sign);
  }

  return {
    sign: sign || "Aries",
    timezone,
  };
}

async function generateSignInsights(sign: string, dateKey: string) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI service not configured");
  }

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: INSIGHTS_PROMPT,
    messages: [
      {
        role: "user",
        content: `Generate today's cosmic insights for ${sign} on ${dateKey}.`,
      },
    ],
  });

  const textContent = response.content.find((block) => block.type === "text");
  if (!textContent || textContent.type !== "text") throw new Error("No AI response");

  let jsonStr = textContent.text.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const insights = JSON.parse(jsonStr);
  return {
    ...insights,
    sun_sign: sign,
  };
}

async function getOrCreateSignInsights(sign: string, dateKey: string, force = false) {
  const supabase = getSupabaseAdmin();
  const id = `${sign.toLowerCase()}_${dateKey}`;

  if (!force) {
    const { data: cached, error } = await supabase
      .from("daily_sign_insights")
      .select("insights")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (cached?.insights) return { insights: cached.insights, cached: true };
  }

  const insights = await generateSignInsights(sign, dateKey);
  const { error: upsertError } = await supabase.from("daily_sign_insights").upsert(
    {
      id,
      sign,
      date: dateKey,
      insights,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (upsertError) throw upsertError;

  return { insights, cached: false };
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId")?.trim();
  const requestedSign = normalizeSign(request.nextUrl.searchParams.get("sign"));
  const requestedTimezone = safeTimezone(request.nextUrl.searchParams.get("timezone"));
  const force = request.nextUrl.searchParams.get("force") === "true";

  if (!userId && !requestedSign) {
    return NextResponse.json({ success: false, error: "userId or sign is required" }, { status: 400 });
  }

  try {
    const userContext = userId ? await getUserContext(userId) : null;
    const sign = userContext?.sign || requestedSign || "Aries";
    const timezone = userContext?.timezone || requestedTimezone;
    const dateKey = getDateKey(timezone);
    const { insights, cached } = await getOrCreateSignInsights(sign, dateKey, force);

    return NextResponse.json({
      success: true,
      data: insights,
      cached,
      sign,
      date: dateKey,
      timezone,
    });
  } catch (error: any) {
    console.error("Daily sign insights fetch error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch daily insights" },
      { status: 500 }
    );
  }
}
