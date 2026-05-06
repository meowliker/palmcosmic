"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Shield, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";
import { usePricing } from "@/hooks/usePricing";
import type { BundlePlan } from "@/lib/pricing";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import { detectHandLandmarks } from "@/lib/palm-detection";
import { generateUserId } from "@/lib/user-profile";
import { OnboardingFunnelTracker } from "@/components/onboarding/OnboardingFunnelTracker";
import {
  PAYWALL_PRICING_EXPERIMENT,
  applyPaywallPriceVariant,
  pickPaywallPriceVariant,
  type PaywallPriceVariant,
} from "@/lib/paywall-pricing-experiment";

const BUNDLE_ORDER = ["palm-reading", "palm-birth", "palm-birth-sketch"];

const predictionLabels = [
  { text: "First date", top: "15%", left: "10%", rotation: -12 },
  { text: "Marriage", top: "35%", left: "56%", rotation: 5 },
  { text: "Anniversary", top: "58%", left: "12%", rotation: -10 },
  { text: "Big change", top: "60%", left: "52%", rotation: 8 },
];

const readingStats = [
  { label: "Love", color: "#38bdf8", value: 88 },
  { label: "Health", color: "#7dd3fc", value: 82 },
  { label: "Wisdom", color: "#22d3ee", value: 91 },
  { label: "Career", color: "#0ea5e9", value: 76 },
];

const compatibilityStats = [
  { label: "Sexual", color: "#38bdf8", value: 92 },
  { label: "Emotional", color: "#7dd3fc", value: 86 },
  { label: "Intellectual", color: "#22d3ee", value: 89 },
  { label: "Spiritual", color: "#0ea5e9", value: 81 },
];

const testimonials = [
  {
    name: "Megan",
    country: "United States",
    flag: "US",
    time: "4 days ago",
    review:
      "Finally a palm reading app that actually works. Scanned my palm and got insights about my career path that were spot on. The AI guide feels like talking to a real astrologer.",
  },
  {
    name: "Jason",
    country: "United States",
    flag: "US",
    time: "1 week ago",
    review:
      "The birth chart analysis was incredibly detailed. Asked questions about my love line and got thoughtful, personal answers. This app feels magical and premium at the same time.",
  },
  {
    name: "Emily",
    country: "United States",
    flag: "US",
    time: "5 days ago",
    review:
      "Going through a tough phase and this app gave me so much clarity. The reading explained why things weren't working out and what kind of energy I should seek next. Truly healing.",
  },
];

const scrollingEmails = [
  "Kev***@protonmail.com",
  "Ali***@zoho.com",
  "Sar***@gmail.com",
  "Mik***@outlook.com",
  "Emm***@yahoo.com",
  "Dav***@icloud.com",
];

const planCopy: Record<string, string> = {
  "palm-reading": "Unlocks only palm reading report",
  "palm-birth": "Unlocks palm and birth report",
  "palm-birth-sketch": "Unlocks palm, birth, sketch, future partner report",
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

function getSoulmatePreviewImage(): "/male.png" | "/female.png" {
  try {
    const raw = localStorage.getItem("astrorekha_soulmate_answers");
    const answers = raw ? JSON.parse(raw) : {};
    const attractedTo = String(answers?.attracted_to || "").trim().toLowerCase();
    if (attractedTo === "female" || attractedTo.includes("woman")) return "/female.png";
    if (attractedTo === "male" || attractedTo.includes("man")) return "/male.png";
  } catch {
    return "/female.png";
  }
  return "/female.png";
}

export default function BundlePaywallPage() {
  const router = useRouter();
  const { pricing } = usePricing();
  const [priceVariant, setPriceVariant] = useState<PaywallPriceVariant | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("palm-birth");
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [paymentError, setPaymentError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [palmImage, setPalmImage] = useState<string | null>(null);
  const [croppedPalmImage, setCroppedPalmImage] = useState<string | null>(null);
  const [soulmatePreviewImage, setSoulmatePreviewImage] = useState<"/male.png" | "/female.png">("/female.png");
  const [showStickyCTA, setShowStickyCTA] = useState(false);

  const paymentSectionRef = useRef<HTMLDivElement>(null);
  const testimonialSectionRef = useRef<HTMLDivElement>(null);
  const birthChartSectionRef = useRef<HTMLDivElement>(null);
  const getFullReportRef = useRef<HTMLButtonElement>(null);

  const bundlePlans = useMemo(() => {
    const byId = new Map(pricing.bundles.filter((bundle) => bundle.active).map((bundle) => [bundle.id, bundle]));
    const orderedBundles = BUNDLE_ORDER.map((id) => byId.get(id)).filter(Boolean) as BundlePlan[];
    return applyPaywallPriceVariant(orderedBundles, priceVariant || "control_29_49_89");
  }, [pricing.bundles, priceVariant]);

  const selectedPlanData = bundlePlans.find((plan) => plan.id === selectedPlan) || bundlePlans[1] || bundlePlans[0];

  useEffect(() => {
    const variant = pickPaywallPriceVariant();
    setPriceVariant(variant);
  }, []);

  useEffect(() => {
    setSoulmatePreviewImage(getSoulmatePreviewImage());
    if (!priceVariant) return;

    const savedImage = localStorage.getItem("astrorekha_palm_image");
    if (savedImage) setPalmImage(savedImage);
    localStorage.setItem("palmcosmic_active_flow", "palm_reading");

    pixelEvents.viewContent("PalmCosmic Bundle Pricing", "product");
    trackFunnelAction("bundle_paywall_viewed", {
      route: "/paywall",
      step_id: "bundle_paywall",
      funnel: "palm_reading",
      payment_model: "one_time_lifetime",
      pricing_experiment: PAYWALL_PRICING_EXPERIMENT,
      pricing_variant: priceVariant,
    });

    const email = getStoredEmail();
    if (email) {
      fetch(`/api/user/payment-state?email=${encodeURIComponent(email)}`, { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (!data?.hasPaid) return;
          localStorage.setItem("astrorekha_payment_completed", "true");
          if (data?.isRegistered) {
            router.push(`/login?email=${encodeURIComponent(email)}`);
            return;
          }
          router.push("/registration?flow=palm_reading&recovered=true");
        })
        .catch(() => undefined);
    }
  }, [router, priceVariant]);

  useEffect(() => {
    if (bundlePlans.length === 0) return;
    setSelectedPlan((current) => (bundlePlans.some((plan) => plan.id === current) ? current : bundlePlans[0].id));
  }, [bundlePlans]);

  useEffect(() => {
    const email = getStoredEmail();
    const userId = getOrCreateUserId();
    if (!priceVariant) return;

    fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email: email || null,
        currentRoute: "/paywall",
        currentStep: "bundle_paywall",
        priorityArea: "palm_reading",
        answers: {
          selectedBundleId: selectedPlan,
          pricingExperiment: PAYWALL_PRICING_EXPERIMENT,
          pricingVariant: priceVariant,
          palmImageSaved: Boolean(localStorage.getItem("astrorekha_palm_image")) || localStorage.getItem("palmcosmic_palm_image_saved") === "true",
        },
        source: "bundle_paywall_view",
      }),
      keepalive: true,
    }).catch(() => undefined);
  }, [selectedPlan, priceVariant]);

  useEffect(() => {
    let isInContentSection = false;
    let isGetFullReportVisible = false;

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === testimonialSectionRef.current || entry.target === birthChartSectionRef.current) {
            isInContentSection = entry.isIntersecting;
          }
        });
        setShowStickyCTA(isInContentSection && !isGetFullReportVisible);
      },
      { threshold: 0.1 }
    );

    const buttonObserver = new IntersectionObserver(
      ([entry]) => {
        isGetFullReportVisible = entry.isIntersecting;
        setShowStickyCTA(isInContentSection && !isGetFullReportVisible);
      },
      { threshold: 0.5 }
    );

    if (testimonialSectionRef.current) sectionObserver.observe(testimonialSectionRef.current);
    if (birthChartSectionRef.current) sectionObserver.observe(birthChartSectionRef.current);
    if (getFullReportRef.current) buttonObserver.observe(getFullReportRef.current);

    return () => {
      sectionObserver.disconnect();
      buttonObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!palmImage) return;

    (async () => {
      try {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = palmImage;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load palm image"));
        });

        const results = await detectHandLandmarks(img);
        const landmarks = results?.landmarks?.[0];
        if (!landmarks?.length) {
          setCroppedPalmImage(palmImage);
          return;
        }

        let minX = 1;
        let minY = 1;
        let maxX = 0;
        let maxY = 0;
        for (const p of landmarks) {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        }

        const pad = 0.12;
        minX = Math.max(0, minX - pad);
        minY = Math.max(0, minY - pad);
        maxX = Math.min(1, maxX + pad);
        maxY = Math.min(1, maxY + pad);

        const sx = Math.floor(minX * img.width);
        const sy = Math.floor(minY * img.height);
        const sw = Math.max(1, Math.ceil((maxX - minX) * img.width));
        const sh = Math.max(1, Math.ceil((maxY - minY) * img.height));

        const canvas = document.createElement("canvas");
        canvas.width = sw;
        canvas.height = sh;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setCroppedPalmImage(palmImage);
          return;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        setCroppedPalmImage(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        setCroppedPalmImage(palmImage);
      }
    })();
  }, [palmImage]);

  const scrollToPayment = () => {
    paymentSectionRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePurchase = async () => {
    setPaymentError("");

    const plan = bundlePlans.find((item) => item.id === selectedPlan);
    if (!plan) {
      setPaymentError("Please select a plan");
      return;
    }

    if (!agreedToTerms) {
      setPaymentError("Please accept the Terms of Service and Privacy Policy first.");
      return;
    }

    const email = getStoredEmail();
    if (!email) {
      router.push("/onboarding/email");
      return;
    }

    setIsProcessing(true);
    const userId = getOrCreateUserId();
    const activePriceVariant = priceVariant || "control_29_49_89";
    localStorage.setItem("astrorekha_selected_plan", selectedPlan);
    localStorage.setItem("palmcosmic_selected_bundle", selectedPlan);
    localStorage.setItem("palmcosmic_selected_bundle_price_variant", activePriceVariant);
    localStorage.setItem("palmcosmic_active_flow", "palm_reading");

    const value = plan.price / 100;
    pixelEvents.addToCart(value, plan.name);
    trackFunnelAction("bundle_paywall_checkout_started", {
      route: "/paywall",
      step_id: "bundle_paywall",
      funnel: "palm_reading",
      bundle_id: selectedPlan,
      value,
      payment_model: "one_time_lifetime",
      pricing_experiment: PAYWALL_PRICING_EXPERIMENT,
      pricing_variant: activePriceVariant,
      bundle_price_cents: plan.price,
    });

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bundle",
          bundleId: selectedPlan,
          pricingExperiment: PAYWALL_PRICING_EXPERIMENT,
          pricingVariant: activePriceVariant,
          userId,
          email,
          firstName: localStorage.getItem("palmcosmic_first_name") || localStorage.getItem("astrorekha_name") || "Customer",
          successPath: "/upsell",
          cancelPath: "/paywall",
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout");
      }

      pixelEvents.initiateCheckout(value, [selectedPlan, ...(plan.features || [])], data.metaEventId);
      pixelEvents.addPaymentInfo(value, plan.name);
      trackFunnelAction("bundle_paywall_checkout_created", {
        route: "/paywall",
        step_id: "bundle_paywall",
        funnel: "palm_reading",
        bundle_id: selectedPlan,
        stripe_session_id: data.sessionId,
        value,
        pricing_experiment: PAYWALL_PRICING_EXPERIMENT,
        pricing_variant: activePriceVariant,
        bundle_price_cents: plan.price,
      });

      window.location.href = data.url;
    } catch (error) {
      console.error("[paywall] checkout failed:", error);
      setPaymentError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex flex-col bg-[#061525] text-white">
      <OnboardingFunnelTracker />
      <div className="flex min-h-[100vh] flex-col items-center justify-center px-6 py-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-2 flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- Small static app logo. */}
          <img src="/logo.png" alt="PalmCosmic" className="h-20 w-20 object-contain" />
          <span className="text-sm text-[#b8c7da]">PalmCosmic</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-1 text-center text-2xl font-bold md:text-3xl">
          Your Soulmate Sketch
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8 text-xl font-bold text-[#38bdf8] md:text-2xl">
          Is Ready!
        </motion.p>

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="relative mb-8 h-80 w-72">
          <div className="absolute inset-0 rounded-full bg-[#38bdf8]/20 blur-2xl" />
          <div className="absolute inset-4 flex items-center justify-center overflow-hidden rounded-full border border-[#38bdf8]/25 bg-[#0b2338]/80">
            {/* eslint-disable-next-line @next/next/no-img-element -- Mirrors AstroRekha paywall preview behavior. */}
            <img src={soulmatePreviewImage} alt="Your soulmate sketch preview" className="h-[78%] w-[68%] rounded-3xl border border-white/10 object-cover" />
          </div>

          {predictionLabels.map((label, index) => (
            <motion.div
              key={label.text}
              initial={{ opacity: 0, scale: 0, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.6 + index * 0.2, type: "spring", stiffness: 200 }}
              className="absolute whitespace-nowrap rounded-lg border border-[#38bdf8]/25 bg-[#071a2b] px-3 py-1.5 text-white shadow-[0_10px_28px_rgba(0,0,0,0.48)]"
              style={{ top: label.top, left: label.left, transform: `rotate(${label.rotation}deg)` }}
            >
              <span className="flex items-center gap-1 text-sm font-medium">{label.text}</span>
            </motion.div>
          ))}
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="w-full max-w-sm">
          <Button onClick={scrollToPayment} className="h-14 w-full bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0ea5e9]" size="lg">
            Get My Prediction
          </Button>
        </motion.div>
      </div>

      <div ref={paymentSectionRef} className="flex min-h-[100vh] flex-col items-center px-6 pb-8 pt-4">
        <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-2 text-center text-xl font-bold">
          Choose Your Reading
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center text-sm text-[#b8c7da]">
          One-time payment • Lifetime access
        </motion.p>

        <div className="mb-6 w-full max-w-sm space-y-4">
          {bundlePlans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative cursor-pointer rounded-2xl border-2 p-4 transition-all ${
                selectedPlan === plan.id ? "border-[#38bdf8] bg-[#38bdf8]/5" : "border-[#173653] bg-[#0b2338]/70"
              } ${plan.popular ? "ring-2 ring-[#38bdf8]/45" : ""}`}
            >
              {plan.popular ? (
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#38bdf8] px-4 py-1 text-xs font-semibold text-black">
                  <Star className="h-3 w-3" /> Most Popular
                </div>
              ) : null}
              {plan.limitedOffer ? (
                <div className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r from-[#38bdf8] to-[#22d3ee] px-4 py-1 text-xs font-semibold text-black">
                  <Sparkles className="h-3 w-3" /> Limited Offer
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 ${selectedPlan === plan.id ? "border-[#38bdf8] bg-[#38bdf8]" : "border-[#8ba2bc]/30"}`}>
                  {selectedPlan === plan.id ? <Check className="h-4 w-4 text-black" /> : null}
                </div>

                <div className="flex-1">
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <h3 className="flex-1 text-lg font-bold">{plan.name}</h3>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                      {plan.discount}
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-[#b8c7da]">{planCopy[plan.id] || plan.description}</p>
                  <div className="mb-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-[#38bdf8]">{formatDollars(plan.displayPrice || plan.price)}</span>
                    <span className="text-sm text-[#8ba2bc] line-through">{formatDollars(plan.originalPrice)}</span>
                  </div>
                  <ul className="space-y-1.5">
                    {plan.featureList.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-sm text-[#b8c7da]">
                        <Check className="h-4 w-4 shrink-0 text-[#38bdf8]" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mb-4 w-full max-w-sm">
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} className="mt-1 h-4 w-4 rounded border-[#173653]" />
            <span className="text-xs text-[#b8c7da]">
              I agree to the{" "}
              <a href="/Terms/terms-of-service.html" target="_blank" className="text-[#38bdf8] underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/Terms/privacy-policy.html" target="_blank" className="text-[#38bdf8] underline">
                Privacy Policy
              </a>
            </span>
          </label>
        </motion.div>

        {paymentError ? <div className="mb-4 w-full max-w-sm rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{paymentError}</div> : null}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mb-6 w-full max-w-sm">
          <Button ref={getFullReportRef} onClick={handlePurchase} disabled={!agreedToTerms || isProcessing} className="h-14 w-full bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0ea5e9]" size="lg">
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Processing...
              </span>
            ) : (
              `Get My Reading - ${selectedPlanData ? formatDollars(selectedPlanData.displayPrice || selectedPlanData.price) : ""}`
            )}
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-[#b8c7da]">
            <Shield className="h-4 w-4 text-[#38bdf8]" />
            <span className="text-sm">Guaranteed safe checkout</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-10 items-center justify-center rounded bg-[#1A1F71]"><span className="text-xs font-bold text-white">VISA</span></div>
            <div className="flex h-6 w-10 items-center justify-center rounded bg-[#EB001B]"><div className="flex"><div className="h-3 w-3 rounded-full bg-[#EB001B]" /><div className="-ml-1 h-3 w-3 rounded-full bg-[#F79E1B]" /></div></div>
            <div className="flex h-6 w-10 items-center justify-center rounded bg-[#006FCF]"><span className="text-[8px] font-bold text-white">AMEX</span></div>
            <div className="flex h-6 w-10 items-center justify-center rounded bg-[#0f766e]"><span className="text-[8px] font-bold text-white">STRIPE</span></div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mb-8 w-full max-w-sm rounded-2xl border border-[#173653] bg-[#0b2338]/70 p-5 backdrop-blur-sm">
          <div className="relative mb-4 h-48 w-full overflow-hidden rounded-xl bg-gradient-to-b from-[#102c45] to-[#071a2b]">
            {palmImage ? (
              // eslint-disable-next-line @next/next/no-img-element -- Captured data URLs cannot be optimized by next/image.
              <img src={croppedPalmImage || palmImage} alt="Your palm" className="h-full w-full object-cover opacity-70" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- Static onboarding illustration. */}
                <img src="/palm.png" alt="Your palm" className="h-40 w-32 object-contain opacity-70" />
              </div>
            )}
          </div>
          <h3 className="mb-4 text-center text-lg font-semibold">Your palm reading</h3>
          <StatsList stats={readingStats} />
          <div className="mt-4 space-y-2 text-sm text-[#b8c7da]">
            <p>Your <span className="font-medium text-[#38bdf8]">Heart Line</span> shows that you are very passionate and freely express your thoughts and feelings.</p>
            <p>Your <span className="font-medium text-[#7dd3fc]">Life Line</span> depicts resilience and a path that strengthens with focus.</p>
            <p className="cursor-pointer text-[#38bdf8]" onClick={scrollToPayment}>More data in the full report</p>
          </div>
          <Button onClick={scrollToPayment} className="mt-4 h-12 w-full bg-[#38bdf8] text-base font-semibold text-black hover:bg-[#0ea5e9]" size="lg">
            Get Full Report
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mb-8 w-full max-w-sm p-8">
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-full bg-[#38bdf8]/30 blur-xl" />
              <div className="relative h-28 w-28 rounded-full border border-[#38bdf8]/50 bg-gradient-to-b from-[#15314d] to-[#061525] p-1">
                <div className="h-full w-full overflow-hidden rounded-full">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Static advisor avatar. */}
                  <img src="/elysia.png" alt="Elysia" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }} />
                </div>
              </div>
            </div>
          </div>
          <h3 className="mb-3 text-center text-xl font-bold">Get personalized guidance from Elysia</h3>
          <p className="text-center text-sm leading-relaxed text-[#b8c7da]">Elysia provides personalized palm and astrological readings to help you understand yourself better and navigate life&apos;s journey.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.0 }} className="mb-8 w-full max-w-sm rounded-2xl border border-[#173653] bg-[#0b2338]/70 p-5 backdrop-blur-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#38bdf8]/15"><span className="text-lg">✨</span></div>
            <div>
              <h3 className="font-semibold">Compatibility Insights</h3>
              <p className="text-xs text-[#b8c7da]">Let&apos;s uncover them now</p>
            </div>
          </div>
          <StatsList stats={compatibilityStats} />
          <div className="mb-4 mt-4 space-y-4">
            <InsightRow icon="Love" title="Love" text="for you means passion and trust. We&apos;ve highlighted the signs that can match your loyalty and fire." />
            <InsightRow icon="Ring" title="Marriage" text="shows where loyalty, deep commitment, and emotional timing can meet." />
          </div>
          <p onClick={scrollToPayment} className="mb-4 cursor-pointer text-center text-sm text-[#38bdf8] hover:underline">More data in the full report</p>
          <Button onClick={scrollToPayment} className="h-12 w-full bg-[#38bdf8] text-base font-semibold text-black hover:bg-[#0ea5e9]" size="lg">
            Get Full Report
          </Button>
        </motion.div>

        <div ref={testimonialSectionRef} className="mb-8 w-full max-w-sm">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2 }} className="mb-4 flex items-center justify-center gap-3">
            <span className="text-3xl font-bold text-emerald-300">4.8</span>
            <div>
              <p className="text-sm text-[#b8c7da]">rating on <span className="font-semibold text-emerald-300">Trustpilot</span></p>
              <div className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <div key={star} className="flex h-4 w-4 items-center justify-center bg-emerald-500"><span className="text-[10px] text-white">★</span></div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }} className="relative mb-4 overflow-hidden rounded-2xl bg-gradient-to-b from-[#0b2a47] to-[#071a2b] p-6">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle, #38bdf8 1px, transparent 1px)", backgroundSize: "8px 8px" }} />
            <div className="relative text-center">
              <h3 className="mb-2 text-4xl font-bold text-[#38bdf8]">3.4 million</h3>
              <p className="text-sm italic text-[#b8c7da]">accurate predictions have been delivered</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }} className="mb-6 overflow-hidden">
            <div className="flex animate-scroll">
              {[...scrollingEmails, ...scrollingEmails].map((email, index) => (
                <div key={`${email}-${index}`} className="flex shrink-0 items-center gap-2 px-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#38bdf8]"><span className="text-xs font-semibold text-black">{email.charAt(0).toUpperCase()}</span></div>
                  <span className="whitespace-nowrap text-xs text-[#b8c7da]">{email}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="space-y-4">
            {testimonials.map((testimonial, index) => (
              <motion.div key={testimonial.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.5 + index * 0.1 }} className="rounded-2xl border border-[#173653] bg-[#0b2338]/70 p-4 backdrop-blur-sm">
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#38bdf8]"><span className="text-lg font-semibold text-black">{testimonial.name.charAt(0)}</span></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{testimonial.name}</span>
                      <span className="flex items-center gap-1 text-xs text-emerald-300"><span className="flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[8px] text-white">✓</span>Verified user</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[#8ba2bc]"><span>{testimonial.flag} {testimonial.country}</span><span>•</span><span>{testimonial.time}</span></div>
                    <div className="mt-1 flex gap-0.5">{[1, 2, 3, 4, 5].map((star) => <span key={star} className="text-xs text-[#38bdf8]">★</span>)}</div>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-[#b8c7da]">{testimonial.review}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div ref={birthChartSectionRef} className="mb-8 w-full max-w-sm">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.6 }} className="rounded-3xl bg-gradient-to-b from-[#102c45] to-[#071a2b] p-6">
            <h3 className="mb-6 text-center text-xl font-bold">Your birth chart analysis</h3>
            <div className="relative mb-4 rounded-2xl bg-white p-4">
              <p className="text-center text-sm text-slate-700">Your chart shows a <span className="font-medium text-cyan-500">rare spark</span> — let&apos;s uncover how you can use this power!</p>
              <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 bg-white" />
            </div>
            <div className="mb-6 flex justify-center">
              <div className="h-12 w-12 overflow-hidden rounded-full border-2 border-[#38bdf8]/50">
                {/* eslint-disable-next-line @next/next/no-img-element -- Static advisor avatar. */}
                <img src="/elysia.png" alt="Elysia" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "/logo.png"; }} />
              </div>
            </div>
            <div className="mb-6 flex justify-center">
              <div className="relative h-48 w-48">
                <div className="absolute inset-0 rounded-full bg-[#38bdf8]/20 blur-xl" />
                <div className="relative flex h-full w-full items-center justify-center rounded-full border border-[#38bdf8]/25 bg-gradient-to-b from-[#15314d] to-[#0b2338]">
                  <div className="flex h-36 w-36 items-center justify-center rounded-full border border-[#38bdf8]/25 bg-[#061525]/80">
                    <div className="text-center"><span className="text-3xl">✦</span><p className="mt-1 text-xs text-[#b8c7da]">Your Chart</p></div>
                  </div>
                </div>
              </div>
            </div>
            <h4 className="mb-4 text-center text-lg font-bold">Your core personality</h4>
            <div className="mb-4 space-y-4">
              <BirthInsight symbol="Sun" title="Sun sign" text="reveals you are naturally intuitive, emotionally intelligent, and deeply connected to those around you." />
              <BirthInsight symbol="Moon" title="Moon sign" text="shows your inner world is rich with empathy and creativity. Others see you as nurturing and protective." />
            </div>
            <p onClick={scrollToPayment} className="mb-4 cursor-pointer text-center text-sm text-[#38bdf8] hover:underline">More data in the full report</p>
            <Button onClick={scrollToPayment} className="h-12 w-full bg-[#38bdf8] text-base font-semibold text-black hover:bg-[#0ea5e9]" size="lg">Get Full Report</Button>
          </motion.div>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.7 }} className="mb-8 w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#102c45] to-[#071a2b] p-6">
          <h3 className="mb-6 text-center text-xl font-bold">What you&apos;ll find in PalmCosmic</h3>
          <div className="space-y-4">
            {[
              { title: "Palm Reading", desc: "Dive deeper into your personality" },
              { title: "Zodiac Matches", desc: "Get love matches, lucky places & more" },
              { title: "Your Birth Chart", desc: "Examine your chart and daily transits" },
              { title: "Anytime Advisor Access", desc: "Chat with Elysia anytime" },
              { title: "Personal Horoscopes", desc: "Find out what the day or year holds" },
            ].map((feature) => (
              <div key={feature.title} className="flex items-center gap-4">
                <span className="text-2xl text-[#38bdf8]">✦</span>
                <div className="flex-1"><p className="font-medium">{feature.title}</p><p className="text-xs text-[#b8c7da]">{feature.desc}</p></div>
                <Check className="h-5 w-5 text-[#38bdf8]" />
              </div>
            ))}
          </div>
          <Button onClick={scrollToPayment} className="mt-6 h-12 w-full bg-[#38bdf8] text-base font-semibold text-black hover:bg-[#0ea5e9]" size="lg">Try PalmCosmic</Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.8 }} className="w-full max-w-sm pb-[6rem]">
          <div className="mb-6 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- Small static app logo. */}
            <img src="/logo.png" alt="PalmCosmic" className="mb-2 h-12 w-12" />
            <p className="text-sm font-medium">PalmCosmic</p>
          </div>
          <Link href="/Terms/contact-us.html" target="_blank" className="block w-full">
            <Button variant="outline" className="mb-6 h-12 w-full border-[#38bdf8]/35 bg-transparent text-base text-[#38bdf8] hover:bg-[#38bdf8] hover:text-black">Contact Us</Button>
          </Link>
          <div className="grid grid-cols-2 gap-4 text-center">
            <Link href="/Terms/privacy-policy.html" target="_blank" className="text-sm text-[#38bdf8] hover:underline">Privacy Policy</Link>
            <Link href="/Terms/terms-of-service.html" target="_blank" className="text-sm text-[#38bdf8] hover:underline">Terms of Service</Link>
            <Link href="/Terms/billing-terms.html" target="_blank" className="text-sm text-[#38bdf8] hover:underline">Billing Terms</Link>
            <Link href="/Terms/money-back-policy.html" target="_blank" className="text-sm text-[#38bdf8] hover:underline">Money-Back Policy</Link>
          </div>
        </motion.div>
      </div>

      {showStickyCTA ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#061525] via-[#061525] to-transparent p-4">
          <div className="mx-auto max-w-sm">
            <Button onClick={scrollToPayment} className="h-14 w-full bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0ea5e9]" size="lg">
              Get personal prediction
            </Button>
          </div>
        </motion.div>
      ) : null}
    </motion.div>
  );
}

function StatsList({ stats }: { stats: Array<{ label: string; color: string; value: number }> }) {
  return (
    <div className="space-y-3">
      {stats.map((stat, index) => (
        <div key={stat.label} className="flex items-center gap-3">
          <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: stat.color }} />
          <span className="w-20 text-sm text-[#b8c7da]">{stat.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#15314d]">
            <motion.div className="h-full rounded-full" style={{ backgroundColor: stat.color }} initial={{ width: 0 }} animate={{ width: `${stat.value}%` }} transition={{ delay: 1 + index * 0.15, duration: 0.8 }} />
          </div>
          <span className="w-10 text-right text-sm text-[#b8c7da]">{stat.value}%</span>
        </div>
      ))}
    </div>
  );
}

function InsightRow({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#38bdf8]/15">
        <span className="text-xs font-semibold text-[#38bdf8]">{icon}</span>
      </div>
      <p className="text-sm text-[#b8c7da]">
        <span className="font-medium text-[#38bdf8]">{title}</span> {text}
      </p>
    </div>
  );
}

function BirthInsight({ symbol, title, text }: { symbol: string; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-10 shrink-0 text-lg font-semibold text-[#38bdf8]">{symbol}</span>
      <p className="text-sm text-[#b8c7da]">
        Your <span className="font-medium text-[#38bdf8]">{title}</span> {text}
      </p>
    </div>
  );
}
