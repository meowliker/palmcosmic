import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { REPORT_TO_UNLOCKED_FEATURE, type ReportKey } from "@/lib/report-entitlements";
import { normalizeUnlockedFeatures } from "@/lib/unlocked-features";
import { deriveUnlockedFeaturesFromPurchases, unlockedFeaturesEqual } from "@/lib/payment-derived-entitlements";

export const dynamic = "force-dynamic";

function normalizeEmail(email: unknown) {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function normalizeUserId(userId: unknown) {
  if (typeof userId !== "string") return null;
  const normalized = userId.trim();
  return normalized || null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = normalizeUserId(body.userId);
    const email = normalizeEmail(body.email);

    if (!userId && !email) {
      return NextResponse.json({ success: false, error: "userId or email is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let user: any = null;

    if (userId) {
      const { data, error } = await supabase
        .from("users")
        .select("id,unlocked_features")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (!user && email) {
      const { data, error } = await supabase
        .from("users")
        .select("id,unlocked_features")
        .eq("email", email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      user = data;
    }

    if (!user?.id) {
      return NextResponse.json({ success: true, updated: false, reason: "user_not_found" });
    }

    const nowIso = new Date().toISOString();
    const { data: allEntitlements, error: allEntitlementError } = await supabase
      .from("user_entitlements")
      .select("report_key")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (allEntitlementError) throw allEntitlementError;

    const { data: entitlements, error: entitlementError } = await supabase
      .from("user_entitlements")
      .select("report_key,source")
      .eq("user_id", user.id)
      .eq("status", "active")
      .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
      .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

    if (entitlementError) throw entitlementError;

    const hasEntitlementRecords = (allEntitlements || []).length > 0;
    const entitlementFeatures = hasEntitlementRecords ? normalizeUnlockedFeatures({}) : normalizeUnlockedFeatures(user.unlocked_features);

    for (const entitlement of entitlements || []) {
      const featureKey = REPORT_TO_UNLOCKED_FEATURE[entitlement.report_key as ReportKey];
      if (featureKey && (entitlementFeatures as any)[featureKey] !== true) {
        (entitlementFeatures as any)[featureKey] = true;
      }
    }

    const unlockedFeatures = await deriveUnlockedFeaturesFromPurchases({
      supabase,
      userId: user.id,
      email,
      baseFeatures: entitlementFeatures,
    });
    const changed = !unlockedFeaturesEqual(unlockedFeatures, user.unlocked_features);

    const hasPostTrialPromoAccess = (entitlements || []).some(
      (entitlement) => entitlement.source === "promo_post_trial"
    );
    const statusPatch = hasPostTrialPromoAccess
      ? {
          access_status: "promo_active",
          subscription_status: "active",
        }
      : {};

    if (changed || hasPostTrialPromoAccess) {
      const { error } = await supabase
        .from("users")
        .update({
          ...(changed ? { unlocked_features: unlockedFeatures } : {}),
          ...statusPatch,
          updated_at: nowIso,
        })
        .eq("id", user.id);
      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      updated: changed,
      userId: user.id,
      unlockedFeatures,
    });
  } catch (error: any) {
    console.error("[refresh-entitlements] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to refresh entitlements" },
      { status: 500 }
    );
  }
}
