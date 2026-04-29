import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function normalizeUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = normalizeUserId(request.nextUrl.searchParams.get("userId"));

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "user_not_found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("sun_sign")
      .eq("id", userId)
      .maybeSingle();

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        coins: user.coins,
        timezone: user.timezone,
        isDevTester: user.is_dev_tester === true,
        passwordHashSet: !!user.password_hash,
        unlockedFeatures: user.unlocked_features || {},
        purchasedBundle: user.bundle_purchased || null,
        palmReading: user.palm_reading,
        birthChart: user.birth_chart,
        compatibilityTest: user.compatibility_test,
        prediction2026: user.prediction_2026,
        birthChartTimerActive: user.birth_chart_timer_active,
        birthChartTimerStartedAt: user.birth_chart_timer_started_at,
        birthMonth: user.birth_month,
        birthDay: user.birth_day,
        sunSign: user.sun_sign || profile?.sun_sign || null,
      },
    });
  } catch (error: any) {
    console.error("[user/hydrate] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to hydrate user" },
      { status: 500 }
    );
  }
}
