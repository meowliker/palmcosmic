export type StripeCheckoutType = "bundle" | "upsell" | "coins" | "report";

export interface StripeCheckoutPayload {
  type: StripeCheckoutType;
  bundleId?: string;
  packageId?: string;
  userId?: string;
  email?: string;
  firstName?: string;
  successPath?: string;
  cancelPath?: string;
  offerIds?: string;
}

export async function startStripeCheckout(payload: StripeCheckoutPayload): Promise<void> {
  const response = await fetch("/api/stripe/create-checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || !data?.url) {
    throw new Error(data?.error || "Unable to start Stripe checkout");
  }

  window.location.href = data.url;
}
