import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe";
import { fulfillStripePayment, fulfillStripeSession, markStripePaymentStatus } from "@/lib/payment-fulfillment";

function getIntentCustomerEmail(intent: Stripe.PaymentIntent): string | null {
  const fromMetadata = intent.metadata?.email || intent.metadata?.customer_email;
  return intent.receipt_email || fromMetadata || null;
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

      default:
        break;
    }

    return NextResponse.json({ received: true, eventType: event.type });
  } catch (error: any) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: error.message || "Webhook handling failed" }, { status: 400 });
  }
}
