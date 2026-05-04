import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { normalizeUnlockedFeatures } from "@/lib/unlocked-features";
import { ensureAndLinkReportsForUser } from "@/lib/user-report-links";

export type ReportKey =
  | "palm_reading"
  | "birth_chart"
  | "soulmate_sketch"
  | "future_partner"
  | "prediction_2026"
  | "compatibility";

export type FlowKey =
  | "palm_reading"
  | "future_prediction"
  | "soulmate_sketch"
  | "future_partner"
  | "compatibility";

export const ALL_REPORT_KEYS: ReportKey[] = [
  "palm_reading",
  "birth_chart",
  "soulmate_sketch",
  "future_partner",
  "prediction_2026",
  "compatibility",
];

export const FLOW_PRIMARY_REPORTS: Record<FlowKey, ReportKey[]> = {
  palm_reading: ["palm_reading", "birth_chart"],
  future_prediction: ["prediction_2026"],
  soulmate_sketch: ["soulmate_sketch"],
  future_partner: ["future_partner"],
  compatibility: ["compatibility"],
};

export function getPrimaryReportsForFlow(flow: FlowKey): ReportKey[] {
  return FLOW_PRIMARY_REPORTS[flow];
}

export const REPORT_TO_UNLOCKED_FEATURE: Record<ReportKey, string> = {
  palm_reading: "palmReading",
  birth_chart: "birthChart",
  soulmate_sketch: "soulmateSketch",
  future_partner: "futurePartnerReport",
  prediction_2026: "prediction2026",
  compatibility: "compatibilityTest",
};

const INITIAL_CHAT_COINS = 15;

function mergeFeatureUnlocks(current: unknown, reportKeys: ReportKey[]) {
  const normalized = normalizeUnlockedFeatures(current);
  const next: Record<string, boolean> = { ...normalized };

  for (const reportKey of reportKeys) {
    next[REPORT_TO_UNLOCKED_FEATURE[reportKey]] = true;
  }

  return next;
}

async function syncLegacyUnlockedFeaturesForUsers(supabase: any, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueUserIds.length === 0) return;

  const nowIso = new Date().toISOString();
  const { data: entitlements, error } = await supabase
    .from("user_entitlements")
    .select("user_id,report_key")
    .in("user_id", uniqueUserIds)
    .eq("status", "active")
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gt.${nowIso}`);

  if (error) throw error;

  const featuresByUser = new Map<string, ReturnType<typeof normalizeUnlockedFeatures>>();
  for (const userId of uniqueUserIds) {
    featuresByUser.set(userId, normalizeUnlockedFeatures({}));
  }

  for (const entitlement of entitlements || []) {
    const featureKey = REPORT_TO_UNLOCKED_FEATURE[entitlement.report_key as ReportKey];
    const features = featuresByUser.get(entitlement.user_id);
    if (featureKey && features) {
      (features as any)[featureKey] = true;
    }
  }

  for (const [userId, unlockedFeatures] of featuresByUser.entries()) {
    const { error: updateError } = await supabase
      .from("users")
      .update({
        unlocked_features: unlockedFeatures,
        updated_at: nowIso,
      })
      .eq("id", userId);

    if (updateError) throw updateError;
  }
}

export async function activateTrialPrimaryEntitlements(params: {
  userId: string;
  email?: string | null;
  flow: FlowKey;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeSessionId?: string | null;
  trialStartedAt: Date;
  trialEndsAt: Date;
}) {
  const supabase = getSupabaseAdmin();
  const reports = FLOW_PRIMARY_REPORTS[params.flow];
  const primaryReport = reports[0];
  const nowIso = new Date().toISOString();
  const trialStartedAtIso = params.trialStartedAt.toISOString();
  const trialEndsAtIso = params.trialEndsAt.toISOString();

  const { data: existingUser, error: userFetchError } = await supabase
    .from("users")
    .select("unlocked_features, coins")
    .eq("id", params.userId)
    .maybeSingle();

  if (userFetchError) throw userFetchError;

  const { data: existingFlowEntitlement, error: flowEntitlementLookupError } = await supabase
    .from("user_entitlements")
    .select("id")
    .eq("user_id", params.userId)
    .eq("report_key", primaryReport)
    .eq("source", "trial_primary")
    .eq("status", "active")
    .maybeSingle();

  if (flowEntitlementLookupError) throw flowEntitlementLookupError;

  const shouldGrantInitialCoins = !existingFlowEntitlement?.id;
  const unlockedFeatures = mergeFeatureUnlocks(existingUser?.unlocked_features, reports);
  const currentCoins = Number(existingUser?.coins || 0);

  const userUpdate: Record<string, any> = {
    id: params.userId,
    email: params.email || undefined,
    unlocked_features: unlockedFeatures,
    coins: currentCoins + (shouldGrantInitialCoins ? INITIAL_CHAT_COINS : 0),
    is_subscribed: true,
    subscription_status: "trialing",
    access_status: "trial_active",
    primary_flow: params.flow,
    primary_report: primaryReport,
    trial_started_at: trialStartedAtIso,
    trial_ends_at: trialEndsAtIso,
    subscription_cancel_at_period_end: false,
    subscription_locked_at: null,
    subscription_lock_reason: null,
    subscription_plan: "monthly_9_after_trial",
    stripe_customer_id: params.stripeCustomerId || undefined,
    stripe_subscription_id: params.stripeSubscriptionId || undefined,
    payment_status: "paid",
    purchase_type: "subscription_trial",
    updated_at: nowIso,
  };

  Object.keys(userUpdate).forEach((key) => {
    if (userUpdate[key] === undefined) delete userUpdate[key];
  });

  const { error: upsertError } = await supabase
    .from("users")
    .upsert(userUpdate, { onConflict: "id" });

  if (upsertError) throw upsertError;

  for (const reportKey of reports) {
    const entitlementPayload = {
      user_id: params.userId,
      report_key: reportKey,
      source: "trial_primary",
      status: "active",
      starts_at: trialStartedAtIso,
      ends_at: trialEndsAtIso,
      stripe_subscription_id: params.stripeSubscriptionId || null,
      stripe_session_id: params.stripeSessionId || null,
      metadata: {
        flow: params.flow,
        trial_days: 3,
        plan: "0.99_trial_then_9_monthly",
      },
      updated_at: nowIso,
    };

    const { data: existingEntitlement, error: entitlementLookupError } = await supabase
      .from("user_entitlements")
      .select("id")
      .eq("user_id", params.userId)
      .eq("report_key", reportKey)
      .eq("source", "trial_primary")
      .eq("status", "active")
      .maybeSingle();

    if (entitlementLookupError) throw entitlementLookupError;

    if (existingEntitlement?.id) {
      const { error } = await supabase
        .from("user_entitlements")
        .update(entitlementPayload)
        .eq("id", existingEntitlement.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_entitlements")
        .insert({
          id: `ent_${randomUUID()}`,
          ...entitlementPayload,
        });

      if (error) throw error;
    }
  }

  await ensureAndLinkReportsForUser({
    supabase,
    userId: params.userId,
    email: params.email,
    reportKeys: reports,
  });

  return { reports, primaryReport };
}

export async function activateFutureAllReportEntitlements(params: {
  userId: string;
  email?: string | null;
  source: string;
  startsAt: Date;
  stripeSubscriptionId?: string | null;
  stripeSessionId?: string | null;
  metadata?: Record<string, any>;
}) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const startsAtIso = params.startsAt.toISOString();

  await ensureAndLinkReportsForUser({
    supabase,
    userId: params.userId,
    email: params.email,
    reportKeys: ALL_REPORT_KEYS,
  });

  for (const reportKey of ALL_REPORT_KEYS) {
    const entitlementPayload = {
      user_id: params.userId,
      report_key: reportKey,
      source: params.source,
      status: "active",
      starts_at: startsAtIso,
      ends_at: null,
      stripe_subscription_id: params.stripeSubscriptionId || null,
      stripe_session_id: params.stripeSessionId || null,
      metadata: params.metadata || {},
      updated_at: nowIso,
    };

    const { data: existingEntitlement, error: entitlementLookupError } = await supabase
      .from("user_entitlements")
      .select("id")
      .eq("user_id", params.userId)
      .eq("report_key", reportKey)
      .eq("source", params.source)
      .eq("status", "active")
      .maybeSingle();

    if (entitlementLookupError) throw entitlementLookupError;

    if (existingEntitlement?.id) {
      const { error } = await supabase
        .from("user_entitlements")
        .update(entitlementPayload)
        .eq("id", existingEntitlement.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("user_entitlements")
        .insert({
          id: `ent_${randomUUID()}`,
          ...entitlementPayload,
        });
      if (error) throw error;
    }
  }
}

export async function markSubscriptionLocked(params: {
  stripeSubscriptionId: string;
  reason: string;
  lockAt?: Date;
}) {
  const supabase = getSupabaseAdmin();
  const lockAtIso = (params.lockAt || new Date()).toISOString();
  const nowIso = new Date().toISOString();

  const { data: affectedUsers, error: affectedUsersError } = await supabase
    .from("users")
    .select("id")
    .eq("stripe_subscription_id", params.stripeSubscriptionId);

  if (affectedUsersError) throw affectedUsersError;

  const { error: userError } = await supabase
    .from("users")
    .update({
      access_status: "locked",
      subscription_status: "locked",
      is_subscribed: false,
      subscription_locked_at: lockAtIso,
      subscription_lock_reason: params.reason,
      updated_at: nowIso,
    })
    .eq("stripe_subscription_id", params.stripeSubscriptionId);

  if (userError) throw userError;

  const { error: entitlementError } = await supabase
    .from("user_entitlements")
    .update({
      status: "locked",
      updated_at: nowIso,
    })
    .eq("stripe_subscription_id", params.stripeSubscriptionId)
    .eq("source", "subscription_all");

  if (entitlementError) throw entitlementError;

  await syncLegacyUnlockedFeaturesForUsers(
    supabase,
    (affectedUsers || []).map((user: { id: string }) => user.id)
  );
}

export async function markSubscriptionCanceledOrLocked(params: {
  stripeSubscriptionId: string;
  reason: string;
  preserveAccessUntil?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const preserveUntil = params.preserveAccessUntil;

  if (!preserveUntil || preserveUntil <= now) {
    await markSubscriptionLocked({
      stripeSubscriptionId: params.stripeSubscriptionId,
      reason: params.reason,
    });
    return { locked: true, preservedUntil: null };
  }

  const { data: user, error: userLookupError } = await supabase
    .from("users")
    .select("subscription_status,access_status,trial_ends_at,subscription_current_period_end")
    .eq("stripe_subscription_id", params.stripeSubscriptionId)
    .maybeSingle();

  if (userLookupError) throw userLookupError;

  const preserveUntilIso = preserveUntil.toISOString();
  const isTrialWindow =
    user?.subscription_status === "trialing" ||
    user?.access_status === "trial_active" ||
    (user?.trial_ends_at && new Date(user.trial_ends_at) >= preserveUntil);

  const { error: userError } = await supabase
    .from("users")
    .update({
      subscription_status: isTrialWindow ? "trial_cancelled" : "cancelled",
      access_status: isTrialWindow ? "trial_active" : "subscription_active",
      subscription_cancel_at_period_end: params.cancelAtPeriodEnd ?? true,
      subscription_current_period_end: isTrialWindow ? user?.subscription_current_period_end || null : preserveUntilIso,
      trial_ends_at: isTrialWindow ? preserveUntilIso : user?.trial_ends_at || null,
      subscription_locked_at: null,
      subscription_lock_reason: `pending_${params.reason}`,
      updated_at: now.toISOString(),
    })
    .eq("stripe_subscription_id", params.stripeSubscriptionId);

  if (userError) throw userError;

  // Paid subscription entitlements should expire at the paid period end.
  // Trial-primary entitlements already carry their trial end date from checkout fulfillment.
  if (!isTrialWindow) {
    const { error: entitlementError } = await supabase
      .from("user_entitlements")
      .update({
        ends_at: preserveUntilIso,
        updated_at: now.toISOString(),
      })
      .eq("stripe_subscription_id", params.stripeSubscriptionId)
      .eq("source", "subscription_all")
      .eq("status", "active");

    if (entitlementError) throw entitlementError;
  }

  return { locked: false, preservedUntil: preserveUntil };
}

export async function activateSubscriptionAllReports(params: {
  userId: string;
  email?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId: string;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();
  const startsAtIso = (params.currentPeriodStart || new Date()).toISOString();
  const endsAtIso = params.currentPeriodEnd?.toISOString() || null;

  const allUnlockedFeatures = mergeFeatureUnlocks({}, ALL_REPORT_KEYS);

  const { error: userError } = await supabase
    .from("users")
    .upsert(
      {
        id: params.userId,
        email: params.email || undefined,
        unlocked_features: allUnlockedFeatures,
        is_subscribed: true,
        subscription_status: "active",
        access_status: "subscription_active",
        subscription_current_period_end: endsAtIso,
        subscription_cancel_at_period_end: Boolean(params.cancelAtPeriodEnd),
        subscription_locked_at: null,
        subscription_lock_reason: null,
        subscription_plan: "monthly_9",
        stripe_customer_id: params.stripeCustomerId || undefined,
        stripe_subscription_id: params.stripeSubscriptionId,
        updated_at: nowIso,
      },
      { onConflict: "id" }
    );

  if (userError) throw userError;

  for (const reportKey of ALL_REPORT_KEYS) {
    const { data: existingEntitlement, error: lookupError } = await supabase
      .from("user_entitlements")
      .select("id")
      .eq("user_id", params.userId)
      .eq("report_key", reportKey)
      .eq("source", "subscription_all")
      .eq("status", "active")
      .maybeSingle();

    if (lookupError) throw lookupError;

    const entitlementPayload = {
      user_id: params.userId,
      report_key: reportKey,
      source: "subscription_all",
      status: "active",
      starts_at: startsAtIso,
      ends_at: endsAtIso,
      stripe_subscription_id: params.stripeSubscriptionId,
      metadata: {
        plan: "monthly_9",
        unlock_scope: "all_reports",
      },
      updated_at: nowIso,
    };

    if (existingEntitlement?.id) {
      const { error } = await supabase
        .from("user_entitlements")
        .update(entitlementPayload)
        .eq("id", existingEntitlement.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("user_entitlements").insert({
        id: `ent_${randomUUID()}`,
        ...entitlementPayload,
      });
      if (error) throw error;
    }
  }

  await ensureAndLinkReportsForUser({
    supabase,
    userId: params.userId,
    email: params.email,
    reportKeys: ALL_REPORT_KEYS,
  });
}

export async function activateExtraReportPurchase(params: {
  userId: string;
  email?: string | null;
  reportKey: ReportKey;
  stripeCustomerId?: string | null;
  stripeSessionId?: string | null;
  purchasedAt?: Date;
}) {
  const supabase = getSupabaseAdmin();
  const purchasedAt = params.purchasedAt || new Date();
  const startsAtIso = purchasedAt.toISOString();
  const endsAtIso = new Date(purchasedAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  await ensureAndLinkReportsForUser({
    supabase,
    userId: params.userId,
    email: params.email,
    reportKeys: [params.reportKey],
  });

  const { data: existingUser, error: userFetchError } = await supabase
    .from("users")
    .select("unlocked_features")
    .eq("id", params.userId)
    .maybeSingle();
  if (userFetchError) throw userFetchError;

  const unlockedFeatures = mergeFeatureUnlocks(existingUser?.unlocked_features, [params.reportKey]);
  const userUpdate: Record<string, any> = {
    unlocked_features: unlockedFeatures,
    payment_status: "paid",
    purchase_type: "report",
    stripe_customer_id: params.stripeCustomerId || undefined,
    updated_at: nowIso,
  };
  Object.keys(userUpdate).forEach((key) => {
    if (userUpdate[key] === undefined) delete userUpdate[key];
  });

  const { error: userUpdateError } = await supabase
    .from("users")
    .update(userUpdate)
    .eq("id", params.userId);
  if (userUpdateError) throw userUpdateError;

  const entitlementPayload = {
    user_id: params.userId,
    report_key: params.reportKey,
    source: "extra_report_purchase",
    status: "active",
    starts_at: startsAtIso,
    ends_at: endsAtIso,
    stripe_session_id: params.stripeSessionId || null,
    metadata: {
      price_cents: 197,
      currency: "USD",
      access_days: 30,
    },
    updated_at: nowIso,
  };

  const { data: existingEntitlement, error: lookupError } = await supabase
    .from("user_entitlements")
    .select("id")
    .eq("user_id", params.userId)
    .eq("report_key", params.reportKey)
    .eq("source", "extra_report_purchase")
    .eq("status", "active")
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existingEntitlement?.id) {
    const { error } = await supabase
      .from("user_entitlements")
      .update(entitlementPayload)
      .eq("id", existingEntitlement.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("user_entitlements").insert({
      id: `ent_${randomUUID()}`,
      ...entitlementPayload,
    });
    if (error) throw error;
  }
}

export async function updateTrialSubscriptionStatus(params: {
  stripeSubscriptionId: string;
  status: string;
  trialEndsAt?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
}) {
  const supabase = getSupabaseAdmin();
  const updatePayload: Record<string, any> = {
    subscription_status: params.status,
    access_status: params.status === "trialing" ? "trial_active" : undefined,
    trial_ends_at: params.trialEndsAt?.toISOString() || undefined,
    subscription_current_period_end: params.currentPeriodEnd?.toISOString() || undefined,
    subscription_cancel_at_period_end: Boolean(params.cancelAtPeriodEnd),
    updated_at: new Date().toISOString(),
  };

  Object.keys(updatePayload).forEach((key) => {
    if (updatePayload[key] === undefined) delete updatePayload[key];
  });

  const { error } = await supabase
    .from("users")
    .update(updatePayload)
    .eq("stripe_subscription_id", params.stripeSubscriptionId);

  if (error) throw error;
}
