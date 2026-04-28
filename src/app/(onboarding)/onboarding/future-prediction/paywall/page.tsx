"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Heart,
  Moon,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackFunnelAction } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";
import { generateUserId } from "@/lib/user-profile";
import { runDemoPaymentBypass } from "@/lib/demo-payment";
import { cn } from "@/lib/utils";
import { CouponCodeLink } from "@/components/onboarding/CouponCodeLink";

const INTRO_SECONDS = 14 * 60 + 36;

const legalLine = (
  <>
    (c) 2026 PalmCosmic. By continuing, you agree to our{" "}
    <a href="/terms-of-service" className="underline underline-offset-2">Terms</a>{" "}
    and{" "}
    <a href="/privacy-policy" className="underline underline-offset-2">Privacy Policy</a>.
    Start with an introductory offer of $0.99 USD for 3 days. After that, PalmCosmic Monthly Access renews at $9 USD/month and unlocks all reports while active. You can manage or cancel anytime.
  </>
);

const benefits = [
  {
    icon: Heart,
    title: "Understand the themes shaping your 2026",
  },
  {
    icon: Moon,
    title: "See your best timing for love, career, and change",
  },
  {
    icon: Sparkles,
    title: "Get clear guidance based on your birth chart answers",
  },
];

const trustPoints = [
  "Personalized forecast built from your birth details",
  "Month-by-month timing for key decisions",
  "Private, secure checkout before unlocking your report",
];

const reviews = [
  {
    name: "Olivia",
    image: "/customer-reviews/customer-olivia.png",
    title: "I finally saw the pattern",
    body: "The forecast made my next few months feel less random. It gave me a calm way to plan instead of overthinking every choice.",
  },
  {
    name: "Mason",
    image: "/customer-reviews/customer-mason.png",
    title: "The timing helped me act",
    body: "I was stuck between two big decisions. The 2026 breakdown helped me understand which windows felt strongest for moving forward.",
  },
  {
    name: "Chloe",
    image: "/customer-reviews/customer-chloe.png",
    title: "Aligned at last",
    body: "I liked that it connected my birth details with practical guidance. It felt personal, focused, and surprisingly grounding.",
  },
];

const faqs = [
  {
    question: "What will my 2026 prediction include?",
    answer:
      "Your report focuses on the major themes, monthly timing, lucky windows, relationship energy, career movement, and personal growth signals shown through your birth chart inputs.",
  },
  {
    question: "Is this based on the answers I gave?",
    answer:
      "Yes. Your onboarding answers help PalmCosmic focus the reading on the areas you care about most, so the prediction feels relevant instead of generic.",
  },
  {
    question: "Will my information stay private?",
    answer:
      "Yes. Your email and birth details are used to save your progress, restore access, and prepare your personalized report experience.",
  },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function FuturePredictionPaywallPage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(INTRO_SECONDS);
  const [openFaq, setOpenFaq] = useState(0);
  const [ctaMessage, setCtaMessage] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const timerLabel = useMemo(() => formatTime(secondsLeft), [secondsLeft]);

  useEffect(() => {
    pixelEvents.viewContent("2026 Future Prediction Paywall", "product");

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : INTRO_SECONDS));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const handleRevealClick = async (placement: "hero" | "footer") => {
    if (isCheckoutLoading) return;

    trackFunnelAction("future_prediction_paywall_cta_clicked", {
      funnel: "future_prediction",
      route: "/onboarding/future-prediction/paywall",
      step_id: "future_paywall",
      placement,
      product: "2026 Future Prediction",
    });

    pixelEvents.addToCart(0, "2026 Future Prediction");
    setCheckoutError("");
    setCtaMessage("");
    setIsCheckoutLoading(true);

    try {
      const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
      localStorage.setItem("astrorekha_user_id", userId);

      const email =
        localStorage.getItem("palmcosmic_email") ||
        localStorage.getItem("astrorekha_email") ||
        "";

      if (!email) {
        router.push("/onboarding/future-prediction/email");
        return;
      }

      const demoPayment = await runDemoPaymentBypass({ flow: "future_prediction", email, userId });
      if (demoPayment.bypassed) {
        localStorage.setItem("astrorekha_payment_completed", "true");
        localStorage.setItem("palmcosmic_active_flow", "future_prediction");
        trackFunnelAction("future_prediction_demo_payment_bypassed", {
          funnel: "future_prediction",
          route: "/onboarding/future-prediction/paywall",
          step_id: "future_paywall",
          placement,
          reports: demoPayment.reports?.join(",") || "prediction_2026",
        });
        router.push(demoPayment.redirectPath || "/onboarding/create-password?flow=future_prediction&demo=true");
        return;
      }

      const response = await fetch("/api/stripe/create-future-prediction-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          successPath: "/onboarding/create-password?flow=future_prediction",
          cancelPath: "/onboarding/future-prediction/paywall",
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout");
      }

      trackFunnelAction("future_prediction_subscription_checkout_created", {
        funnel: "future_prediction",
        route: "/onboarding/future-prediction/paywall",
        step_id: "future_paywall",
        stripe_session_id: data.sessionId,
        product: "2026 Future Prediction",
        trial_price: 0.99,
        monthly_price: 9,
      });

      pixelEvents.initiateCheckout(0.99, ["prediction_2026"], data.metaEventId);
      pixelEvents.addPaymentInfo(0.99, "2026 Future Prediction Trial");
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Future prediction checkout failed:", error);
      trackFunnelAction("future_prediction_subscription_checkout_failed", {
        funnel: "future_prediction",
        route: "/onboarding/future-prediction/paywall",
        step_id: "future_paywall",
        error: error?.message || "unknown",
      });
      setCheckoutError(error?.message || "Unable to start checkout. Please try again.");
      setIsCheckoutLoading(false);
    }
  };

  return (
    <main className="min-h-[100svh] bg-[#061525] text-white">
      <section className="sticky top-0 z-20 border-b border-[#38bdf8]/15 bg-[#071a2b]/95 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[28rem] items-center justify-between gap-4">
          <div className="leading-tight">
            <p className="text-sm font-semibold text-[#38bdf8]">Your 2026 forecast is ready</p>
            <p className="text-xs text-[#b8c7da]">Unlock your personal timing map</p>
          </div>
          <div className="rounded-2xl bg-[#38bdf8] px-4 py-2 text-2xl font-bold tabular-nums text-black shadow-[0_14px_36px_rgba(56,189,248,0.25)]">
            {timerLabel}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[30rem] px-5 pb-10 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center"
        >
          <div className="mb-6 flex items-center justify-center gap-3">
            <Image
              src="/logo.png"
              alt="PalmCosmic"
              width={42}
              height={42}
              className="rounded-full object-cover"
              priority
            />
            <span className="text-2xl font-semibold tracking-tight">PalmCosmic</span>
          </div>

          <div className="relative mx-auto mb-7 h-[17rem] w-full overflow-visible">
            <div className="absolute left-1/2 top-1/2 h-[15rem] w-[15rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#38bdf8]/18 blur-3xl" />
            <div className="absolute inset-x-8 bottom-7 h-16 rounded-full bg-[#38bdf8]/18 blur-2xl" />
            <Image
              src="/future-paywall-portal.png"
              alt="Meditating person in a cosmic portal"
              fill
              sizes="(max-width: 768px) 92vw, 440px"
              className="object-contain drop-shadow-[0_0_34px_rgba(56,189,248,0.42)]"
              priority
            />
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight">
            Your 2026 Prediction Is Ready
          </h1>
          <p className="mx-auto mt-4 max-w-[24rem] text-base leading-relaxed text-[#b8c7da]">
            Reveal the timing, themes, and turning points your birth chart highlights for the year ahead.
          </p>
        </motion.div>

        <section className="mt-8 space-y-5">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className="flex items-center gap-4 rounded-3xl border border-[#38bdf8]/15 bg-[#0a1d31] p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/14 text-[#38bdf8]">
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-base font-medium leading-snug text-white">{benefit.title}</p>
              </div>
            );
          })}
        </section>

        <div className="mt-8">
          <Button
            onClick={() => handleRevealClick("hero")}
            disabled={isCheckoutLoading}
            className="h-16 w-full rounded-2xl bg-[#38bdf8] text-lg font-bold text-black shadow-[0_20px_48px_rgba(56,189,248,0.3)] hover:bg-[#0284c7]"
          >
            {isCheckoutLoading ? "Opening secure checkout..." : "Reveal My 2026 Prediction"}
          </Button>
          <div className="mt-3 flex justify-center">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              Safe and private payment
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-[26rem] text-center text-xs leading-relaxed text-[#8ba2bc]">
            {legalLine}
          </p>
          <div className="flex justify-center">
            <CouponCodeLink flow="future_prediction" route="/onboarding/future-prediction/paywall" stepId="future_paywall" emailPath="/onboarding/future-prediction/email" />
          </div>
          {ctaMessage ? <p className="mt-3 text-center text-sm text-[#b8c7da]">{ctaMessage}</p> : null}
          {checkoutError ? <p className="mt-3 text-center text-sm text-red-300">{checkoutError}</p> : null}
        </div>

        <section className="mt-12 rounded-[2rem] border border-[#38bdf8]/15 bg-[#0a1d31] p-6 text-center">
          <h2 className="text-2xl font-bold">Why people trust PalmCosmic</h2>
          <div className="my-8 flex items-center justify-center gap-5">
            <span className="text-6xl font-black tracking-tight text-white">4.9</span>
            <div className="text-left text-sm font-medium text-[#b8c7da]">
              <p>average rating</p>
              <p>from happy users</p>
            </div>
          </div>
          <div className="space-y-4 text-left">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#38bdf8]" />
                <p className="text-sm leading-relaxed text-[#d8e5f3]">{point}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center text-3xl font-bold leading-tight">Users who wanted clearer timing</h2>
          <div className="mt-7 space-y-6">
            {reviews.map((review) => (
              <article key={review.name} className="rounded-[2rem] border border-[#38bdf8]/15 bg-[#0a1d31] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
                <div className="relative h-64 overflow-hidden rounded-[1.5rem] bg-[#071a2b]">
                  <Image
                    src={review.image}
                    alt={`${review.name} review portrait`}
                    fill
                    sizes="(max-width: 768px) 86vw, 390px"
                    className="object-cover"
                  />
                </div>
                <div className="mt-5">
                  <p className="text-sm font-semibold text-[#8ba2bc]">{review.name}</p>
                  <p className="mt-2 text-xl text-[#38bdf8]">★★★★★</p>
                  <h3 className="mt-3 text-xl font-bold text-white">{review.title}</h3>
                  <p className="mt-2 text-base leading-relaxed text-[#d8e5f3]">{review.body}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center text-3xl font-bold leading-tight">Questions before unlocking?</h2>
          <div className="mt-7 divide-y divide-[#38bdf8]/12 rounded-[2rem] border border-[#38bdf8]/15 bg-[#0a1d31]">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question} className="p-5">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <span className="text-base font-bold text-white">{faq.question}</span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 shrink-0 text-[#38bdf8]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 shrink-0 text-[#38bdf8]" />
                    )}
                  </button>
                  <div
                    className={cn(
                      "grid transition-all duration-300",
                      isOpen ? "grid-rows-[1fr] pt-4" : "grid-rows-[0fr]"
                    )}
                  >
                    <p className="overflow-hidden text-sm leading-relaxed text-[#b8c7da]">{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <Button
            onClick={() => handleRevealClick("footer")}
            disabled={isCheckoutLoading}
            className="h-16 w-full rounded-2xl bg-[#38bdf8] text-lg font-bold text-black shadow-[0_20px_48px_rgba(56,189,248,0.3)] hover:bg-[#0284c7]"
          >
            {isCheckoutLoading ? "Opening secure checkout..." : "Unlock My Forecast"}
          </Button>
          <div className="mt-3 flex justify-center">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              Secure checkout coming next
            </div>
          </div>
        </section>

        <footer className="mt-8 pb-4 text-center text-xs leading-relaxed text-[#8ba2bc]">
          <p>{legalLine}</p>
          <p className="mt-3">
            Your personalized prediction is for guidance and reflection, not a substitute for professional financial, medical, or legal advice.
          </p>
        </footer>
      </div>
    </main>
  );
}
