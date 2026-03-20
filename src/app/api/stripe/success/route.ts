import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { fulfillStripeSession } from "@/lib/payment-fulfillment";

function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith("/")) return "/";
  return next;
}

function appendParam(path: string, key: string, value: string): string {
  const [pathname, query] = path.split("?");
  const params = new URLSearchParams(query || "");
  params.set(key, value);
  return `${pathname}?${params.toString()}`;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!sessionId) {
    const redirectTo = appendParam(next, "payment", "missing_session");
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    await fulfillStripeSession(session);

    const redirectTo = appendParam(appendParam(next, "session_id", sessionId), "payment", "success");
    return NextResponse.redirect(new URL(redirectTo, request.url));
  } catch (error) {
    console.error("Stripe success redirect error:", error);
    const redirectTo = appendParam(appendParam(next, "session_id", sessionId), "payment", "failed");
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }
}
