import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

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
      return NextResponse.json({ success: false, error: "No subscription found" }, { status: 404 });
    }

    if (!String(user.stripe_subscription_id).startsWith("demo_sub_")) {
      const stripe = getStripeClient();
      await stripe.subscriptions.update(user.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
    }

    const isTrialWindow =
      user.subscription_status === "trial_cancelled" ||
      user.subscription_status === "trialing" ||
      user.access_status === "trial_active";

    const { error } = await getSupabaseAdmin()
      .from("users")
      .update({
        subscription_status: isTrialWindow ? "trialing" : "active",
        access_status: isTrialWindow ? "trial_active" : "subscription_active",
        subscription_cancel_at_period_end: false,
        subscription_lock_reason: null,
        subscription_locked_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      cancelAtPeriodEnd: false,
      subscriptionStatus: isTrialWindow ? "trialing" : "active",
    });
  } catch (error: any) {
    console.error("[resume-subscription] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to resume subscription" },
      { status: 500 }
    );
  }
}

