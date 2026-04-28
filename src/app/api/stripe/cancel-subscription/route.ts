import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function dateFromUnix(value?: number | null) {
  return value ? new Date(value * 1000) : null;
}

async function findUser(userId?: string | null, email?: string | null) {
  const supabase = getSupabaseAdmin();
  const select =
    "id,email,stripe_subscription_id,subscription_status,access_status,trial_ends_at,subscription_current_period_end";

  if (userId) {
    const { data, error } = await supabase.from("users").select(select).eq("id", userId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }

  if (email) {
    const { data, error } = await supabase.from("users").select(select).eq("email", email).maybeSingle();
    if (error) throw error;
    return data;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const user = await findUser(userId, email);

    if (!user?.id || !user?.stripe_subscription_id) {
      return NextResponse.json({ success: false, error: "No active subscription found" }, { status: 404 });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();
    let trialEndsAt = user.trial_ends_at || null;
    let currentPeriodEnd = user.subscription_current_period_end || null;
    let subscriptionStatus = user.subscription_status || "cancelled";

    if (!String(user.stripe_subscription_id).startsWith("demo_sub_")) {
      const stripe = getStripeClient();
      const subscription = await stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: true,
      });

      trialEndsAt = dateFromUnix((subscription as any).trial_end)?.toISOString() || trialEndsAt;
      currentPeriodEnd =
        dateFromUnix((subscription as any).current_period_end)?.toISOString() ||
        currentPeriodEnd ||
        trialEndsAt;
      subscriptionStatus = subscription.status;
    }

    const isTrial =
      subscriptionStatus === "trialing" ||
      user.subscription_status === "trialing" ||
      user.access_status === "trial_active";
    const preserveUntil = isTrial ? trialEndsAt : currentPeriodEnd;

    const { error } = await supabase
      .from("users")
      .update({
        subscription_status: isTrial ? "trial_cancelled" : "cancelled",
        access_status: isTrial ? "trial_active" : "subscription_active",
        subscription_cancel_at_period_end: true,
        trial_ends_at: trialEndsAt,
        subscription_current_period_end: currentPeriodEnd,
        subscription_lock_reason: isTrial ? "pending_trial_cancellation" : "pending_subscription_cancellation",
        subscription_locked_at: null,
        updated_at: nowIso,
      })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: true,
      endsAt: preserveUntil,
      subscriptionStatus: isTrial ? "trial_cancelled" : "cancelled",
    });
  } catch (error: any) {
    console.error("[cancel-subscription] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to cancel subscription" },
      { status: 500 }
    );
  }
}

