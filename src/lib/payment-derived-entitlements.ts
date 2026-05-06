import { REPORT_TO_UNLOCKED_FEATURE, type ReportKey } from "@/lib/report-entitlements";
import { normalizeUnlockedFeatures, type NormalizedUnlockedFeatures } from "@/lib/unlocked-features";

const ONE_TIME_PAYMENT_TYPES = ["bundle", "upsell", "report", "coins"] as const;

const BUNDLE_FEATURES: Record<string, Array<keyof NormalizedUnlockedFeatures>> = {
  "palm-reading": ["palmReading"],
  "palm-birth": ["palmReading", "birthChart"],
  "palm-birth-sketch": ["palmReading", "birthChart", "soulmateSketch", "futurePartnerReport"],
  "palm-birth-compat": ["palmReading", "birthChart", "compatibilityTest", "futurePartnerReport"],
};

const OFFER_FEATURES: Record<string, Array<keyof NormalizedUnlockedFeatures>> = {
  "2026-predictions": ["prediction2026"],
  "birth-chart": ["birthChart"],
  compatibility: ["compatibilityTest"],
  "soulmate-sketch": ["soulmateSketch"],
  "future-partner": ["futurePartnerReport"],
};

const REPORT_PACKAGE_FEATURES: Record<string, keyof NormalizedUnlockedFeatures> = {
  "report-palm": "palmReading",
  "report-2026": "prediction2026",
  "report-birth-chart": "birthChart",
  "report-compatibility": "compatibilityTest",
  "report-soulmate-sketch": "soulmateSketch",
  "report-future-partner": "futurePartnerReport",
};

type SupabaseAdmin = {
  from: (table: string) => any;
};

type PaymentRow = {
  type?: string | null;
  bundle_id?: string | null;
  feature?: string | null;
  metadata?: Record<string, unknown> | null;
};

function setFeature(features: NormalizedUnlockedFeatures, key: unknown) {
  if (typeof key === "string" && key in features) {
    features[key as keyof NormalizedUnlockedFeatures] = true;
  }
}

function applyFeatureList(features: NormalizedUnlockedFeatures, keys: Array<keyof NormalizedUnlockedFeatures> | undefined) {
  for (const key of keys || []) {
    features[key] = true;
  }
}

function csvValues(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function applyPaymentRow(features: NormalizedUnlockedFeatures, row: PaymentRow) {
  const metadata = row.metadata || {};

  if (row.type === "bundle") {
    applyFeatureList(features, BUNDLE_FEATURES[row.bundle_id || ""]);
    for (const feature of csvValues(metadata.features)) setFeature(features, feature);
    return;
  }

  if (row.type === "upsell") {
    for (const offerId of csvValues(row.bundle_id || metadata.offerIds)) {
      applyFeatureList(features, OFFER_FEATURES[offerId]);
    }
    setFeature(features, row.feature);
    for (const feature of csvValues(metadata.features)) setFeature(features, feature);
    return;
  }

  if (row.type === "report") {
    setFeature(features, row.feature);
    setFeature(features, REPORT_PACKAGE_FEATURES[row.bundle_id || ""]);
    setFeature(features, REPORT_PACKAGE_FEATURES[String(metadata.packageId || "")]);
    for (const feature of csvValues(metadata.features)) setFeature(features, feature);
  }
}

export async function deriveUnlockedFeaturesFromPurchases(params: {
  supabase: SupabaseAdmin;
  userId: string;
  email?: string | null;
  baseFeatures?: unknown;
}) {
  const features = normalizeUnlockedFeatures(params.baseFeatures);
  const nowIso = new Date().toISOString();

  const { data: payments, error: paymentError } = await params.supabase
    .from("payments")
    .select("type,bundle_id,feature,metadata")
    .eq("payment_status", "paid")
    .in("type", ONE_TIME_PAYMENT_TYPES)
    .gte("amount", 0)
    .or(`user_id.eq.${params.userId}${params.email ? `,customer_email.eq.${params.email}` : ""}`);

  if (paymentError) throw paymentError;

  for (const row of (payments || []) as PaymentRow[]) {
    applyPaymentRow(features, row);
  }

  const { data: entitlements, error: entitlementError } = await params.supabase
    .from("user_entitlements")
    .select("report_key")
    .eq("user_id", params.userId)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

  if (entitlementError) throw entitlementError;

  for (const entitlement of entitlements || []) {
    const featureKey = REPORT_TO_UNLOCKED_FEATURE[entitlement.report_key as ReportKey];
    if (featureKey) {
      features[featureKey as keyof NormalizedUnlockedFeatures] = true;
    }
  }

  return features;
}

export function unlockedFeaturesEqual(a: unknown, b: unknown) {
  const left = normalizeUnlockedFeatures(a);
  const right = normalizeUnlockedFeatures(b);
  return (Object.keys(left) as Array<keyof NormalizedUnlockedFeatures>).every((key) => left[key] === right[key]);
}
