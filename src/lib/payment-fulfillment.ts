import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { randomUUID } from "crypto";

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

type PaymentStatus = "created" | "paid" | "failed";

interface EntitlementSource {
  type: string;
  bundleId: string;
  feature: string;
  featuresCsv: string;
  offerIds: string;
  coins: number;
}

interface StripeFulfillmentInput {
  stripeSessionId?: string | null;
  paymentIntentId?: string | null;
  stripeCustomerId?: string | null;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
  amount?: number | null;
  currency?: string | null;
  createdAtIso?: string | null;
  paymentStatus?: PaymentStatus;
}

interface StripePaymentStatusInput {
  stripeSessionId?: string | null;
  paymentIntentId?: string | null;
  stripeCustomerId?: string | null;
  customerEmail?: string | null;
  metadata?: Record<string, string>;
  amount?: number | null;
  currency?: string | null;
  paymentStatus: PaymentStatus;
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
  payment_status: string | null;
  fulfilled_at: string | null;
  created_at: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
}

const PAYMENT_SELECT =
  "id,user_id,type,bundle_id,feature,coins,customer_email,amount,currency,payment_status,fulfilled_at,created_at,stripe_session_id,stripe_payment_intent_id,stripe_customer_id";

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function parseIntOrZero(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFeatures(metadata: Record<string, string>): string[] {
  const featuresCsv = metadata.features || metadata.featuresCsv || "";
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

function getEntitlementSource(metadata: Record<string, string>, existing: PaymentRow | null): EntitlementSource {
  return {
    type: metadata.type || existing?.type || "bundle",
    bundleId: metadata.bundleId || metadata.packageId || existing?.bundle_id || "",
    feature: metadata.feature || existing?.feature || "",
    featuresCsv: metadata.features || "",
    offerIds: metadata.offerIds || "",
    coins: metadata.coins ? parseIntOrZero(metadata.coins) : existing?.coins || 0,
  };
}

async function findFirstPaymentRow(
  column: "stripe_session_id" | "stripe_payment_intent_id",
  value: string
): Promise<PaymentRow | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from("payments")
    .select(PAYMENT_SELECT)
    .eq(column, value)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return (data?.[0] as PaymentRow | undefined) || null;
}

async function findPaymentMatch(
  stripeSessionId: string | null | undefined,
  paymentIntentId: string | null | undefined,
  metadata: Record<string, string>,
  customerEmail: string | null
): Promise<PaymentRow | null> {
  if (stripeSessionId) {
    const bySession = await findFirstPaymentRow("stripe_session_id", stripeSessionId);
    if (bySession) return bySession;
  }

  if (paymentIntentId) {
    const byIntent = await findFirstPaymentRow("stripe_payment_intent_id", paymentIntentId);
    if (byIntent) return byIntent;
  }

  const supabase = getSupabaseAdmin();

  if (metadata.userId) {
    let query = supabase
      .from("payments")
      .select(PAYMENT_SELECT)
      .eq("user_id", metadata.userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (metadata.type) {
      query = query.eq("type", metadata.type);
    }

    const { data, error } = await query;
    if (error) throw error;
    const first = (data?.[0] as PaymentRow | undefined) || null;
    if (first) return first;
  }

  if (customerEmail) {
    const { data, error } = await supabase
      .from("payments")
      .select(PAYMENT_SELECT)
      .eq("customer_email", customerEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    const first = (data?.[0] as PaymentRow | undefined) || null;
    if (first) return first;
  }

  return null;
}

async function applyUserEntitlements(userId: string | null, source: EntitlementSource, stripeCustomerId: string | null, nowIso: string) {
  if (!userId) return;

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

  if (source.type === "bundle") {
    const features = BUNDLE_FEATURES[source.bundleId] || [];
    for (const feature of features) updatedFeatures[feature] = true;
    updatedCoins += BUNDLE_COIN_BONUS[source.bundleId] || 0;
  }

  if (source.type === "upsell") {
    const explicitFeatures = parseFeatures({
      feature: source.feature,
      features: source.featuresCsv,
    });
    const inferredOfferIds = source.offerIds || source.bundleId;
    const mappedOfferFeatures = mapOfferIdsToFeatures(inferredOfferIds);

    if (source.bundleId === "ultra-pack") {
      mappedOfferFeatures.push("prediction2026", "birthChart", "compatibilityTest");
    }

    for (const feature of [...explicitFeatures, ...mappedOfferFeatures]) {
      updatedFeatures[feature] = true;
    }
  }

  if (source.type === "report") {
    const explicitFeatures = parseFeatures({
      feature: source.feature,
      features: source.featuresCsv,
    });
    for (const feature of explicitFeatures) {
      updatedFeatures[feature] = true;
    }
  }

  if (source.type === "coins") {
    updatedCoins += source.coins || 0;
  }

  const userUpdate: Record<string, any> = {
    id: userId,
    unlocked_features: updatedFeatures,
    coins: updatedCoins,
    payment_status: "paid",
    updated_at: nowIso,
  };

  if (source.type === "bundle") {
    userUpdate.bundle_purchased = source.bundleId || null;
  }

  userUpdate.purchase_type = source.type;

  // Try stripe_customer_id if schema supports it.
  if (stripeCustomerId) {
    userUpdate.stripe_customer_id = stripeCustomerId;
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

async function upsertPaidPaymentRecord(input: StripeFulfillmentInput, nowIso: string) {
  const metadata = (input.metadata || {}) as Record<string, string>;
  const customerEmail = normalizeEmail(input.customerEmail);
  const supabase = getSupabaseAdmin();

  const existing = await findPaymentMatch(
    input.stripeSessionId,
    input.paymentIntentId,
    metadata,
    customerEmail
  );

  if (existing?.payment_status === "paid") {
    return { row: existing, alreadyPaid: true };
  }

  const userId = metadata.userId || existing?.user_id || null;
  const type = metadata.type || existing?.type || "bundle";
  const bundleId = metadata.bundleId || metadata.packageId || existing?.bundle_id || null;
  const feature = metadata.feature || existing?.feature || null;
  const coins = metadata.coins ? parseIntOrZero(metadata.coins) : existing?.coins || null;

  const payload: Record<string, any> = {
    user_id: userId,
    type,
    bundle_id: bundleId,
    feature,
    coins,
    customer_email: customerEmail || existing?.customer_email || null,
    amount: typeof input.amount === "number" ? input.amount : existing?.amount || 0,
    currency: (input.currency || existing?.currency || "USD").toUpperCase(),
    payment_status: "paid",
    fulfilled_at: nowIso,
    stripe_session_id: input.stripeSessionId || existing?.stripe_session_id || null,
    stripe_payment_intent_id: input.paymentIntentId || existing?.stripe_payment_intent_id || null,
    stripe_customer_id: input.stripeCustomerId || existing?.stripe_customer_id || null,
  };

  if (existing) {
    const { error } = await supabase.from("payments").update(payload).eq("id", existing.id);
    if (error) throw error;

    const { data: updatedRow, error: updatedError } = await supabase
      .from("payments")
      .select(PAYMENT_SELECT)
      .eq("id", existing.id)
      .single();

    if (updatedError) throw updatedError;
    return { row: updatedRow as PaymentRow, alreadyPaid: false };
  }

  const insertRow = {
    id: input.stripeSessionId || input.paymentIntentId || `pay_${randomUUID()}`,
    ...payload,
    created_at: input.createdAtIso || nowIso,
  };

  const { error } = await supabase.from("payments").insert(insertRow);
  if (error) throw error;

  return { row: insertRow as PaymentRow, alreadyPaid: false };
}

export async function markStripePaymentStatus(input: StripePaymentStatusInput): Promise<void> {
  const metadata = (input.metadata || {}) as Record<string, string>;
  const customerEmail = normalizeEmail(input.customerEmail);
  const nowIso = new Date().toISOString();
  const supabase = getSupabaseAdmin();

  const existing = await findPaymentMatch(
    input.stripeSessionId,
    input.paymentIntentId,
    metadata,
    customerEmail
  );

  const payload: Record<string, any> = {
    user_id: metadata.userId || existing?.user_id || null,
    type: metadata.type || existing?.type || "bundle",
    bundle_id: metadata.bundleId || metadata.packageId || existing?.bundle_id || null,
    feature: metadata.feature || existing?.feature || null,
    coins: metadata.coins ? parseIntOrZero(metadata.coins) : existing?.coins || null,
    customer_email: customerEmail || existing?.customer_email || null,
    amount: typeof input.amount === "number" ? input.amount : existing?.amount || 0,
    currency: (input.currency || existing?.currency || "USD").toUpperCase(),
    payment_status: input.paymentStatus,
    fulfilled_at: input.paymentStatus === "paid" ? nowIso : existing?.fulfilled_at || null,
    stripe_session_id: input.stripeSessionId || existing?.stripe_session_id || null,
    stripe_payment_intent_id: input.paymentIntentId || existing?.stripe_payment_intent_id || null,
    stripe_customer_id: input.stripeCustomerId || existing?.stripe_customer_id || null,
  };

  if (existing) {
    const { error } = await supabase.from("payments").update(payload).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const row = {
    id: input.stripeSessionId || input.paymentIntentId || `pay_${randomUUID()}`,
    ...payload,
    created_at: nowIso,
  };

  const { error } = await supabase.from("payments").insert(row);
  if (error) throw error;
}

export async function fulfillStripePayment(input: StripeFulfillmentInput): Promise<void> {
  const status = input.paymentStatus || "paid";
  if (status !== "paid") {
    await markStripePaymentStatus({
      stripeSessionId: input.stripeSessionId,
      paymentIntentId: input.paymentIntentId,
      stripeCustomerId: input.stripeCustomerId,
      customerEmail: input.customerEmail,
      metadata: input.metadata,
      amount: input.amount,
      currency: input.currency,
      paymentStatus: status,
    });
    return;
  }

  const nowIso = new Date().toISOString();
  const { row, alreadyPaid } = await upsertPaidPaymentRecord(input, nowIso);
  if (alreadyPaid) return;

  const metadata = (input.metadata || {}) as Record<string, string>;
  const source = getEntitlementSource(metadata, row);
  const userId = metadata.userId || row.user_id || null;
  await applyUserEntitlements(userId, source, input.stripeCustomerId || row.stripe_customer_id || null, nowIso);
}

function sourceFromPaymentRow(row: PaymentRow): EntitlementSource {
  return {
    type: row.type || "bundle",
    bundleId: row.bundle_id || "",
    feature: row.feature || "",
    featuresCsv: row.feature || "",
    offerIds: row.bundle_id || "",
    coins: row.coins || 0,
  };
}

export async function reconcilePaidPaymentsForRegistration(params: {
  userId: string;
  email: string;
  anonId?: string | null;
  skipAnonEntitlementReplay?: boolean;
}): Promise<{ linkedRows: number; fulfilledRows: number }> {
  const normalizedEmail = normalizeEmail(params.email);
  if (!normalizedEmail) return { linkedRows: 0, fulfilledRows: 0 };

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("payments")
    .select(PAYMENT_SELECT)
    .eq("customer_email", normalizedEmail)
    .eq("payment_status", "paid");

  if (params.anonId) {
    query = query.or(`user_id.is.null,user_id.eq.${params.anonId}`);
  } else {
    query = query.is("user_id", null);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as PaymentRow[];
  if (rows.length === 0) return { linkedRows: 0, fulfilledRows: 0 };

  const nowIso = new Date().toISOString();
  let linkedRows = 0;
  let fulfilledRows = 0;

  for (const row of rows) {
    const { error: updateError } = await supabase
      .from("payments")
      .update({ user_id: params.userId })
      .eq("id", row.id);

    if (updateError) throw updateError;
    linkedRows += 1;

    const wasAnonLinked = !!params.anonId && row.user_id === params.anonId;
    const shouldReplayEntitlements =
      row.user_id === null || (!params.skipAnonEntitlementReplay && wasAnonLinked);

    if (shouldReplayEntitlements) {
      await applyUserEntitlements(params.userId, sourceFromPaymentRow(row), row.stripe_customer_id, nowIso);
      fulfilledRows += 1;
    }
  }

  return { linkedRows, fulfilledRows };
}

export async function fulfillStripeSession(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = (session.metadata || {}) as Record<string, string>;
  const sessionStatus: PaymentStatus = session.payment_status === "paid" ? "paid" : "created";

  await fulfillStripePayment({
    stripeSessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
    stripeCustomerId:
      typeof session.customer === "string" ? session.customer : session.customer?.id || null,
    customerEmail: session.customer_details?.email || session.customer_email || null,
    metadata,
    amount: session.amount_total || 0,
    currency: (session.currency || "USD").toUpperCase(),
    createdAtIso: session.created ? new Date(session.created * 1000).toISOString() : null,
    paymentStatus: sessionStatus,
  });
}
