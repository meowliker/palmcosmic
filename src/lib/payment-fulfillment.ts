import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getStripeClient } from "@/lib/stripe";
import { randomUUID } from "crypto";
import { sendMetaConversionEvent } from "@/lib/meta-conversions";
import {
  activateExtraReportPurchase,
  activateTrialPrimaryEntitlements,
  getPrimaryReportsForFlow,
  type ReportKey,
  type FlowKey,
} from "@/lib/report-entitlements";
import { ensureAndLinkReportsForUser } from "@/lib/user-report-links";

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
  "palm-birth-compat": 15,
};

const SUBSCRIPTION_TRIAL_TYPES = new Set(["subscription_trial", "future_prediction_subscription"]);
const VALID_FLOW_KEYS = new Set<FlowKey>([
  "palm_reading",
  "future_prediction",
  "soulmate_sketch",
  "future_partner",
  "compatibility",
]);

const FEATURE_TO_REPORT_KEY: Record<string, string> = {
  palmReading: "palm_reading",
  birthChart: "birth_chart",
  soulmateSketch: "soulmate_sketch",
  futurePartnerReport: "future_partner",
  prediction2026: "prediction_2026",
  compatibilityTest: "compatibility",
};

const VALID_REPORT_KEYS = new Set<ReportKey>([
  "palm_reading",
  "birth_chart",
  "soulmate_sketch",
  "future_partner",
  "prediction_2026",
  "compatibility",
]);

function reportKeyFromFeature(feature: string): ReportKey | null {
  const reportKey = FEATURE_TO_REPORT_KEY[feature];
  return VALID_REPORT_KEYS.has(reportKey as ReportKey) ? (reportKey as ReportKey) : null;
}

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
  metadata?: Record<string, unknown> | null;
}

const PAYMENT_SELECT =
  "id,user_id,type,bundle_id,feature,coins,customer_email,amount,currency,payment_status,fulfilled_at,created_at,stripe_session_id,stripe_payment_intent_id,stripe_customer_id,metadata";

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

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "campaign_id",
  "adset_id",
  "ad_id",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
  "landing_page",
] as const;

function pickAttribution(metadata: Record<string, unknown> | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!metadata || typeof metadata !== "object") return out;

  for (const key of ATTRIBUTION_KEYS) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }

  if (!out.campaign_id && out.meta_campaign_id) out.campaign_id = out.meta_campaign_id;
  if (!out.adset_id && out.meta_adset_id) out.adset_id = out.meta_adset_id;
  if (!out.ad_id && out.meta_ad_id) out.ad_id = out.meta_ad_id;

  return out;
}

async function findLatestAttribution(
  userId: string | null,
  email: string | null
): Promise<Record<string, string>> {
  if (!userId && !email) return {};
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from("analytics_events")
    .select("metadata")
    .order("created_at", { ascending: false })
    .limit(25);

  if (userId && email) {
    query = query.or(`user_id.eq.${userId},email.eq.${email}`);
  } else if (userId) {
    query = query.eq("user_id", userId);
  } else if (email) {
    query = query.eq("email", email);
  }

  const { data, error } = await query;
  if (error || !data?.length) return {};

  for (const row of data) {
    const attribution = pickAttribution(row.metadata as Record<string, unknown>);
    if (Object.keys(attribution).length > 0) return attribution;
  }

  return {};
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
    let query = supabase
      .from("payments")
      .select(PAYMENT_SELECT)
      .eq("customer_email", customerEmail)
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

  return null;
}

async function resolveSafeUserId(candidateUserId: string | null | undefined): Promise<string | null> {
  if (!candidateUserId) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", candidateUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.id || null;
}

async function applyUserEntitlements(
  userId: string | null,
  source: EntitlementSource,
  stripeCustomerId: string | null,
  nowIso: string,
  customerEmail?: string | null,
  stripeSessionId?: string | null
) {
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

    const reportKey = reportKeyFromFeature(explicitFeatures[0] || source.feature);
    if (reportKey && userId) {
      await activateExtraReportPurchase({
        userId,
        email: customerEmail,
        reportKey,
        stripeCustomerId,
        stripeSessionId,
      });
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

  if (!error) {
    const reportKeys = Object.entries(FEATURE_TO_REPORT_KEY)
      .filter(([feature]) => updatedFeatures[feature] === true)
      .map(([, reportKey]) => reportKey);

    if (reportKeys.length > 0) {
      await ensureAndLinkReportsForUser({
        supabase,
        userId,
        email: customerEmail,
        reportKeys,
      });
    }

    return;
  }

  // Fallback for older schema without stripe_customer_id.
  if (error.message?.toLowerCase().includes("stripe_customer_id")) {
    delete userUpdate.stripe_customer_id;
    const retry = await supabase.from("users").upsert(userUpdate, { onConflict: "id" });
    if (!retry.error) {
      const reportKeys = Object.entries(FEATURE_TO_REPORT_KEY)
        .filter(([feature]) => updatedFeatures[feature] === true)
        .map(([, reportKey]) => reportKey);

      if (reportKeys.length > 0) {
        await ensureAndLinkReportsForUser({
          supabase,
          userId,
          email: customerEmail,
          reportKeys,
        });
      }

      return;
    }
    error = retry.error;
  }

  throw error;
}

function isSubscriptionTrialSession(session: Stripe.Checkout.Session, metadata: Record<string, string>) {
  return session.mode === "subscription" || SUBSCRIPTION_TRIAL_TYPES.has(metadata.type || "");
}

function resolveSubscriptionFlow(metadata: Record<string, string>): FlowKey {
  const flow = metadata.flow as FlowKey;
  if (VALID_FLOW_KEYS.has(flow)) return flow;
  throw new Error(`Unsupported subscription flow: ${metadata.flow || "missing"}`);
}

function assertSubscriptionReportMatchesFlow(flow: FlowKey, reportKey: string) {
  const allowedReports = getPrimaryReportsForFlow(flow);
  if (!allowedReports.some((allowedReport) => allowedReport === reportKey)) {
    throw new Error(`Report ${reportKey || "missing"} is not valid for subscription flow ${flow}`);
  }
}

function subscriptionUnix(subscription: Stripe.Subscription, key: string): number | null {
  const direct = (subscription as any)[key];
  if (typeof direct === "number") return direct;

  const firstItem = (subscription as any).items?.data?.[0];
  const fromItem = firstItem?.[key];
  return typeof fromItem === "number" ? fromItem : null;
}

async function fulfillSubscriptionTrialSession(session: Stripe.Checkout.Session, metadata: Record<string, string>) {
  const supabase = getSupabaseAdmin();
  const stripeSubscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;

  const userId = metadata.userId || "";
  if (!userId) {
    throw new Error("Subscription checkout missing userId metadata");
  }

  let trialStartedAt = new Date();
  let trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  let stripeCustomerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id || null;

  if (stripeSubscriptionId) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    stripeCustomerId =
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id || stripeCustomerId;

    const trialStart = subscriptionUnix(subscription, "trial_start");
    const trialEnd = subscriptionUnix(subscription, "trial_end");
    if (trialStart) {
      trialStartedAt = new Date(trialStart * 1000);
    }
    if (trialEnd) {
      trialEndsAt = new Date(trialEnd * 1000);
    }
  }

  const customerEmail = normalizeEmail(
    session.customer_details?.email || session.customer_email || metadata.email || null
  );
  const amount = typeof session.amount_total === "number" ? session.amount_total : 99;
  const currency = (session.currency || "USD").toUpperCase();
  const nowIso = new Date().toISOString();
  const flow = resolveSubscriptionFlow(metadata);
  const reportKey = metadata.reportKey || metadata.primaryReport || "prediction_2026";
  assertSubscriptionReportMatchesFlow(flow, reportKey);
  const productName = metadata.productName || "2026 Prediction Report";

  await markStripePaymentStatus({
    stripeSessionId: session.id,
    paymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
    stripeCustomerId,
    customerEmail,
    metadata,
    amount,
    currency,
    paymentStatus: "paid",
  });

  const { error: paymentUpdateError } = await supabase
    .from("payments")
    .update({
      flow,
      report_key: reportKey,
      billing_kind: metadata.billingKind || metadata.type || "subscription_trial",
      stripe_subscription_id: stripeSubscriptionId,
      metadata,
      updated_at: nowIso,
    })
    .eq("stripe_session_id", session.id);

  if (paymentUpdateError) throw paymentUpdateError;

  await activateTrialPrimaryEntitlements({
    userId,
    email: customerEmail,
    flow,
    stripeCustomerId,
    stripeSubscriptionId,
    stripeSessionId: session.id,
    trialStartedAt,
    trialEndsAt,
  });

  await sendMetaConversionEvent({
    eventName: "Purchase",
    eventId: `purchase_${session.id}`,
    email: customerEmail,
    userId,
    value: amount / 100,
    currency,
    contentName: `${productName} Trial`,
    contentIds: [reportKey],
    contentType: "subscription",
    customData: {
      payment_provider: "stripe",
      purchase_type: metadata.type || "subscription_trial",
      flow,
      report_key: reportKey,
      stripe_session_id: session.id,
      stripe_subscription_id: stripeSubscriptionId,
      trial_end: trialEndsAt.toISOString(),
    },
  });
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

  const userId = await resolveSafeUserId(metadata.userId || existing?.user_id || null);
  const attribution = await findLatestAttribution(userId, customerEmail || existing?.customer_email || null);
  const enrichedMetadata = {
    ...attribution,
    ...metadata,
  };
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
    metadata: {
      ...((existing?.metadata || {}) as Record<string, unknown>),
      ...enrichedMetadata,
    },
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

  const userId = await resolveSafeUserId(metadata.userId || existing?.user_id || null);
  const attribution = await findLatestAttribution(userId, customerEmail || existing?.customer_email || null);
  const enrichedMetadata = {
    ...attribution,
    ...metadata,
  };

  const payload: Record<string, any> = {
    user_id: userId,
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
    metadata: {
      ...((existing?.metadata || {}) as Record<string, unknown>),
      ...enrichedMetadata,
    },
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
  await applyUserEntitlements(
    userId,
    source,
    input.stripeCustomerId || row.stripe_customer_id || null,
    nowIso,
    input.customerEmail || row.customer_email || null,
    input.stripeSessionId || row.stripe_session_id || null
  );
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
      await applyUserEntitlements(
        params.userId,
        sourceFromPaymentRow(row),
        row.stripe_customer_id,
        nowIso,
        normalizedEmail
      );
      fulfilledRows += 1;
    }
  }

  return { linkedRows, fulfilledRows };
}

export async function fulfillStripeSession(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = (session.metadata || {}) as Record<string, string>;
  if (isSubscriptionTrialSession(session, metadata)) {
    await fulfillSubscriptionTrialSession(session, metadata);
    return;
  }

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

  if (sessionStatus === "paid") {
    await sendMetaConversionEvent({
      eventName: "Purchase",
      eventId: `purchase_${session.id}`,
      email: session.customer_details?.email || session.customer_email || null,
      userId: metadata.userId || null,
      value: typeof session.amount_total === "number" ? session.amount_total / 100 : null,
      currency: (session.currency || "USD").toUpperCase(),
      contentName: metadata.bundleId || metadata.packageId || metadata.feature || "Stripe Purchase",
      contentIds: [metadata.bundleId || metadata.packageId || metadata.feature || metadata.type || "stripe_purchase"],
      contentType: "product",
      customData: {
        payment_provider: "stripe",
        purchase_type: metadata.type || "unknown",
        stripe_session_id: session.id,
      },
    });
  }
}
