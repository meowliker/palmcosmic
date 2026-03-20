import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OFFER_ID_TO_FEATURE: Record<string, string> = {
  "2026-predictions": "prediction2026",
  "birth-chart": "birthChart",
  compatibility: "compatibilityTest",
};

const BUNDLE_FEATURES: Record<string, string[]> = {
  "palm-reading": ["palmReading"],
  "palm-birth": ["palmReading", "birthChart"],
  "palm-birth-compat": ["palmReading", "birthChart", "compatibilityTest"],
};

const BUNDLE_COIN_BONUS: Record<string, number> = {
  "palm-reading": 15,
  "palm-birth": 15,
  "palm-birth-compat": 30,
};

function parseFeatures(metadata: Record<string, string>): string[] {
  const featuresCsv = metadata.features || "";
  const fromCsv = featuresCsv
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);

  const singleFeature = metadata.feature?.trim();
  if (singleFeature) {
    return Array.from(new Set([...fromCsv, singleFeature]));
  }

  return Array.from(new Set(fromCsv));
}

function mapOfferIdsToFeatures(offerIdsCsv: string): string[] {
  return offerIdsCsv
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .map((id) => OFFER_ID_TO_FEATURE[id])
    .filter(Boolean);
}

async function upsertPaymentRecord(
  session: Stripe.Checkout.Session,
  metadata: Record<string, string>,
  nowIso: string
) {
  const supabase = getSupabaseAdmin();

  const paymentBase: Record<string, any> = {
    id: session.id,
    user_id: metadata.userId || null,
    type: metadata.type || "bundle",
    bundle_id: metadata.bundleId || metadata.packageId || null,
    feature: metadata.feature || null,
    coins: metadata.coins ? parseInt(metadata.coins, 10) : null,
    customer_email: session.customer_details?.email || session.customer_email || null,
    amount: session.amount_total || 0,
    currency: (session.currency || "usd").toUpperCase(),
    payment_status: session.payment_status === "paid" ? "paid" : "created",
    fulfilled_at: session.payment_status === "paid" ? nowIso : null,
    created_at: session.created ? new Date(session.created * 1000).toISOString() : nowIso,
  };

  // Try writing Stripe-specific fields if schema has them.
  const withStripeFields = {
    ...paymentBase,
    stripe_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || null,
    stripe_customer_id:
      typeof session.customer === "string" ? session.customer : session.customer?.id || null,
  };

  let { error } = await supabase.from("payments").upsert(withStripeFields, { onConflict: "id" });

  if (!error) return;

  // Fallback for older schema without stripe_* columns.
  if (error.message?.toLowerCase().includes("stripe_")) {
    const retry = await supabase.from("payments").upsert(paymentBase, { onConflict: "id" });
    if (!retry.error) return;
    error = retry.error;
  }

  throw error;
}

async function applyUserEntitlements(session: Stripe.Checkout.Session, metadata: Record<string, string>, nowIso: string) {
  if (session.payment_status !== "paid") return;

  const userId = metadata.userId;
  if (!userId) return;

  const type = metadata.type || "bundle";
  const bundleId = metadata.bundleId || "";
  const offerIds = metadata.offerIds || "";

  const supabase = getSupabaseAdmin();

  const { data: existingUser } = await supabase
    .from("users")
    .select("unlocked_features, coins")
    .eq("id", userId)
    .maybeSingle();

  const currentFeatures = existingUser?.unlocked_features || {
    palmReading: false,
    prediction2026: false,
    birthChart: false,
    compatibilityTest: false,
  };
  let updatedFeatures = { ...currentFeatures } as Record<string, boolean>;
  let updatedCoins = existingUser?.coins || 0;

  if (type === "bundle") {
    const features = BUNDLE_FEATURES[bundleId] || [];
    for (const feature of features) updatedFeatures[feature] = true;
    updatedCoins += BUNDLE_COIN_BONUS[bundleId] || 0;
  }

  if (type === "upsell") {
    const explicitFeatures = parseFeatures(metadata);
    const mappedOfferFeatures = mapOfferIdsToFeatures(offerIds);
    for (const feature of [...explicitFeatures, ...mappedOfferFeatures]) {
      updatedFeatures[feature] = true;
    }
  }

  if (type === "report") {
    const explicitFeatures = parseFeatures(metadata);
    for (const feature of explicitFeatures) {
      updatedFeatures[feature] = true;
    }
  }

  if (type === "coins") {
    updatedCoins += metadata.coins ? parseInt(metadata.coins, 10) : 0;
  }

  const userUpdate: Record<string, any> = {
    id: userId,
    unlocked_features: updatedFeatures,
    coins: updatedCoins,
    payment_status: "paid",
    updated_at: nowIso,
  };

  if (type === "bundle") {
    userUpdate.bundle_purchased = bundleId || null;
  }

  userUpdate.purchase_type = type;

  // Try stripe_customer_id if schema supports it.
  if (typeof session.customer === "string") {
    userUpdate.stripe_customer_id = session.customer;
  }

  let { error } = await supabase.from("users").upsert(userUpdate, { onConflict: "id" });

  if (!error) return;

  // Fallback for older schema without stripe_customer_id.
  if (error.message?.toLowerCase().includes("stripe_customer_id")) {
    delete userUpdate.stripe_customer_id;
    const retry = await supabase.from("users").upsert(userUpdate, { onConflict: "id" });
    if (!retry.error) return;
    error = retry.error;
  }

  throw error;
}

export async function fulfillStripeSession(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const nowIso = new Date().toISOString();

  await upsertPaymentRecord(session, metadata, nowIso);
  await applyUserEntitlements(session, metadata, nowIso);
}
