import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripeClient } from "@/lib/stripe";
import { fulfillStripePayment, fulfillStripeSession, markStripePaymentStatus } from "@/lib/payment-fulfillment";

interface ReconcileBody {
  secret?: string;
  staleMinutes?: number;
  limit?: number;
}

interface PaymentRow {
  id: string;
  user_id: string | null;
  type: string | null;
  bundle_id: string | null;
  feature: string | null;
  coins: number | null;
  customer_email: string | null;
  amount: number | null;
  currency: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  payment_status: string | null;
  created_at: string | null;
}

function getIntentCustomerEmail(intent: Stripe.PaymentIntent, fallback: string | null): string | null {
  const fromMetadata = intent.metadata?.email || intent.metadata?.customer_email;
  return intent.receipt_email || fromMetadata || fallback;
}

function getAuthSecret(request: NextRequest, bodySecret?: string): string | null {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  const headerSecret = request.headers.get("x-cron-secret");
  return bearer || headerSecret || bodySecret || null;
}

function toMetadata(row: PaymentRow): Record<string, string> {
  const metadata: Record<string, string> = {};
  if (row.user_id) metadata.userId = row.user_id;
  if (row.type) metadata.type = row.type;
  if (row.bundle_id) metadata.bundleId = row.bundle_id;
  if (row.feature) metadata.feature = row.feature;
  if (row.coins !== null && row.coins !== undefined) metadata.coins = String(row.coins);
  return metadata;
}

export async function POST(request: NextRequest) {
  try {
    const body: ReconcileBody = await request.json().catch(() => ({}));
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
    }

    const providedSecret = getAuthSecret(request, body.secret);
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const staleMinutes = Math.max(5, Math.min(60, body.staleMinutes || 15));
    const limit = Math.max(1, Math.min(500, body.limit || 100));
    const thresholdIso = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

    const supabase = getSupabaseAdmin();
    const stripe = getStripeClient();

    const { data, error } = await supabase
      .from("payments")
      .select(
        "id,user_id,type,bundle_id,feature,coins,customer_email,amount,currency,stripe_session_id,stripe_payment_intent_id,stripe_customer_id,payment_status,created_at"
      )
      .eq("payment_status", "created")
      .lt("created_at", thresholdIso)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const rows = (data || []) as PaymentRow[];
    let reconciledPaid = 0;
    let markedFailed = 0;
    let stillPending = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        if (row.stripe_session_id) {
          const session = await stripe.checkout.sessions.retrieve(row.stripe_session_id);

          if (session.payment_status === "paid") {
            await fulfillStripeSession(session);
            reconciledPaid += 1;
            continue;
          }

          if (session.status === "expired") {
            await markStripePaymentStatus({
              stripeSessionId: session.id,
              paymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id || null,
              stripeCustomerId:
                typeof session.customer === "string" ? session.customer : session.customer?.id || null,
              customerEmail: session.customer_details?.email || session.customer_email || row.customer_email,
              metadata: { ...toMetadata(row), ...(session.metadata || {}) },
              amount: session.amount_total || row.amount || 0,
              currency: (session.currency || row.currency || "USD").toUpperCase(),
              paymentStatus: "failed",
            });
            markedFailed += 1;
            continue;
          }

          stillPending += 1;
          continue;
        }

        if (row.stripe_payment_intent_id) {
          const intent = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id);

          if (intent.status === "succeeded") {
            await fulfillStripePayment({
              paymentIntentId: intent.id,
              stripeSessionId: row.stripe_session_id,
              stripeCustomerId:
                typeof intent.customer === "string" ? intent.customer : intent.customer?.id || row.stripe_customer_id,
              customerEmail: getIntentCustomerEmail(intent, row.customer_email),
              metadata: { ...toMetadata(row), ...(intent.metadata || {}) },
              amount: intent.amount_received || intent.amount || row.amount || 0,
              currency: (intent.currency || row.currency || "USD").toUpperCase(),
              paymentStatus: "paid",
            });
            reconciledPaid += 1;
            continue;
          }

          if (intent.status === "canceled" || intent.status === "requires_payment_method") {
            await markStripePaymentStatus({
              paymentIntentId: intent.id,
              stripeSessionId: row.stripe_session_id,
              stripeCustomerId:
                typeof intent.customer === "string" ? intent.customer : intent.customer?.id || row.stripe_customer_id,
              customerEmail: getIntentCustomerEmail(intent, row.customer_email),
              metadata: { ...toMetadata(row), ...(intent.metadata || {}) },
              amount: intent.amount || row.amount || 0,
              currency: (intent.currency || row.currency || "USD").toUpperCase(),
              paymentStatus: "failed",
            });
            markedFailed += 1;
            continue;
          }

          stillPending += 1;
          continue;
        }

        stillPending += 1;
      } catch (rowErr) {
        errors += 1;
        console.error("[reconcile-stripe-payments] row error", row.id, rowErr);
      }
    }

    return NextResponse.json({
      success: true,
      scanned: rows.length,
      staleMinutes,
      reconciledPaid,
      markedFailed,
      stillPending,
      errors,
    });
  } catch (error: any) {
    console.error("[reconcile-stripe-payments] error", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to reconcile payments" },
      { status: 500 }
    );
  }
}
