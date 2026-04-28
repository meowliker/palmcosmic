import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { markStripePaymentStatus } from "@/lib/payment-fulfillment";
import { sendMetaConversionEvent } from "@/lib/meta-conversions";

const FLOW = "palm_reading";
const REPORT_KEY = "palm_reading";
const FEATURE = "palmReading";
const FEATURES = "palmReading,birthChart";
const BILLING_KIND = "subscription_trial";
const TRIAL_DAYS = 3;
const TRIAL_AMOUNT_CENTS = 99;
const MONTHLY_AMOUNT_CENTS = 900;

function normalizeEmail(email: string | undefined): string {
  return (email || "").trim().toLowerCase();
}

function normalizeRelativePath(path: string | undefined, fallback: string): string {
  return path && path.startsWith("/") ? path : fallback;
}

function appendQuery(path: string, query: Record<string, string>): string {
  const [pathname, existingQuery] = path.split("?");
  const params = new URLSearchParams(existingQuery || "");
  Object.entries(query).forEach(([key, value]) => params.set(key, value));
  return `${pathname}?${params.toString()}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const normalizedEmail = normalizeEmail(body.email);
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (!normalizedEmail) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const successPath = appendQuery(
      normalizeRelativePath(body.successPath, "/palm-reading"),
      { payment: "success", product: REPORT_KEY }
    );
    const cancelPath = appendQuery(
      normalizeRelativePath(body.cancelPath, "/onboarding/palm-reading/paywall"),
      { cancelled: "true" }
    );

    const metadata: Record<string, string> = {
      type: BILLING_KIND,
      billingKind: BILLING_KIND,
      flow: FLOW,
      reportKey: REPORT_KEY,
      feature: FEATURE,
      features: FEATURES,
      userId,
      email: normalizedEmail,
      trialDays: String(TRIAL_DAYS),
      primaryReport: REPORT_KEY,
      productName: "Palm Reading & Birth Chart",
    };

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: normalizedEmail,
      success_url: `${appUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(successPath)}`,
      cancel_url: `${appUrl}${cancelPath}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: TRIAL_AMOUNT_CENTS,
            product_data: {
              name: "PalmCosmic 3-Day Trial",
              description: "Unlock your Palm Reading and Birth Chart during the trial.",
            },
          },
        },
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: MONTHLY_AMOUNT_CENTS,
            recurring: { interval: "month" },
            product_data: {
              name: "PalmCosmic Monthly Access",
              description: "Unlock all PalmCosmic reports after the trial converts.",
            },
          },
        },
      ],
      subscription_data: {
        trial_period_days: TRIAL_DAYS,
        metadata,
      },
      metadata,
    });

    await markStripePaymentStatus({
      stripeSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      customerEmail: normalizedEmail,
      metadata,
      amount: TRIAL_AMOUNT_CENTS,
      currency: "USD",
      paymentStatus: "created",
    });

    const supabase = getSupabaseAdmin();
    await supabase
      .from("payments")
      .update({
        flow: FLOW,
        report_key: REPORT_KEY,
        billing_kind: BILLING_KIND,
        metadata,
        updated_at: new Date().toISOString(),
      })
      .eq("stripe_session_id", session.id);

    await supabase
      .from("users")
      .update({
        access_status: "locked",
        primary_flow: FLOW,
        primary_report: REPORT_KEY,
        subscription_status: "checkout_started",
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    await sendMetaConversionEvent({
      eventName: "InitiateCheckout",
      eventId: `initiate_checkout_${session.id}`,
      request,
      email: normalizedEmail,
      userId,
      value: TRIAL_AMOUNT_CENTS / 100,
      currency: "USD",
      contentName: "Palm Reading & Birth Chart Trial",
      contentIds: [REPORT_KEY, "birth_chart"],
      contentType: "subscription",
      customData: {
        payment_provider: "stripe",
        purchase_type: BILLING_KIND,
        flow: FLOW,
        report_key: REPORT_KEY,
        trial_days: TRIAL_DAYS,
        monthly_price: MONTHLY_AMOUNT_CENTS / 100,
        stripe_session_id: session.id,
      },
    });

    return NextResponse.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      metaEventId: `initiate_checkout_${session.id}`,
      amount: TRIAL_AMOUNT_CENTS,
      monthlyAmount: MONTHLY_AMOUNT_CENTS,
      currency: "USD",
      flow: FLOW,
      reportKey: REPORT_KEY,
    });
  } catch (error: any) {
    console.error("Palm reading subscription checkout error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create subscription checkout" },
      { status: 500 }
    );
  }
}
