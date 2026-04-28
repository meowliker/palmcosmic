"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, ChevronDown, ChevronUp, Heart, Moon, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackFunnelAction } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";
import { generateUserId } from "@/lib/user-profile";
import { runDemoPaymentBypass } from "@/lib/demo-payment";
import { cn } from "@/lib/utils";
import { CouponCodeLink } from "@/components/onboarding/CouponCodeLink";

const INTRO_SECONDS = 7 * 60 + 5;

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
  { icon: Heart, title: "Receive a personalized soulmate sketch and reading" },
  { icon: Moon, title: "Discover key traits, relationship energy, and meeting clues" },
  { icon: Sparkles, title: "Get clear guidance for recognizing the right connection" },
];

const trustPoints = [
  "Personalized from your birth details and soulmate preferences",
  "Built around the qualities and relationship energy you selected",
  "Private, secure checkout before unlocking your sketch and reading",
];

const reviews = [
  {
    name: "Lily",
    image: "/customer-reviews/customer-lily.png",
    title: "He felt real before we even met",
    body: "I ordered the soulmate sketch out of curiosity, but the reading described the exact energy I keep looking for. It made dating feel calmer and more intentional.",
  },
  {
    name: "Jordan",
    image: "/customer-reviews/customer-jordan.png",
    title: "A surprisingly accurate love reading",
    body: "The reading was specific and practical. It described the kind of connection I actually want and what I should stop repeating.",
  },
  {
    name: "Madison",
    image: "/customer-reviews/customer-madison.png",
    title: "The sketch made everything click",
    body: "The sketch instantly felt familiar. The guidance helped me understand what to look for instead of chasing the wrong pattern again.",
  },
];

const faqs = [
  {
    question: "What will my soulmate sketch include?",
    answer: "You unlock a personalized sketch direction and reading focused on appearance cues, emotional qualities, and relationship energy reflected in your answers.",
  },
  {
    question: "Is this based on the answers I gave?",
    answer: "Yes. Your selected gender, age range, visual preference, and partner quality help PalmCosmic shape the sketch and reading around what matters to you.",
  },
  {
    question: "Will my information stay private?",
    answer: "Yes. Your email and birth details are used to save your progress, restore access, and prepare your personalized soulmate sketch experience.",
  },
];

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function SoulmateHeroImages() {
  return (
    <div className="relative mx-auto mb-7 h-[21rem] w-full overflow-hidden rounded-[2rem] border border-[#38bdf8]/15 bg-[#09223a] shadow-[0_28px_70px_rgba(0,0,0,0.28)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(56,189,248,0.26),transparent_46%)]" />
      <div className="absolute left-8 top-14 h-52 w-40 -rotate-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#102942] shadow-[0_22px_48px_rgba(0,0,0,0.32)]">
        <Image src="/male.png" alt="Blurred male soulmate sketch preview" fill sizes="180px" className="object-cover" priority />
      </div>
      <div className="absolute right-8 top-20 h-52 w-40 rotate-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#102942] shadow-[0_22px_48px_rgba(0,0,0,0.32)]">
        <Image src="/female.png" alt="Blurred female soulmate sketch preview" fill sizes="180px" className="object-cover" priority />
      </div>
      <div className="absolute left-1/2 top-[52%] flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#38bdf8] text-5xl font-black text-black shadow-[0_18px_50px_rgba(56,189,248,0.38)]">
        ?
      </div>
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#061525] to-transparent" />
    </div>
  );
}

export default function SoulmateSketchPaywallPage() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(INTRO_SECONDS);
  const [openFaq, setOpenFaq] = useState(0);
  const [checkoutError, setCheckoutError] = useState("");
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  const timerLabel = useMemo(() => formatTime(secondsLeft), [secondsLeft]);

  useEffect(() => {
    pixelEvents.viewContent("Soulmate Sketch & Reading Paywall", "product");
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : INTRO_SECONDS));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const handleRevealClick = async (placement: "hero" | "footer") => {
    if (isCheckoutLoading) return;

    trackFunnelAction("soulmate_sketch_paywall_cta_clicked", {
      funnel: "soulmate_sketch",
      route: "/onboarding/soulmate-sketch/paywall",
      step_id: "soulmate_paywall",
      placement,
      product: "Soulmate Sketch & Reading",
    });

    pixelEvents.addToCart(0.99, "Soulmate Sketch & Reading");
    setCheckoutError("");
    setIsCheckoutLoading(true);

    try {
      const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
      localStorage.setItem("astrorekha_user_id", userId);

      const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
      if (!email) {
        router.push("/onboarding/soulmate-sketch/email");
        return;
      }

      const demoPayment = await runDemoPaymentBypass({ flow: "soulmate_sketch", email, userId });
      if (demoPayment.bypassed) {
        localStorage.setItem("astrorekha_payment_completed", "true");
        localStorage.setItem("palmcosmic_active_flow", "soulmate_sketch");
        trackFunnelAction("soulmate_sketch_demo_payment_bypassed", {
          funnel: "soulmate_sketch",
          route: "/onboarding/soulmate-sketch/paywall",
          step_id: "soulmate_paywall",
          placement,
          reports: demoPayment.reports?.join(",") || "soulmate_sketch",
        });
        router.push(demoPayment.redirectPath || "/onboarding/create-password?flow=soulmate_sketch&demo=true");
        return;
      }

      const response = await fetch("/api/stripe/create-soulmate-sketch-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          successPath: "/onboarding/create-password?flow=soulmate_sketch",
          cancelPath: "/onboarding/soulmate-sketch/paywall",
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.url) throw new Error(data?.error || "Unable to start checkout");

      trackFunnelAction("soulmate_sketch_subscription_checkout_created", {
        funnel: "soulmate_sketch",
        route: "/onboarding/soulmate-sketch/paywall",
        step_id: "soulmate_paywall",
        stripe_session_id: data.sessionId,
        product: "Soulmate Sketch & Reading",
        trial_price: 0.99,
        monthly_price: 9,
      });

      pixelEvents.initiateCheckout(0.99, ["soulmate_sketch"], data.metaEventId);
      pixelEvents.addPaymentInfo(0.99, "Soulmate Sketch & Reading Trial");
      window.location.href = data.url;
    } catch (error: any) {
      console.error("Soulmate sketch checkout failed:", error);
      trackFunnelAction("soulmate_sketch_subscription_checkout_failed", {
        funnel: "soulmate_sketch",
        route: "/onboarding/soulmate-sketch/paywall",
        step_id: "soulmate_paywall",
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
            <p className="text-sm font-semibold text-[#38bdf8]">Your soulmate reveal is ready</p>
            <p className="text-xs text-[#b8c7da]">Unlock your sketch and reading</p>
          </div>
          <div className="rounded-2xl bg-[#38bdf8] px-4 py-2 text-2xl font-bold tabular-nums text-black shadow-[0_14px_36px_rgba(56,189,248,0.25)]">{timerLabel}</div>
        </div>
      </section>

      <div className="mx-auto max-w-[30rem] px-5 pb-10 pt-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="text-center">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Image src="/logo.png" alt="PalmCosmic" width={42} height={42} className="rounded-full object-cover" priority />
            <span className="text-2xl font-semibold tracking-tight">PalmCosmic</span>
          </div>
          <SoulmateHeroImages />
          <h1 className="text-3xl font-bold leading-tight tracking-tight">Your Sketch & Reading Is Ready</h1>
          <p className="mx-auto mt-4 max-w-[24rem] text-base leading-relaxed text-[#b8c7da]">
            See the person you may be meant to meet, with a reading shaped around your answers and birth details.
          </p>
        </motion.div>

        <section className="mt-8 space-y-5">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div key={benefit.title} className="flex items-center gap-4 rounded-3xl border border-[#38bdf8]/15 bg-[#0a1d31] p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#38bdf8]/14 text-[#38bdf8]"><Icon className="h-6 w-6" /></div>
                <p className="text-base font-medium leading-snug text-white">{benefit.title}</p>
              </div>
            );
          })}
        </section>

        <div className="mt-8">
          <Button onClick={() => handleRevealClick("hero")} disabled={isCheckoutLoading} className="h-16 w-full rounded-2xl bg-[#38bdf8] text-lg font-bold text-black shadow-[0_20px_48px_rgba(56,189,248,0.3)] hover:bg-[#0284c7]">
            {isCheckoutLoading ? "Opening secure checkout..." : "Get My Soulmate Sketch & Reading"}
          </Button>
          <div className="mt-3 flex justify-center"><div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><Shield className="h-3.5 w-3.5" />Safe & Private Payment</div></div>
          <p className="mx-auto mt-4 max-w-[26rem] text-center text-xs leading-relaxed text-[#8ba2bc]">{legalLine}</p>
          <div className="flex justify-center">
            <CouponCodeLink flow="soulmate_sketch" route="/onboarding/soulmate-sketch/paywall" stepId="soulmate_paywall" emailPath="/onboarding/soulmate-sketch/email" />
          </div>
          {checkoutError ? <p className="mt-3 text-center text-sm text-red-300">{checkoutError}</p> : null}
        </div>

        <section className="mt-12 rounded-[2rem] border border-[#38bdf8]/15 bg-[#0a1d31] p-6 text-center">
          <h2 className="text-2xl font-bold">Why people trust PalmCosmic</h2>
          <div className="my-8 flex items-center justify-center gap-5"><span className="text-6xl font-black tracking-tight text-white">4.9</span><div className="text-left text-sm font-medium text-[#b8c7da]"><p>average rating</p><p>from happy users</p></div></div>
          <div className="space-y-4 text-left">
            {trustPoints.map((point) => <div key={point} className="flex items-start gap-3"><Check className="mt-0.5 h-5 w-5 shrink-0 text-[#38bdf8]" /><p className="text-sm leading-relaxed text-[#d8e5f3]">{point}</p></div>)}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-center text-3xl font-bold leading-tight">People finding clarity in love</h2>
          <div className="mt-7 space-y-6">
            {reviews.map((review) => (
              <article key={review.name} className="rounded-[2rem] border border-[#38bdf8]/15 bg-[#0a1d31] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.18)]">
                <div className="relative h-64 overflow-hidden rounded-[1.5rem] bg-[#071a2b]">
                  <Image src={review.image} alt={`${review.name} review portrait`} fill sizes="(max-width: 768px) 86vw, 390px" className="object-cover" />
                </div>
                <div className="mt-5"><p className="text-sm font-semibold text-[#8ba2bc]">{review.name}</p><p className="mt-2 text-xl text-[#38bdf8]">★★★★★</p><h3 className="mt-3 text-xl font-bold text-white">{review.title}</h3><p className="mt-2 text-base leading-relaxed text-[#d8e5f3]">{review.body}</p></div>
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
                  <button type="button" onClick={() => setOpenFaq(isOpen ? -1 : index)} className="flex w-full items-center justify-between gap-4 text-left"><span className="text-base font-bold text-white">{faq.question}</span>{isOpen ? <ChevronUp className="h-5 w-5 shrink-0 text-[#38bdf8]" /> : <ChevronDown className="h-5 w-5 shrink-0 text-[#38bdf8]" />}</button>
                  <div className={cn("grid transition-all duration-300", isOpen ? "grid-rows-[1fr] pt-4" : "grid-rows-[0fr]")}><p className="overflow-hidden text-sm leading-relaxed text-[#b8c7da]">{faq.answer}</p></div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <Button onClick={() => handleRevealClick("footer")} disabled={isCheckoutLoading} className="h-16 w-full rounded-2xl bg-[#38bdf8] text-lg font-bold text-black shadow-[0_20px_48px_rgba(56,189,248,0.3)] hover:bg-[#0284c7]">
            {isCheckoutLoading ? "Opening secure checkout..." : "View My Soulmate Guide"}
          </Button>
          <div className="mt-3 flex justify-center"><div className="inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><Shield className="h-3.5 w-3.5" />Safe & Private Payment</div></div>
        </section>

        <footer className="mt-8 pb-4 text-center text-xs leading-relaxed text-[#8ba2bc]"><p>{legalLine}</p><p className="mt-3">Your soulmate sketch and reading are for guidance and reflection, not a guarantee of future events or relationship outcomes.</p></footer>
      </div>
    </main>
  );
}
