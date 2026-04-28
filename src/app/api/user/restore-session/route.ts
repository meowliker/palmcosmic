import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/restore-session?email=user@example.com
 *
 * Looks up a user by email in Supabase (users + user_profiles tables)
 * and returns their onboarding data so the session can be restored on a
 * different browser/device (e.g. from an abandoned checkout email link).
 */
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json(
        { error: "email parameter is required" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const supabase = getSupabaseAdmin();

    // 1. Look up in users table by email
    let userId: string | null = null;
    let userData: Record<string, any> | null = null;

    const { data: userRow } = await supabase
      .from("users")
      .select("*")
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (userRow) {
      userId = userRow.id;
      userData = userRow;
    }

    // 2. Look up in user_profiles table by email
    let profileData: Record<string, any> | null = null;

    const { data: profileRow } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("email", normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (profileRow) {
      if (!userId) userId = profileRow.id;
      profileData = profileRow;
    }

    // If userId found from users but no profile yet, try direct id lookup
    if (userId && !profileData) {
      const { data: profileById } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (profileById) {
        profileData = profileById;
      }
    }

    let sessionData: Record<string, any> | null = null;
    if (userId) {
      const { data: sessionRow } = await supabase
        .from("onboarding_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("last_saved_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sessionRow) {
        sessionData = sessionRow;
      }
    }

    if (!userId && !profileData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // 3. Return the session restoration data
    return NextResponse.json({
      success: true,
      userId,
      email: normalizedEmail,
      onboarding: {
        gender: sessionData?.onboarding_data?.gender ?? profileData?.gender ?? null,
        birthMonth: sessionData?.onboarding_data?.birthMonth ?? profileData?.birth_month ?? "January",
        birthDay: sessionData?.onboarding_data?.birthDay ?? profileData?.birth_day ?? "1",
        birthYear: sessionData?.onboarding_data?.birthYear ?? profileData?.birth_year ?? "2000",
        birthHour: sessionData?.onboarding_data?.birthHour ?? profileData?.birth_hour ?? "12",
        birthMinute: sessionData?.onboarding_data?.birthMinute ?? profileData?.birth_minute ?? "00",
        birthPeriod: sessionData?.onboarding_data?.birthPeriod ?? profileData?.birth_period ?? "AM",
        birthPlace: sessionData?.onboarding_data?.birthPlace ?? profileData?.birth_place ?? "",
        knowsBirthTime: sessionData?.onboarding_data?.knowsBirthTime ?? profileData?.knows_birth_time ?? true,
        relationshipStatus: sessionData?.onboarding_data?.relationshipStatus ?? profileData?.relationship_status ?? null,
        goals: sessionData?.onboarding_data?.goals ?? profileData?.goals ?? [],
        colorPreference: sessionData?.onboarding_data?.colorPreference ?? profileData?.color_preference ?? null,
        elementPreference: sessionData?.onboarding_data?.elementPreference ?? profileData?.element_preference ?? null,
        sunSign: sessionData?.onboarding_data?.sunSign ?? profileData?.sun_sign ?? null,
        moonSign: sessionData?.onboarding_data?.moonSign ?? profileData?.moon_sign ?? null,
        ascendantSign: sessionData?.onboarding_data?.ascendantSign ?? profileData?.ascendant_sign ?? null,
      },
      session: sessionData
        ? {
            currentRoute: sessionData.current_route,
            currentStep: sessionData.current_step,
            priorityArea: sessionData.priority_area,
            answers: sessionData.answers || {},
            lastSavedAt: sessionData.last_saved_at,
          }
        : null,
      name: userData?.name || "",
    });
  } catch (error: any) {
    console.error("[restore-session] Error:", error?.message || error);
    return NextResponse.json(
      { error: "Failed to restore session" },
      { status: 500 }
    );
  }
}
