"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import { generateUserId } from "@/lib/user-profile";
import { usePricing } from "@/hooks/usePricing";
import type { UpsellPlan } from "@/lib/pricing";
import { OnboardingFunnelTracker } from "@/components/onboarding/OnboardingFunnelTracker";

const OFFER_IDS = ["compatibility", "2026-predictions"];

const OFFER_ICONS: Record<string, string> = {
  compatibility: "Love",
  "2026-predictions": "2026",
};

function formatDollars(cents: number) {
  const dollars = cents / 100;
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

function getStoredEmail() {
  return (
    localStorage.getItem("palmcosmic_email") ||
    localStorage.getItem("astrorekha_checkout_email") ||
    localStorage.getItem("astrorekha_email") ||
    ""
  ).trim().toLowerCase();
}

function getOrCreateUserId() {
  const existing = localStorage.getItem("palmcosmic_user_id") || localStorage.getItem("astrorekha_user_id");
  const userId = existing || generateUserId();
  localStorage.setItem("palmcosmic_user_id", userId);
  localStorage.setItem("astrorekha_user_id", userId);
  return userId;
}

function BundleUpsellContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pricing } = usePricing();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const offers = useMemo(() => {
    const byId = new Map(pricing.upsells.map((upsell) => [upsell.id, upsell]));
    return OFFER_IDS.map((id) => byId.get(id)).filter(Boolean) as UpsellPlan[];
  }, [pricing.upsells]);

  const selectedOffers = useMemo(
    () => offers.filter((offer) => selectedIds.has(offer.id)),
    [offers, selectedIds]
  );

  const totalCents = selectedOffers.reduce((sum, offer) => sum + offer.price, 0);

  useEffect(() => {
    const isSuccessfulReturn = searchParams.get("payment") === "success";
    if (isSuccessfulReturn) {
      localStorage.setItem("astrorekha_payment_completed", "true");
    }

    const email = getStoredEmail();
    const userId = getOrCreateUserId();
    localStorage.setItem("palmcosmic_active_flow", "palm_reading");

    pixelEvents.viewContent("PalmCosmic Optional Add-ons", "product");
    trackFunnelAction("bundle_upsell_viewed", {
      route: "/upsell",
      step_id: "bundle_upsell",
      funnel: "palm_reading",
      payment_return: isSuccessfulReturn,
    });

    fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email: email || null,
        currentRoute: "/upsell",
        currentStep: "bundle_upsell",
        priorityArea: "palm_reading",
        answers: {
          paidBundle: localStorage.getItem("astrorekha_selected_plan") || localStorage.getItem("palmcosmic_selected_bundle"),
          paymentCompleted: localStorage.getItem("astrorekha_payment_completed") === "true",
        },
        source: "bundle_upsell_view",
      }),
      keepalive: true,
    }).catch(() => undefined);

    if (!email) {
      router.replace("/onboarding/email");
      return;
    }

    const hasCompletedPayment = localStorage.getItem("astrorekha_payment_completed") === "true";
    if (!hasCompletedPayment) {
      fetch(`/api/user/payment-state?email=${encodeURIComponent(email)}`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data?.hasPaid) {
            localStorage.setItem("astrorekha_payment_completed", "true");
            return;
          }
          router.replace("/paywall");
        })
        .catch(() => router.replace("/paywall"));
    }
  }, [router, searchParams]);

  const toggleOffer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);

      trackFunnelAction("bundle_upsell_selection_changed", {
        route: "/upsell",
        step_id: "bundle_upsell",
        funnel: "palm_reading",
        selected_offer_ids: Array.from(next).join(","),
      });

      return next;
    });
  };

  const handleCheckout = async () => {
    if (selectedIds.size === 0) {
      trackFunnelAction("bundle_upsell_skipped", {
        route: "/upsell",
        step_id: "bundle_upsell",
        funnel: "palm_reading",
      });
      router.push("/registration?flow=palm_reading");
      return;
    }

    setIsProcessing(true);
    setError("");

    try {
      const email = getStoredEmail();
      if (!email) {
        router.push("/onboarding/email");
        return;
      }

      const userId = getOrCreateUserId();
      const offerIds = selectedOffers.map((offer) => offer.id).join(",");
      const selectedOfferNames = selectedOffers.map((offer) => offer.name);
      const combinedOfferLabel = selectedOfferNames.join(", ");
      const value = totalCents / 100;

      localStorage.setItem("palmcosmic_selected_upsells", offerIds);
      localStorage.setItem("astrorekha_selected_upsells", offerIds);

      pixelEvents.addToCart(value, combinedOfferLabel);
      trackFunnelAction("bundle_upsell_checkout_started", {
        route: "/upsell",
        step_id: "bundle_upsell",
        funnel: "palm_reading",
        offer_ids: offerIds,
        value,
      });

      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          bundleId: offerIds,
          offerIds,
          type: "upsell",
          email,
          firstName: localStorage.getItem("palmcosmic_first_name") || localStorage.getItem("astrorekha_name") || "Customer",
          successPath: "/registration?flow=palm_reading&upsell_success=true",
          cancelPath: "/upsell",
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout");
      }

      pixelEvents.initiateCheckout(value, selectedOfferNames, data.metaEventId);
      pixelEvents.addPaymentInfo(value, combinedOfferLabel);
      trackFunnelAction("bundle_upsell_checkout_created", {
        route: "/upsell",
        step_id: "bundle_upsell",
        funnel: "palm_reading",
        offer_ids: offerIds,
        stripe_session_id: data.sessionId,
        value,
      });

      window.location.href = data.url;
    } catch (checkoutError) {
      console.error("PalmCosmic upsell checkout failed:", checkoutError);
      setError(checkoutError instanceof Error ? checkoutError.message : "Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="min-h-screen bg-[#061525] px-6 py-6 text-white">
      <OnboardingFunnelTracker />
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold">Optional Add-ons</h1>
        <p className="mt-2 text-center text-sm text-[#b8c7da]">Choose one, both, or skip.</p>

        <div className="mt-6 space-y-3">
          {offers.map((offer) => {
            const selected = selectedIds.has(offer.id);
            return (
              <button
                key={offer.id}
                type="button"
                onClick={() => toggleOffer(offer.id)}
                className={cn(
                  "w-full rounded-2xl border p-4 text-left transition-all duration-200",
                  "border-[#173653] bg-[#0b2338] hover:border-[#38bdf8]/60 hover:bg-[#0d2a43]",
                  selected && "border-[#38bdf8] bg-[#38bdf8]/10"
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#38bdf8]/12 text-xs font-bold text-[#38bdf8]">
                    {OFFER_ICONS[offer.id] || "Add"}
                  </span>
                  <div className="flex-1">
                    <p className="font-semibold">{offer.name}</p>
                    <p className="text-xs leading-relaxed text-[#b8c7da]">{offer.description}</p>
                    <div className="mt-2 flex items-baseline gap-2">
                      <p className="text-sm font-semibold text-[#38bdf8]">{formatDollars(offer.displayPrice || offer.price)}</p>
                      <p className="text-xs text-[#8ba2bc] line-through">{formatDollars(offer.originalPrice)}</p>
                    </div>
                  </div>
                  {selected ? (
                    <div className="rounded-full bg-[#38bdf8] p-1">
                      <Check className="h-4 w-4 text-black" />
                    </div>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <Button onClick={handleCheckout} disabled={isProcessing} className="mt-6 h-14 w-full bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0ea5e9]">
          {isProcessing ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : selectedIds.size > 0 ? (
            `Continue with Add-ons - ${formatDollars(totalCents)}`
          ) : (
            "Skip & Continue"
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export default function BundleUpsellPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#061525]" />}>
      <BundleUpsellContent />
    </Suspense>
  );
}
