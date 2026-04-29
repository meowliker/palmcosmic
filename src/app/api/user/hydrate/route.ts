import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { REPORT_TO_UNLOCKED_FEATURE, type ReportKey } from "@/lib/report-entitlements";
import { normalizeUnlockedFeatures } from "@/lib/unlocked-features";

export const dynamic = "force-dynamic";

function normalizeUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = normalizeUserId(request.nextUrl.searchParams.get("userId"));
    const email = normalizeEmail(request.nextUrl.searchParams.get("email"));

    if (!userId && !email) {
      return NextResponse.json({ success: false, error: "userId or email is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("users")
      .select("*")
      .limit(1);

    query = userId ? query.eq("id", userId) : query.eq("email", email || "");

    const { data: user, error: userError } = await query.maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return NextResponse.json({ success: false, error: "user_not_found" }, { status: 404 });
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("sun_sign")
      .eq("id", user.id)
      .maybeSingle();

    const nowIso = new Date().toISOString();
    const { data: allEntitlements, error: allEntitlementError } = await supabase
      .from("user_entitlements")
      .select("report_key")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (allEntitlementError) {
      throw allEntitlementError;
    }

    const { data: activeEntitlements, error: activeEntitlementError } = await supabase
      .from("user_entitlements")
      .select("report_key,source,starts_at,ends_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    if (activeEntitlementError) {
      throw activeEntitlementError;
    }

    const hasEntitlementRecords = (allEntitlements || []).length > 0;
    const unlockedFeatures = hasEntitlementRecords
      ? normalizeUnlockedFeatures({})
      : normalizeUnlockedFeatures(user.unlocked_features);

    for (const entitlement of activeEntitlements || []) {
      const featureKey = REPORT_TO_UNLOCKED_FEATURE[entitlement.report_key as ReportKey];
      if (featureKey) {
        (unlockedFeatures as any)[featureKey] = true;
      }
    }

    const currentUnlockedFeatures = normalizeUnlockedFeatures(user.unlocked_features);
    const unlockedFeaturesChanged = Object.keys(unlockedFeatures).some(
      (key) => (unlockedFeatures as any)[key] !== (currentUnlockedFeatures as any)[key]
    );
    const hasPostTrialPromoAccess = (activeEntitlements || []).some(
      (entitlement) => entitlement.source === "promo_post_trial"
    );
    const statusPatch: Record<string, unknown> = {};

    if (hasPostTrialPromoAccess && user.access_status !== "promo_active") {
      statusPatch.access_status = "promo_active";
    }
    if (hasPostTrialPromoAccess && user.subscription_status !== "active") {
      statusPatch.subscription_status = "active";
    }

    if (unlockedFeaturesChanged || Object.keys(statusPatch).length > 0) {
      await supabase
        .from("users")
        .update({
          ...(unlockedFeaturesChanged ? { unlocked_features: unlockedFeatures } : {}),
          ...statusPatch,
          updated_at: nowIso,
        })
        .eq("id", user.id);
    }

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
        unlockedFeatures,
        purchasedBundle: user.bundle_purchased || null,
        purchaseType: user.purchase_type || null,
        primaryFlow: user.primary_flow || null,
        primaryReport: user.primary_report || null,
        subscriptionStatus: (statusPatch.subscription_status as string) || user.subscription_status || null,
        accessStatus: (statusPatch.access_status as string) || user.access_status || null,
        subscriptionPlan: user.subscription_plan || null,
        trialEndsAt: user.trial_ends_at || null,
        subscriptionCurrentPeriodEnd: user.subscription_current_period_end || null,
        subscriptionCancelAtPeriodEnd: user.subscription_cancel_at_period_end || false,
        stripeSubscriptionId: user.stripe_subscription_id || null,
        palmReading: user.palm_reading,
        birthChart: user.birth_chart,
        compatibilityTest: user.compatibility_test,
        prediction2026: user.prediction_2026,
        prediction2026ReportId: user.prediction_2026_report_id || null,
        birthChartTimerActive: user.birth_chart_timer_active,
        birthChartTimerStartedAt: user.birth_chart_timer_started_at,
        gender: user.gender || null,
        birthMonth: user.birth_month,
        birthDay: user.birth_day,
        birthYear: user.birth_year,
        birthHour: user.birth_hour,
        birthMinute: user.birth_minute,
        birthPeriod: user.birth_period,
        birthPlace: user.birth_place,
        zodiacSign: user.zodiac_sign || null,
        moonSign: user.moon_sign || null,
        ascendantSign: user.ascendant_sign || null,
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
