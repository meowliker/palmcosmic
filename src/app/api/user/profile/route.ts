import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function pickProfilePatch(input: Record<string, unknown>) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  const map: Record<string, string> = {
    name: "name",
    gender: "gender",
    birthMonth: "birth_month",
    birthDay: "birth_day",
    birthYear: "birth_year",
    birthPlace: "birth_place",
    birthHour: "birth_hour",
    birthMinute: "birth_minute",
    birthPeriod: "birth_period",
    sunSign: "sun_sign",
    moonSign: "moon_sign",
    ascendantSign: "ascendant_sign",
    zodiacSign: "zodiac_sign",
  };

  for (const [clientKey, dbKey] of Object.entries(map)) {
    if (clientKey in input) {
      patch[dbKey] = input[clientKey] ?? null;
    }
  }

  return patch;
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = cleanString(body.userId);
    const email = normalizeEmail(body.email);

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const patch = pickProfilePatch(body);
    const userPatch = {
      id: userId,
      ...(email ? { email } : {}),
      ...patch,
    };
    const profilePatch = {
      id: userId,
      ...(email ? { email } : {}),
      ...patch,
    };

    const supabase = getSupabaseAdmin();
    const [userResult, profileResult] = await Promise.all([
      supabase.from("users").upsert(userPatch, { onConflict: "id" }),
      supabase.from("user_profiles").upsert(profilePatch, { onConflict: "id" }),
    ]);

    const error = userResult.error || profileResult.error;
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[user/profile] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update profile" },
      { status: 500 }
    );
  }
}
