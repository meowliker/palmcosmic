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

function hasValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function setIfPresent(payload: Record<string, unknown>, key: string, value: unknown) {
  if (hasValue(value)) {
    payload[key] = value;
  }
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
      updated_at: now,
    };

    const profilePayload: Record<string, unknown> = {
      id: userId,
      updated_at: now,
    };

    setIfPresent(userPayload, "email", email);
    setIfPresent(userPayload, "gender", onboardingData.gender);
    setIfPresent(userPayload, "age", age);
    setIfPresent(userPayload, "relationship_status", onboardingData.relationshipStatus);
    setIfPresent(userPayload, "goals", goals);
    setIfPresent(userPayload, "birth_month", onboardingData.birthMonth);
    setIfPresent(userPayload, "birth_day", onboardingData.birthDay);
    setIfPresent(userPayload, "birth_year", onboardingData.birthYear);
    setIfPresent(userPayload, "birth_hour", onboardingData.birthHour);
    setIfPresent(userPayload, "birth_minute", onboardingData.birthMinute);
    setIfPresent(userPayload, "birth_period", onboardingData.birthPeriod);
    setIfPresent(userPayload, "birth_place", onboardingData.birthPlace);
    if ("knowsBirthTime" in onboardingData) userPayload.knows_birth_time = onboardingData.knowsBirthTime ?? true;
    setIfPresent(userPayload, "sun_sign", onboardingData.sunSign);
    setIfPresent(userPayload, "moon_sign", onboardingData.moonSign);
    setIfPresent(userPayload, "ascendant_sign", onboardingData.ascendantSign);
    setIfPresent(userPayload, "modality", onboardingData.modality);
    setIfPresent(userPayload, "polarity", onboardingData.polarity);

    setIfPresent(profilePayload, "email", email);
    setIfPresent(profilePayload, "gender", onboardingData.gender);
    setIfPresent(profilePayload, "birth_month", onboardingData.birthMonth);
    setIfPresent(profilePayload, "birth_day", onboardingData.birthDay);
    setIfPresent(profilePayload, "birth_year", onboardingData.birthYear);
    setIfPresent(profilePayload, "birth_hour", onboardingData.birthHour);
    setIfPresent(profilePayload, "birth_minute", onboardingData.birthMinute);
    setIfPresent(profilePayload, "birth_period", onboardingData.birthPeriod);
    setIfPresent(profilePayload, "birth_place", onboardingData.birthPlace);
    if ("knowsBirthTime" in onboardingData) profilePayload.knows_birth_time = onboardingData.knowsBirthTime ?? true;
    setIfPresent(profilePayload, "relationship_status", onboardingData.relationshipStatus);
    setIfPresent(profilePayload, "goals", goals);
    setIfPresent(profilePayload, "color_preference", onboardingData.colorPreference);
    setIfPresent(profilePayload, "element_preference", onboardingData.elementPreference);
    setIfPresent(profilePayload, "zodiac_sign", onboardingData.zodiacSign);
    setIfPresent(profilePayload, "sun_sign", onboardingData.sunSign);
    setIfPresent(profilePayload, "moon_sign", onboardingData.moonSign);
    setIfPresent(profilePayload, "ascendant_sign", onboardingData.ascendantSign);
    setIfPresent(profilePayload, "modality", onboardingData.modality);
    setIfPresent(profilePayload, "polarity", onboardingData.polarity);

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
