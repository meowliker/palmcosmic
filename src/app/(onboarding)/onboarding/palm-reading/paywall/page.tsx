"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Hand, Heart, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackFunnelAction } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";
import { generateUserId } from "@/lib/user-profile";
import { runDemoPaymentBypass } from "@/lib/demo-payment";
import { cn } from "@/lib/utils";
import { CouponCodeLink } from "@/components/onboarding/CouponCodeLink";
import { OnboardingMenuButton } from "@/components/onboarding/OnboardingMenuButton";

const INTRO_SECONDS = 12 * 60 + 45;

const legalLine = (
  <>
    © 2026 PalmCosmic. By continuing, you agree to our{" "}
    <a href="/Terms/terms-of-service.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Terms</a>{" "}
    and{" "}
    <a href="/Terms/privacy-policy.html" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Privacy Policy</a>.
    Start with an introductory offer of $0.99 USD for 3 days. After that, PalmCosmic Monthly Access renews at $9 USD/month and unlocks all reports while active. You can manage or cancel anytime.
  </>
);

const benefits = [
  { icon: Hand, title: "Reveal what your heart, head, life, and fate lines suggest" },
  { icon: Heart, title: "Understand emotional patterns, strengths, and relationship signals" },
  { icon: Sparkles, title: "Unlock your palm reading plus birth chart during the trial" },
];

const trustPoints = [
  "Personalized from your palm-line answers and birth details",
  "Focused on the life areas you selected in the funnel",
  "Private, secure checkout before unlocking your reading",
];

const reviews = [
  {
    name: "Hannah",
    image: "/customer-reviews/customer-hannah.png",
    title: "My palm finally made sense",
    body: "The reading explained why I overthink love and decisions. It felt like someone translated patterns I had noticed for years.",
  },
  {
    name: "Nolan",
    image: "/customer-reviews/customer-nolan.png",
    title: "Clearer than I expected",
    body: "I came for curiosity, but the life-line and career notes were practical. It helped me trust the direction I was already feeling.",
  },
  {
    name: "Claire",
    image: "/customer-reviews/customer-claire.png",
    title: "A surprisingly personal reading",
    body: "The palm analysis connected my emotional patterns with my birth details. It felt thoughtful, grounded, and easy to understand.",
  },
];

const faqs = [
  {
    question: "What will my palm reading include?",
    answer:
      "Your reading explains major palm lines, emotional tendencies, personality strengths, relationship signals, timing clues, and a birth-chart layer for deeper context.",
  },
  {
    question: "Do I unlock anything else with this flow?",
    answer:
      "Yes. The palm reading flow unlocks both your Palm Reading and Birth Chart during the 3-day trial. If the monthly subscription becomes active, all reports unlock while the subscription stays active.",
  },
  {
    question: "Will my information stay private?",
    answer:
      "Yes. Your email, birth details, and palm answers are used to save progress, restore access, and prepare your personalized report experience.",
  },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export default function PalmReadingPaywallPage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(INTRO_SECONDS);
  const [openFaq, setOpenFaq] = useState(0);
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const timerLabel = useMemo(() => formatTime(secondsLeft), [secondsLeft]);

  useEffect(() => {
    pixelEvents.viewContent("Palm Reading Paywall", "product");

    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : INTRO_SECONDS));
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  const handleRevealClick = async (placement: "hero" | "footer") => {
    if (isCheckoutLoading) return;

    trackFunnelAction("palm_reading_paywall_cta_clicked", {
      funnel: "palm_reading",
      route: "/onboarding/palm-reading/paywall",
      step_id: "palm_paywall",
      placement,
      product: "Palm Reading & Birth Chart",
    });

    pixelEvents.addToCart(0, "Palm Reading & Birth Chart");
    setCheckoutError("");
    setIsCheckoutLoading(true);

    try {
      const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
      localStorage.setItem("astrorekha_user_id", userId);

      const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
      if (!email) {
        router.push("/onboarding/palm-reading/email");
        return;
      }

      const demoPayment = await runDemoPaymentBypass({ flow: "palm_reading", email, userId });
      if (demoPayment.bypassed) {
        localStorage.setItem("astrorekha_payment_completed", "true");
        localStorage.setItem("palmcosmic_active_flow", "palm_reading");
        trackFunnelAction("palm_reading_demo_payment_bypassed", {
          funnel: "palm_reading",
          route: "/onboarding/palm-reading/paywall",
          step_id: "palm_paywall",
          placement,
          reports: demoPayment.reports?.join(",") || "palm_reading,birth_chart",
        });
        router.push(demoPayment.redirectPath || "/onboarding/create-password?flow=palm_reading&demo=true");
        return;
      }

      const response = await fetch("/api/stripe/create-palm-reading-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          successPath: "/onboarding/create-password?flow=palm_reading",
          cancelPath: "/onboarding/palm-reading/paywall",
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Unable to start checkout");
      }

      trackFunnelAction("palm_reading_subscription_checkout_created", {
        funnel: "palm_reading",
        route: "/onboarding/palm-reading/paywall",
        step_id: "palm_paywall",
        stripe_session_id: data.sessionId,
        product: "Palm Reading & Birth Chart",
        trial_price: 0.99,
        monthly_price: 9,
      });

      pixelEvents.initiateCheckout(0.99, ["palm_reading", "birth_chart"], data.metaEventId);
      pixelEvents.addPaymentInfo(0.99, "Palm Reading & Birth Chart Trial");
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Palm reading checkout failed:", error);
      trackFunnelAction("palm_reading_subscription_checkout_failed", {
        funnel: "palm_reading",
        route: "/onboarding/palm-reading/paywall",
        step_id: "palm_paywall",
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
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-semibold text-[#38bdf8]">Your palm reading is ready</p>
            <p className="text-xs text-[#b8c7da]">Unlock your line-by-line guide</p>
          </div>
          <div className="rounded-2xl bg-[#38bdf8] px-4 py-2 text-2xl font-bold tabular-nums text-black shadow-[0_14px_36px_rgba(56,189,248,0.25)]">
            {timerLabel}
          </div>
          <OnboardingMenuButton className="-mr-2 shrink-0" />
        </div>
      </section>

      <div className="mx-auto max-w-[30rem] px-5 pb-10 pt-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Image src="/logo.png" alt="PalmCosmic" width={42} height={42} className="rounded-full object-cover" priority />
            <span className="text-2xl font-semibold tracking-tight">PalmCosmic</span>
          </div>

          <div className="relative mx-auto mb-7 h-[17rem] w-full overflow-visible">
            <div className="absolute left-1/2 top-1/2 h-[15rem] w-[15rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#38bdf8]/16 blur-3xl" />
            <div className="absolute inset-x-8 bottom-7 h-16 rounded-full bg-[#a78bfa]/18 blur-2xl" />
            <Image
              src="/palm-reading-paywall.png"
              alt="Glowing palm line reading preview"
              fill
              sizes="(max-width: 768px) 92vw, 440px"
              className="object-contain drop-shadow-[0_0_34px_rgba(56,189,248,0.38)]"
              priority
            />
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight">Your Palm Reading Is Ready</h1>
          <p className="mx-auto mt-4 max-w-[24rem] text-base leading-relaxed text-[#b8c7da]">
            Reveal what your palm lines say about your emotions, strengths, timing, and life direction.
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
          <Button onClick={() => handleRevealClick("hero")} disabled={isCheckoutLoading} className="h-16 w-full rounded-2xl bg-[#38bdf8] text-lg font-bold text-black shadow-[0_20px_48px_rgba(56,189,248,0.3)] hover:bg-[#0284c7]">
            {isCheckoutLoading ? "Opening secure checkout..." : "Reveal My Palm Reading"}
          </Button>
          <div className="mt-3 flex justify-center">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              Safe and private payment
            </div>
          </div>
          <p className="mx-auto mt-4 max-w-[26rem] text-center text-xs leading-relaxed text-[#8ba2bc]">{legalLine}</p>
          <div className="flex justify-center">
            <CouponCodeLink flow="palm_reading" route="/onboarding/palm-reading/paywall" stepId="palm_paywall" emailPath="/onboarding/palm-reading/email" />
          </div>
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
          <h2 className="text-center text-3xl font-bold leading-tight">Users who wanted deeper self-understanding</h2>
          <div className="mt-7 space-y-6">
            {reviews.map((review) => (
              <article key={review.name} className="rounded-[2rem] border border-[#38bdf8]/15 bg-[#0a1d31] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
                <div className="relative h-64 overflow-hidden rounded-[1.5rem] bg-[#071a2b]">
                  <Image src={review.image} alt={`${review.name} review portrait`} fill sizes="(max-width: 768px) 86vw, 390px" className="object-cover" />
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
                  <button type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)} className="flex w-full items-center justify-between gap-4 text-left">
                    <span className="text-base font-bold text-white">{faq.question}</span>
                    {isOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-[#38bdf8]" /> : <ChevronDown className="h-5 w-5 shrink-0 text-[#38bdf8]" />}
                  </button>
                  <div className={cn("grid transition-all duration-300", isOpen ? "grid-rows-[1fr] pt-4" : "grid-rows-[0fr]")}> 
                    <p className="overflow-hidden text-sm leading-relaxed text-[#b8c7da]">{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <Button onClick={() => handleRevealClick("footer")} disabled={isCheckoutLoading} className="h-16 w-full rounded-2xl bg-[#38bdf8] text-lg font-bold text-black shadow-[0_20px_48px_rgba(56,189,248,0.3)] hover:bg-[#0284c7]">
            {isCheckoutLoading ? "Opening secure checkout..." : "Unlock My Palm Guide"}
          </Button>
          <div className="mt-3 flex justify-center">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
              <Shield className="h-3.5 w-3.5" />
              Safe and private payment
            </div>
          </div>
        </section>

        <footer className="mt-8 pb-4 text-center text-xs leading-relaxed text-[#8ba2bc]">
          <p>{legalLine}</p>
          <p className="mt-3">Your personalized palm reading is for guidance and reflection, not a substitute for professional financial, medical, or legal advice.</p>
        </footer>
      </div>
    </main>
  );
}
