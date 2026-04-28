import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendMetaConversionEvent } from "@/lib/meta-conversions";

export const dynamic = "force-dynamic";

type SnapshotBody = {
  userId?: string;
  email?: string;
  currentRoute?: string;
  currentStep?: string;
  priorityArea?: string | null;
  answers?: Record<string, unknown>;
  onboardingData?: Record<string, unknown>;
  source?: string;
};

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseAge(birthYear: unknown): number | null {
  const year = typeof birthYear === "string" ? Number.parseInt(birthYear, 10) : Number(birthYear);
  if (!Number.isFinite(year) || year < 1900) return null;
  return new Date().getFullYear() - year;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SnapshotBody;
    const userId = cleanString(body.userId);

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const email = normalizeEmail(body.email);
    const onboardingData = body.onboardingData || {};
    const answers = body.answers || {};
    const now = new Date().toISOString();
    const age = parseAge(onboardingData.birthYear);
    const goals = Array.isArray(onboardingData.goals) ? onboardingData.goals : [];

    const supabase = getSupabaseAdmin();

    const userPayload: Record<string, unknown> = {
      id: userId,
      email,
      gender: onboardingData.gender || null,
      age,
      relationship_status: onboardingData.relationshipStatus || null,
      goals,
      birth_month: onboardingData.birthMonth || null,
      birth_day: onboardingData.birthDay || null,
      birth_year: onboardingData.birthYear || null,
      birth_hour: onboardingData.birthHour || null,
      birth_minute: onboardingData.birthMinute || null,
      birth_period: onboardingData.birthPeriod || null,
      birth_place: onboardingData.birthPlace || null,
      knows_birth_time: onboardingData.knowsBirthTime ?? true,
      sun_sign: onboardingData.sunSign || null,
      moon_sign: onboardingData.moonSign || null,
      ascendant_sign: onboardingData.ascendantSign || null,
      modality: onboardingData.modality || null,
      polarity: onboardingData.polarity || null,
      updated_at: now,
    };

    const profilePayload: Record<string, unknown> = {
      id: userId,
      email,
      gender: onboardingData.gender || null,
      birth_month: onboardingData.birthMonth || null,
      birth_day: onboardingData.birthDay || null,
      birth_year: onboardingData.birthYear || null,
      birth_hour: onboardingData.birthHour || null,
      birth_minute: onboardingData.birthMinute || null,
      birth_period: onboardingData.birthPeriod || null,
      birth_place: onboardingData.birthPlace || null,
      knows_birth_time: onboardingData.knowsBirthTime ?? true,
      relationship_status: onboardingData.relationshipStatus || null,
      goals,
      color_preference: onboardingData.colorPreference || null,
      element_preference: onboardingData.elementPreference || null,
      zodiac_sign: onboardingData.zodiacSign || null,
      sun_sign: onboardingData.sunSign || null,
      moon_sign: onboardingData.moonSign || null,
      ascendant_sign: onboardingData.ascendantSign || null,
      modality: onboardingData.modality || null,
      polarity: onboardingData.polarity || null,
      updated_at: now,
    };

    const sessionPayload = {
      id: `session_${userId}`,
      user_id: userId,
      email,
      current_route: cleanString(body.currentRoute),
      current_step: cleanString(body.currentStep),
      priority_area: cleanString(body.priorityArea),
      answers,
      onboarding_data: onboardingData,
      source: cleanString(body.source),
      status: "in_progress",
      last_saved_at: now,
      updated_at: now,
    };

    const leadPayload = {
      id: `lead_${userId}`,
      email,
      user_id: userId,
      gender: onboardingData.gender || "not specified",
      age,
      relationship_status: onboardingData.relationshipStatus || "not specified",
      goals,
      subscription_status: "no",
      source: cleanString(body.source) || "onboarding_snapshot",
      metadata: { currentRoute: body.currentRoute, currentStep: body.currentStep, priorityArea: body.priorityArea },
      updated_at: now,
    };

    const [userResult, profileResult, sessionResult, leadResult] = await Promise.all([
      supabase.from("users").upsert(userPayload, { onConflict: "id" }),
      supabase.from("user_profiles").upsert(profilePayload, { onConflict: "id" }),
      supabase.from("onboarding_sessions").upsert(sessionPayload, { onConflict: "id" }),
      email
        ? supabase.from("leads").upsert(leadPayload, { onConflict: "id" })
        : Promise.resolve({ error: null }),
    ]);

    const error = userResult.error || profileResult.error || sessionResult.error || leadResult.error;
    if (error) throw error;

    if (email) {
      await sendMetaConversionEvent({
        eventName: "Lead",
        eventId: `lead_${userId}`,
        request,
        email,
        userId,
        contentName: "PalmCosmic Onboarding Lead",
        contentType: "lead",
        customData: {
          lead_source: cleanString(body.source) || "onboarding_snapshot",
          current_step: cleanString(body.currentStep),
          priority_area: cleanString(body.priorityArea),
        },
      });
    }

    return NextResponse.json({ success: true, userId, email });
  } catch (error: any) {
    console.error("[onboarding-snapshot] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save onboarding snapshot" },
      { status: 500 }
    );
  }
}
