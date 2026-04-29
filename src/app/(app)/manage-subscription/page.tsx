"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";

const FLOW_LABELS: Record<string, string> = {
  future_prediction: "2026 Prediction Trial",
  soulmate_sketch: "Soulmate Sketch Trial",
  palm_reading: "Palm Reading Trial",
  future_partner: "Future Partner Trial",
  compatibility: "Compatibility Trial",
};

type SubscriptionData = {
  id: string;
  email?: string | null;
  primary_flow?: string | null;
  subscription_status?: string | null;
  access_status?: string | null;
  subscription_plan?: string | null;
  trial_ends_at?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean | null;
  stripe_subscription_id?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return "Not available";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getNextBillingDate(subscription: SubscriptionData | null) {
  if (!subscription) return null;
  const currentPeriodEnd = subscription.subscription_current_period_end;
  if (currentPeriodEnd) return currentPeriodEnd;
  const trialEndsAt = subscription.trial_ends_at;
  if (trialEndsAt) return trialEndsAt;
  return null;
}

export default function ManageSubscriptionPage() {
  const router = useRouter();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isTrial =
    subscription?.subscription_status === "trialing" ||
    subscription?.subscription_status === "trial_cancelled" ||
    subscription?.access_status === "trial_active";
  const isActive =
    subscription?.subscription_status === "active" ||
    subscription?.subscription_status === "cancelled" ||
    subscription?.access_status === "subscription_active";
  const isCancelPending = Boolean(subscription?.subscription_cancel_at_period_end);
  const trialEndsAt = subscription?.trial_ends_at || null;
  const nextBillingDate = getNextBillingDate(subscription);
  const planName = subscription?.primary_flow
    ? FLOW_LABELS[subscription.primary_flow] || "PalmCosmic Subscription"
    : "PalmCosmic Subscription";

  useEffect(() => {
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
    pixelEvents.viewContent("Manage Subscription", "subscription");
    trackAnalyticsEvent("ManageSubscriptionViewed", {
      route: "/manage-subscription",
      user_id: userId,
      email,
    });
    loadSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubscription = async () => {
    setIsLoading(true);
    setError("");
    try {
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id");
      const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email");

      if (!userId && !email) {
        setSubscription(null);
        return;
      }

      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (email) params.set("email", email);
      const response = await fetch(`/api/user/hydrate?${params.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      const user = response.ok && result?.success ? result.user : null;
      const data = user
        ? {
            id: user.id,
            email: user.email,
            primary_flow: user.primaryFlow,
            subscription_status: user.subscriptionStatus,
            access_status: user.accessStatus,
            subscription_plan: user.subscriptionPlan,
            trial_ends_at: user.trialEndsAt,
            subscription_current_period_end: user.subscriptionCurrentPeriodEnd,
            subscription_cancel_at_period_end: user.subscriptionCancelAtPeriodEnd,
            stripe_subscription_id: user.stripeSubscriptionId,
          }
        : null;

      setSubscription(data || null);
      trackAnalyticsEvent("ManageSubscriptionLoaded", {
        route: "/manage-subscription",
        has_subscription: Boolean(data?.stripe_subscription_id),
        subscription_status: data?.subscription_status || null,
        access_status: data?.access_status || null,
        primary_flow: data?.primary_flow || null,
        cancel_pending: Boolean(data?.subscription_cancel_at_period_end),
      });
    } catch (err: any) {
      console.error("Failed to load subscription:", err);
      setError(err?.message || "Unable to load your subscription.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateSubscription = async (action: "cancel" | "resume") => {
    if (!subscription?.id && !subscription?.email) return;
    setIsSubmitting(true);
    setError("");
    trackAnalyticsEvent("ManageSubscriptionAction", {
      route: "/manage-subscription",
      action: `${action}_clicked`,
      subscription_status: subscription?.subscription_status || null,
      access_status: subscription?.access_status || null,
      is_trial: isTrial,
      cancel_pending: isCancelPending,
    });
    try {
      const response = await fetch(
        action === "cancel" ? "/api/stripe/cancel-subscription" : "/api/stripe/resume-subscription",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: subscription?.id, email: subscription?.email }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Unable to ${action} subscription`);
      }
      await loadSubscription();
      trackAnalyticsEvent("ManageSubscriptionAction", {
        route: "/manage-subscription",
        action: `${action}_succeeded`,
        subscription_status: subscription?.subscription_status || null,
        access_status: subscription?.access_status || null,
        is_trial: isTrial,
      });
    } catch (err: any) {
      console.error(`Failed to ${action} subscription:`, err);
      setError(err?.message || `Unable to ${action} subscription.`);
      trackAnalyticsEvent("ManageSubscriptionAction", {
        route: "/manage-subscription",
        action: `${action}_failed`,
        subscription_status: subscription?.subscription_status || null,
        access_status: subscription?.access_status || null,
        is_trial: isTrial,
        error: err?.message || `Unable to ${action} subscription.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/30 flex flex-col relative">
        <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
          <div className="flex items-center justify-center px-4 py-3">
            <button
              onClick={() => {
                trackAnalyticsEvent("ManageSubscriptionAction", {
                  route: "/manage-subscription",
                  action: "back_clicked",
                  destination: "/settings",
                });
                router.push("/settings");
              }}
              className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-lg text-[#b8c7da] transition-colors hover:bg-[#0b2338] hover:text-white"
              aria-label="Back to settings"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white text-xl font-semibold">Subscription</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="px-4 py-6 space-y-4 pb-10">
            {isLoading ? (
              <div className="flex min-h-[50vh] items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#38bdf8]" />
              </div>
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-[#38bdf8]/30 bg-[#0b2338] p-5"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#38bdf8]/30 bg-[#082035]">
                      <CreditCard className="h-6 w-6 text-[#38bdf8]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">
                        {isTrial ? "Trial" : "Subscription"}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-white">{planName}</h2>
                      <p className="mt-1 text-sm capitalize text-[#8fa3b8]">
                        {isCancelPending
                          ? isTrial
                            ? "Cancels when trial ends"
                            : "Cancels after current billing cycle"
                          : subscription?.subscription_status?.replace(/_/g, " ") || "No active plan found"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 border-t border-[#173653] pt-4">
                    {isTrial && (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm text-[#8fa3b8]">Trial ends</span>
                        <span className="text-right text-sm font-semibold text-white">{formatDate(trialEndsAt)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-[#8fa3b8]">
                        {isCancelPending ? "Access ends" : "Next billing date"}
                      </span>
                      <span className="text-right text-sm font-semibold text-white">{formatDate(nextBillingDate)}</span>
                    </div>
                  </div>
                </motion.div>

                {error && (
                  <p className="rounded-lg border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="space-y-3"
                >
                  {isCancelPending ? (
                    <Button
                      onClick={() => updateSubscription("resume")}
                      disabled={isSubmitting}
                      className="h-14 w-full rounded-lg bg-[#38bdf8] text-base font-bold text-black hover:bg-[#0284c7] disabled:bg-[#173653] disabled:text-[#8fa3b8]"
                    >
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <span className="inline-flex items-center gap-2">
                          <RotateCcw className="h-5 w-5" /> Resume Subscription
                        </span>
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => updateSubscription("cancel")}
                      disabled={isSubmitting || !subscription?.stripe_subscription_id}
                      className="h-14 w-full rounded-lg border border-red-400/30 bg-red-500/10 text-base font-bold text-red-200 hover:bg-red-500/20 disabled:bg-[#173653] disabled:text-[#8fa3b8]"
                    >
                      {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <span className="inline-flex items-center gap-2">
                          <XCircle className="h-5 w-5" /> Cancel Subscription
                        </span>
                      )}
                    </Button>
                  )}

                  <p className="px-2 text-center text-xs leading-5 text-[#8fa3b8]">
                    {isCancelPending
                      ? "You can resume anytime before access ends."
                      : isTrial
                        ? "If you cancel during trial, your subscription will end when the trial ends."
                        : "If you cancel now, access continues until the current billing cycle ends. You can resume anytime before then."}
                  </p>
                </motion.div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
