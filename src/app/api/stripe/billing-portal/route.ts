import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeReturnPath(value: unknown) {
  const path = normalizeString(value);
  return path.startsWith("/") && !path.startsWith("//") ? path : "/reports";
}

async function findUser(userId?: string | null, email?: string | null) {
  const supabase = getSupabaseAdmin();
  const select =
    "id,email,stripe_customer_id,stripe_subscription_id,subscription_status,access_status";

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
    const userId = normalizeString(body.userId);
    const email = normalizeEmail(body.email);

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, error: "Missing user details" },
        { status: 400 }
      );
    }

    const user = await findUser(userId, email);

    if (!user?.id) {
      return NextResponse.json(
        { success: false, error: "Subscription user not found" },
        { status: 404 }
      );
    }

    const stripe = getStripeClient();
    const subscriptionId = normalizeString(user.stripe_subscription_id);
    let customerId = normalizeString(user.stripe_customer_id);

    if (!customerId && subscriptionId && !subscriptionId.startsWith("demo_sub_") && !subscriptionId.startsWith("promo_")) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer?.id || "";

      if (customerId) {
        await getSupabaseAdmin()
          .from("users")
          .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
    }

    if (!customerId || customerId.startsWith("demo_") || customerId.startsWith("promo_")) {
      return NextResponse.json(
        { success: false, error: "Stripe customer not found for this subscription" },
        { status: 404 }
      );
    }

    const returnUrl = new URL(normalizeReturnPath(body.returnPath), request.nextUrl.origin).toString();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error: any) {
    console.error("[stripe/billing-portal] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to open Stripe billing portal" },
      { status: 500 }
    );
  }
}
