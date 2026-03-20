import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { fulfillStripeSession } from "@/lib/payment-fulfillment";

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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      await fulfillStripeSession(session);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Stripe webhook error:", error);
    return NextResponse.json({ error: error.message || "Webhook handling failed" }, { status: 400 });
  }
}
