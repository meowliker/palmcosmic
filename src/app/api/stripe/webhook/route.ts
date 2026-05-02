import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { fulfillStripePayment, fulfillStripeSession, markStripePaymentStatus } from "@/lib/payment-fulfillment";
import {
  activateSubscriptionAllReports,
  markSubscriptionCanceledOrLocked,
  markSubscriptionLocked,
  updateTrialSubscriptionStatus,
} from "@/lib/report-entitlements";

function getIntentCustomerEmail(intent: Stripe.PaymentIntent): string | null {
  const fromMetadata = intent.metadata?.email || intent.metadata?.customer_email;
  return intent.receipt_email || fromMetadata || null;
}

function dateFromUnix(value: number | null | undefined): Date | null {
  return value ? new Date(value * 1000) : null;
}

function subscriptionUnix(subscription: Stripe.Subscription, key: string): number | null {
  const direct = (subscription as any)[key];
  if (typeof direct === "number") return direct;

  const firstItem = (subscription as any).items?.data?.[0];
  const fromItem = firstItem?.[key];
  return typeof fromItem === "number" ? fromItem : null;
}

function getSubscriptionId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function getPreserveAccessUntil(subscription: Stripe.Subscription): Date | null {
  const candidates = [
    subscriptionUnix(subscription, "trial_end"),
    subscriptionUnix(subscription, "current_period_end"),
  ]
    .filter((value): value is number => typeof value === "number" && value > 0)
    .map((value) => new Date(value * 1000));

  if (candidates.length === 0) return null;

  return candidates.reduce((latest, candidate) => (candidate > latest ? candidate : latest));
}

async function handleSubscriptionInvoiceSucceeded(invoice: Stripe.Invoice) {
  const stripe = getStripeClient();
  const subscriptionId = getSubscriptionId((invoice as any).subscription);
  if (!subscriptionId) return;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const metadata = subscription.metadata || {};
  const userId = metadata.userId;
  if (!userId) return;

  const amountPaid = invoice.amount_paid || 0;
  const isMonthlyRenewal = amountPaid >= 900 && subscription.status === "active";
  if (!isMonthlyRenewal) return;

  const nowIso = new Date().toISOString();
  const paidAt = dateFromUnix((invoice.status_transitions as any)?.paid_at) || dateFromUnix(invoice.created) || new Date();
  const stripeCustomerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null;
  const paymentIntent = (invoice as any).payment_intent;
  const stripePaymentIntentId =
    typeof paymentIntent === "string"
      ? paymentIntent
      : paymentIntent && typeof paymentIntent === "object" && typeof paymentIntent.id === "string"
        ? paymentIntent.id
        : null;
  const email = metadata.email || invoice.customer_email || null;
  const renewalMetadata = {
    ...metadata,
    type: "subscription_renewal",
    billingKind: "subscription_renewal",
    reportKey: "all_reports",
    stripeInvoiceId: invoice.id,
  };

  const supabase = getSupabaseAdmin();
  const { error: paymentError } = await supabase.from("payments").upsert({
    id: `invoice_${invoice.id}`,
    user_id: userId,
    type: "subscription_renewal",
    bundle_id: null,
    feature: null,
    coins: null,
    customer_email: email,
    amount: amountPaid,
    currency: (invoice.currency || "usd").toUpperCase(),
    payment_status: "paid",
    fulfilled_at: paidAt.toISOString(),
    created_at: paidAt.toISOString(),
    updated_at: nowIso,
    stripe_session_id: null,
    stripe_payment_intent_id: stripePaymentIntentId,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscription.id,
    report_key: "all_reports",
    billing_kind: "subscription_renewal",
    metadata: renewalMetadata,
  }, { onConflict: "id" });

  if (paymentError) throw paymentError;

  await activateSubscriptionAllReports({
    userId,
    email,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    currentPeriodStart: dateFromUnix(subscriptionUnix(subscription, "current_period_start")),
    currentPeriodEnd: dateFromUnix(subscriptionUnix(subscription, "current_period_end")),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("stripe-signature");
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: "Missing Stripe webhook configuration" }, { status: 400 });
    }

    const payload = await request.text();
    const stripe = getStripeClient();

    const event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await fulfillStripeSession(session);
        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;

        const sessions = await stripe.checkout.sessions.list({
          payment_intent: intent.id,
          limit: 1,
        });

        const session = sessions.data?.[0];
        if (session) {
          await fulfillStripeSession(session);
        } else {
          await fulfillStripePayment({
            paymentIntentId: intent.id,
            stripeCustomerId:
              typeof intent.customer === "string" ? intent.customer : intent.customer?.id || null,
            customerEmail: getIntentCustomerEmail(intent),
            metadata: (intent.metadata || {}) as Record<string, string>,
            amount: intent.amount_received || intent.amount,
            currency: (intent.currency || "USD").toUpperCase(),
            paymentStatus: "paid",
          });
        }
        break;
      }

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        await markStripePaymentStatus({
          stripeSessionId: session.id,
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id || null,
          stripeCustomerId:
            typeof session.customer === "string" ? session.customer : session.customer?.id || null,
          customerEmail: session.customer_details?.email || session.customer_email || null,
          metadata: (session.metadata || {}) as Record<string, string>,
          amount: session.amount_total || 0,
          currency: (session.currency || "USD").toUpperCase(),
          paymentStatus: "failed",
        });
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await markStripePaymentStatus({
          paymentIntentId: intent.id,
          stripeCustomerId:
            typeof intent.customer === "string" ? intent.customer : intent.customer?.id || null,
          customerEmail: getIntentCustomerEmail(intent),
          metadata: (intent.metadata || {}) as Record<string, string>,
          amount: intent.amount || 0,
          currency: (intent.currency || "USD").toUpperCase(),
          paymentStatus: "failed",
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        await handleSubscriptionInvoiceSucceeded(invoice);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = getSubscriptionId((invoice as any).subscription);
        if (subscriptionId) {
          await markSubscriptionLocked({
            stripeSubscriptionId: subscriptionId,
            reason: "monthly_payment_failed",
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;

        if (subscription.status === "trialing") {
          await updateTrialSubscriptionStatus({
            stripeSubscriptionId: subscription.id,
            status: "trialing",
            trialEndsAt: dateFromUnix(subscriptionUnix(subscription, "trial_end")),
            currentPeriodEnd: dateFromUnix(subscriptionUnix(subscription, "current_period_end")),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        } else if (subscription.status === "active" && subscription.metadata?.userId) {
          await activateSubscriptionAllReports({
            userId: subscription.metadata.userId,
            email: subscription.metadata.email || null,
            stripeCustomerId:
              typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id || null,
            stripeSubscriptionId: subscription.id,
            currentPeriodStart: dateFromUnix(subscriptionUnix(subscription, "current_period_start")),
            currentPeriodEnd: dateFromUnix(subscriptionUnix(subscription, "current_period_end")),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        } else if (subscription.status === "canceled") {
          await markSubscriptionCanceledOrLocked({
            stripeSubscriptionId: subscription.id,
            reason: "subscription_canceled",
            preserveAccessUntil: getPreserveAccessUntil(subscription),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
          });
        } else if ([ "past_due", "unpaid", "incomplete_expired" ].includes(subscription.status)) {
          await markSubscriptionLocked({
            stripeSubscriptionId: subscription.id,
            reason: `subscription_${subscription.status}`,
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await markSubscriptionCanceledOrLocked({
          stripeSubscriptionId: subscription.id,
          reason: "subscription_deleted",
          preserveAccessUntil: getPreserveAccessUntil(subscription),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true, eventType: event.type });
  } catch (error: any) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: error.message || "Webhook handling failed" }, { status: 400 });
  }
}
