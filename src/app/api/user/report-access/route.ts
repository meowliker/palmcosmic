import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeUnlockedFeatures } from "@/lib/unlocked-features";
import { REPORT_TO_UNLOCKED_FEATURE, type ReportKey } from "@/lib/report-entitlements";

export const dynamic = "force-dynamic";

const VALID_REPORT_KEYS = new Set<ReportKey>([
  "palm_reading",
  "birth_chart",
  "soulmate_sketch",
  "future_partner",
  "prediction_2026",
  "compatibility",
]);

const REPORT_ID_COLUMNS: Record<ReportKey, string> = {
  palm_reading: "palm_reading_report_id",
  birth_chart: "birth_chart_report_id",
  soulmate_sketch: "soulmate_sketch_report_id",
  future_partner: "future_partner_report_id",
  prediction_2026: "prediction_2026_report_id",
  compatibility: "compatibility_report_id",
};

const USER_SELECT = [
  "id",
  "email",
  "access_status",
  "subscription_status",
  "unlocked_features",
  "trial_ends_at",
  "subscription_current_period_end",
  ...Object.values(REPORT_ID_COLUMNS),
].join(",");

function normalizeEmail(email: string | null): string | null {
  const normalized = (email || "").trim().toLowerCase();
  return normalized || null;
}

export async function GET(request: NextRequest) {
  try {
    const reportKey = request.nextUrl.searchParams.get("reportKey") as ReportKey | null;
    const userId = request.nextUrl.searchParams.get("userId")?.trim() || null;
    const email = normalizeEmail(request.nextUrl.searchParams.get("email"));

    if (!reportKey || !VALID_REPORT_KEYS.has(reportKey)) {
      return NextResponse.json({ error: "valid reportKey is required" }, { status: 400 });
    }

    if (!userId && !email) {
      return NextResponse.json({ canAccess: false, reason: "missing_user" });
    }

    const supabase = getSupabaseAdmin();
    let user: any = null;

    if (userId) {
      const { data, error } = await supabase
        .from("users")
        .select(USER_SELECT)
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (!user && email) {
      const { data, error } = await supabase
        .from("users")
        .select(USER_SELECT)
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (!user?.id) {
      return NextResponse.json({ canAccess: false, reason: "user_not_found" });
    }

    const nowIso = new Date().toISOString();
    const { data: entitlements, error: entitlementError } = await supabase
      .from("user_entitlements")
      .select("id,report_key,source,status,starts_at,ends_at")
      .eq("user_id", user.id)
      .eq("report_key", reportKey)
      .eq("status", "active")
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`)
      .order("starts_at", { ascending: false })
      .limit(10);

    if (entitlementError) throw entitlementError;

    const activeEntitlement = (entitlements || []).find((entitlement) => {
      if (!entitlement.starts_at) return true;
      return new Date(entitlement.starts_at) <= new Date(nowIso);
    });

    if (activeEntitlement) {
      return NextResponse.json({
        canAccess: true,
        reason: "entitlement_active",
        userId: user.id,
        reportId: user[REPORT_ID_COLUMNS[reportKey]] || null,
        entitlement: activeEntitlement,
        accessStatus: user.access_status,
        subscriptionStatus: user.subscription_status,
      });
    }

    const featureKey = REPORT_TO_UNLOCKED_FEATURE[reportKey];
    const unlockedFeatures = normalizeUnlockedFeatures(user.unlocked_features);

    const { data: historicalEntitlements, error: historicalEntitlementError } = await supabase
      .from("user_entitlements")
      .select("id")
      .eq("user_id", user.id)
      .eq("report_key", reportKey)
      .limit(1);
    if (historicalEntitlementError) throw historicalEntitlementError;

    if (
      featureKey &&
      (unlockedFeatures as any)[featureKey] === true &&
      user.access_status !== "locked" &&
      (historicalEntitlements || []).length === 0
    ) {
      return NextResponse.json({
        canAccess: true,
        reason: "legacy_feature_unlocked",
        userId: user.id,
        reportId: user[REPORT_ID_COLUMNS[reportKey]] || null,
        accessStatus: user.access_status,
        subscriptionStatus: user.subscription_status,
      });
    }

    return NextResponse.json({
      canAccess: false,
      reason: user.access_status === "locked" ? "access_locked" : "report_locked",
      userId: user.id,
      accessStatus: user.access_status,
      subscriptionStatus: user.subscription_status,
    });
  } catch (error: any) {
    console.error("[report-access] Error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to check report access" },
      { status: 500 }
    );
  }
}
