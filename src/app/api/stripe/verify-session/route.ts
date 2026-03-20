import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { fulfillStripeSession } from "@/lib/payment-fulfillment";

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ success: false, error: "Missing sessionId" }, { status: 400 });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    await fulfillStripeSession(session);

    return NextResponse.json({
      success: session.payment_status === "paid",
      sessionId: session.id,
      paymentStatus: session.payment_status,
    });
  } catch (error: any) {
    console.error("Stripe verify-session error:", error);
    return NextResponse.json({ success: false, error: error.message || "Verification failed" }, { status: 500 });
  }
}
