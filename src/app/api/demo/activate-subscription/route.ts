import { NextRequest, NextResponse } from "next/server";
import { activateTrialPrimaryEntitlements, FLOW_PRIMARY_REPORTS, type FlowKey } from "@/lib/report-entitlements";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const VALID_FLOWS = Object.keys(FLOW_PRIMARY_REPORTS) as FlowKey[];

function isDemoBypassEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.DEMO_PAYMENT_BYPASS === "true";
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

export async function POST(request: NextRequest) {
  try {
    if (!isDemoBypassEnabled()) {
      return NextResponse.json(
        { success: false, error: "Demo payment bypass is disabled" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const userId = normalizeUserId(body.userId);
    const email = normalizeEmail(body.email);
    const flow = normalizeFlow(body.flow);

    if (!userId || !email || !flow) {
      return NextResponse.json(
        { success: false, error: "userId, email, and valid flow are required" },
        { status: 400 }
      );
    }

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const stripeSessionId = `demo_session_${flow}_${userId}`;
    const stripeSubscriptionId = `demo_sub_${flow}_${userId}`;

    const entitlement = await activateTrialPrimaryEntitlements({
      userId,
      email,
      flow,
      stripeCustomerId: `demo_customer_${userId}`,
      stripeSubscriptionId,
      stripeSessionId,
      trialStartedAt: now,
      trialEndsAt,
    });

    const supabase = getSupabaseAdmin();
    await supabase
      .from("payments")
      .upsert({
        id: stripeSessionId,
        user_id: userId,
        type: "subscription_trial",
        customer_email: email,
        amount: 99,
        currency: "USD",
        payment_status: "paid",
        fulfilled_at: new Date().toISOString(),
        stripe_session_id: stripeSessionId,
        stripe_customer_id: `demo_customer_${userId}`,
        flow,
        report_key: entitlement.primaryReport,
        billing_kind: "subscription_trial_demo",
        stripe_subscription_id: stripeSubscriptionId,
        metadata: {
          demo: true,
          flow,
          reports: entitlement.reports,
          plan: "0.99_trial_then_9_monthly",
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    return NextResponse.json({
      success: true,
      userId,
      flow,
      reports: entitlement.reports,
      primaryReport: entitlement.primaryReport,
      redirectPath: `/onboarding/create-password?flow=${encodeURIComponent(flow)}&demo=true`,
    });
  } catch (error: any) {
    console.error("[demo/activate-subscription] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to activate demo subscription" },
      { status: 500 }
    );
  }
}
