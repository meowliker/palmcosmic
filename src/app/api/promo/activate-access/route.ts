import { NextRequest, NextResponse } from "next/server";
import {
  activateFutureAllReportEntitlements,
  activateTrialPrimaryEntitlements,
  FLOW_PRIMARY_REPORTS,
  type FlowKey,
} from "@/lib/report-entitlements";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const VALID_FLOWS = Object.keys(FLOW_PRIMARY_REPORTS) as FlowKey[];

type PromoKind = "three_day" | "ten_minute";

function normalizeCode(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

function normalizeUserId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

function normalizeFlow(value: unknown): FlowKey | null {
  if (typeof value !== "string") return null;
  return VALID_FLOWS.includes(value as FlowKey) ? (value as FlowKey) : null;
}

function envCodes(name: string) {
  return new Set(
    (process.env[name] || "")
      .split(",")
      .map((code) => normalizeCode(code))
      .filter(Boolean)
  );
}

async function resolvePromoCode(code: string): Promise<{ kind: PromoKind; source: "env" | "database"; id: string } | null> {
  const threeDayCodes = envCodes("PALMCOSMIC_PROMO_3DAY_CODES");
  const tenMinuteCodes = envCodes("PALMCOSMIC_PROMO_10MIN_CODES");

  if (threeDayCodes.has(code)) return { kind: "three_day", source: "env", id: code };
  if (tenMinuteCodes.has(code)) return { kind: "ten_minute", source: "env", id: code };

  if (process.env.NODE_ENV !== "production") {
    if (code === "TEST3DAY") return { kind: "three_day", source: "env", id: code };
    if (code === "TEST10MIN") return { kind: "ten_minute", source: "env", id: code };
  }

  const supabase = getSupabaseAdmin();
  for (const variant of [code, code.toLowerCase()]) {
    const { data } = await supabase.from("promo_codes").select("*").eq("code", variant).maybeSingle();
    if (!data) continue;
    if (data.active === false) return null;
    if (data.expires_at && new Date(data.expires_at) < new Date()) return null;
    const usedCount = Number(data.used_count ?? data.current_uses ?? 0);
    if (data.max_uses && usedCount >= Number(data.max_uses)) return null;

    const kind =
      data.kind === "ten_minute" ||
      data.plan === "ten_minute" ||
      data.type === "ten_minute"
        ? "ten_minute"
        : "three_day";
    return { kind, source: "database", id: data.code };
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const code = normalizeCode(body.code);
    const userId = normalizeUserId(body.userId);
    const email = normalizeEmail(body.email);
    const flow = normalizeFlow(body.flow);

    if (!code || !userId || !email || !flow) {
      return NextResponse.json(
        { success: false, error: "code, userId, email, and valid flow are required" },
        { status: 400 }
      );
    }

    const promo = await resolvePromoCode(code);
    if (!promo) {
      return NextResponse.json({ success: false, error: "Invalid or expired coupon code" }, { status: 404 });
    }

    const now = new Date();
    const trialEndsAt =
      promo.kind === "ten_minute"
        ? new Date(now.getTime() + 10 * 60 * 1000)
        : new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const stripeSessionId = `promo_session_${promo.kind}_${flow}_${userId}`;
    const stripeSubscriptionId = `promo_sub_${promo.kind}_${flow}_${userId}`;

    const entitlement = await activateTrialPrimaryEntitlements({
      userId,
      email,
      flow,
      stripeCustomerId: `promo_customer_${userId}`,
      stripeSubscriptionId,
      stripeSessionId,
      trialStartedAt: now,
      trialEndsAt,
    });

    await activateFutureAllReportEntitlements({
      userId,
      email,
      source: "promo_post_trial",
      startsAt: trialEndsAt,
      stripeSubscriptionId,
      stripeSessionId,
      metadata: {
        code: promo.id,
        kind: promo.kind,
        flow,
        no_charge: true,
      },
    });

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    await supabase.from("payments").upsert(
      {
        id: stripeSessionId,
        user_id: userId,
        type: "subscription_trial",
        customer_email: email,
        amount: 0,
        currency: "USD",
        payment_status: "paid",
        fulfilled_at: nowIso,
        stripe_session_id: stripeSessionId,
        stripe_customer_id: `promo_customer_${userId}`,
        flow,
        report_key: entitlement.primaryReport,
        billing_kind: `promo_${promo.kind}`,
        stripe_subscription_id: stripeSubscriptionId,
        metadata: {
          promo: true,
          code: promo.id,
          kind: promo.kind,
          flow,
          reports: entitlement.reports,
          no_charge: true,
          post_trial_unlock: "all_reports",
        },
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );

    if (promo.source === "database") {
      const { data } = await supabase.from("promo_codes").select("used_count,current_uses").eq("code", promo.id).maybeSingle();
      await supabase
        .from("promo_codes")
        .update({
          current_uses: Number(data?.used_count ?? data?.current_uses ?? 0) + 1,
          used_count: Number(data?.used_count ?? data?.current_uses ?? 0) + 1,
          last_used_at: nowIso,
        })
        .eq("code", promo.id);
    }

    return NextResponse.json({
      success: true,
      userId,
      flow,
      code: promo.id,
      kind: promo.kind,
      reports: entitlement.reports,
      primaryReport: entitlement.primaryReport,
      trialEndsAt: trialEndsAt.toISOString(),
      redirectPath: `/onboarding/create-password?flow=${encodeURIComponent(flow)}&promo=${encodeURIComponent(promo.kind)}`,
    });
  } catch (error: any) {
    console.error("[promo/activate-access] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to activate coupon code" },
      { status: 500 }
    );
  }
}
