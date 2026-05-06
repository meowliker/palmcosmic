"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";
import { pixelEvents } from "@/lib/pixel-events";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { calculateZodiacSign, generateUserId } from "@/lib/user-profile";
import { trackFunnelAction, trackLeadCaptured } from "@/lib/analytics-events";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const READING_STATS = [
  { label: "Love", color: "#38bdf8", value: 85 },
  { label: "Health", color: "#7dd3fc", value: 91 },
  { label: "Wisdom", color: "#22d3ee", value: 78 },
  { label: "Career", color: "#0ea5e9", value: 65 },
];

function getSoulmateAnswers() {
  try {
    const saved = localStorage.getItem("astrorekha_soulmate_answers");
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export default function OnboardingEmailPage() {
  const router = useRouter();
  const { triggerLight } = useHaptic();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [palmImage, setPalmImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onboarding = useOnboardingStore();
  const trimmedEmail = email.trim();
  const isEmailValid = useMemo(() => EMAIL_PATTERN.test(trimmedEmail), [trimmedEmail]);

  useEffect(() => {
    const savedImage = localStorage.getItem("astrorekha_palm_image");
    if (savedImage) setPalmImage(savedImage);

    pixelEvents.viewContent("Palm Reading Report Preview", "report");
    trackFunnelAction("onboarding_email_viewed", {
      route: "/onboarding/email",
      step_id: "email",
      has_palm_image: Boolean(savedImage),
    });
  }, []);

  const validateEmail = () => {
    if (!trimmedEmail) {
      setEmailError("Please enter your email address to continue.");
      return false;
    }
    if (!isEmailValid) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    setEmailError(null);
    return true;
  };

  const persistEmailData = async (normalizedEmail: string) => {
    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);
    localStorage.setItem("astrorekha_email", normalizedEmail);
    localStorage.setItem("astrorekha_checkout_email", normalizedEmail);
    localStorage.setItem("palmcosmic_email", normalizedEmail);
    localStorage.setItem("palmcosmic_active_flow", "palm_reading");

    const zodiacSign = calculateZodiacSign(onboarding.birthMonth, onboarding.birthDay);
    const birthDate =
      onboarding.birthYear && onboarding.birthMonth && onboarding.birthDay
        ? `${onboarding.birthYear}-${onboarding.birthMonth}-${onboarding.birthDay}`
        : null;
    const soulmateAnswers = getSoulmateAnswers();

    if (palmImage) {
      await fetch("/api/palm-reading/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: normalizedEmail,
          imageData: palmImage,
          birthDate,
          birthMonth: onboarding.birthMonth,
          birthDay: onboarding.birthDay,
          birthYear: onboarding.birthYear,
          zodiacSign,
        }),
      }).catch((error) => {
        console.error("[onboarding/email] palm image email update failed:", error);
      });
    }

    const snapshotResponse = await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email: normalizedEmail,
        currentRoute: "/onboarding/email",
        currentStep: "email",
        priorityArea: "palm_reading",
        answers: {
          email: normalizedEmail,
          palmImageSaved: Boolean(palmImage) || localStorage.getItem("palmcosmic_palm_image_saved") === "true",
          soulmateAnswers,
        },
        source: "onboarding_email",
        onboardingData: {
          gender: onboarding.gender,
          birthMonth: onboarding.birthMonth,
          birthDay: onboarding.birthDay,
          birthYear: onboarding.birthYear,
          birthHour: onboarding.birthHour,
          birthMinute: onboarding.birthMinute,
          birthPeriod: onboarding.birthPeriod,
          birthPlace: onboarding.birthPlace,
          knowsBirthTime: onboarding.knowsBirthTime,
          relationshipStatus: onboarding.relationshipStatus,
          goals: onboarding.goals || [],
          colorPreference: onboarding.colorPreference,
          elementPreference: onboarding.elementPreference,
          zodiacSign,
          sunSign: onboarding.sunSign?.name || null,
          moonSign: onboarding.moonSign?.name || null,
          ascendantSign: onboarding.ascendantSign?.name || null,
          modality: onboarding.modality,
          polarity: onboarding.polarity,
          soulmateAnswers,
          palmImageSaved: Boolean(palmImage) || localStorage.getItem("palmcosmic_palm_image_saved") === "true",
        },
      }),
    });

    if (!snapshotResponse.ok) {
      const data = await snapshotResponse.json().catch(() => null);
      throw new Error(data?.error || "Unable to save your email");
    }

    return userId;
  };

  const handleContinue = async () => {
    triggerLight();
    if (!validateEmail()) return;

    setIsSubmitting(true);
    const normalizedEmail = trimmedEmail.toLowerCase();

    try {
      pixelEvents.addToWishlist("Personalized Palm Reading Report");
      trackFunnelAction("onboarding_email_submit_started", {
        route: "/onboarding/email",
        step_id: "email",
      });

      const userId = await persistEmailData(normalizedEmail);
      trackLeadCaptured({
        event_id: `lead_${userId}`,
        route: "/onboarding/email",
        step_id: "email",
        funnel: "palm_reading",
        lead_source: "onboarding_email",
      });

      const stateResponse = await fetch(`/api/user/payment-state?email=${encodeURIComponent(normalizedEmail)}`, {
        cache: "no-store",
      });

      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        if (stateData?.hasPaid) {
          localStorage.setItem("astrorekha_payment_completed", "true");

          if (stateData?.isRegistered) {
            router.push(`/login?email=${encodeURIComponent(normalizedEmail)}`);
            return;
          }

          router.push("/registration?flow=palm_reading&recovered=true");
          return;
        }
      }

      trackFunnelAction("onboarding_email_submit_completed", {
        route: "/onboarding/email",
        step_id: "email",
        user_id: userId,
        next_route: "/paywall",
      });
      router.push("/paywall");
    } catch (error) {
      console.error("[onboarding/email] submit failed:", error);
      trackFunnelAction("onboarding_email_submit_failed", {
        route: "/onboarding/email",
        step_id: "email",
        error: error instanceof Error ? error.message : "submit_failed",
      });
      setEmailError("We couldn't save your progress. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white">
      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 py-8">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center text-xl font-bold md:text-2xl">
          Your palm reading report is ready
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6 w-full max-w-sm rounded-2xl border border-[#173653] bg-[#0b2338] p-4">
          <h2 className="mb-4 text-sm font-semibold uppercase text-[#b8c7da]">Overview</h2>

          <div className="mb-4 flex gap-4">
            <div className="h-28 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-[#15314d]">
              {palmImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- Captured/uploaded data URLs are not suitable for next/image optimization.
                <img src={palmImage} alt="Your palm" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-[#b8c7da]">Palm</div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              {READING_STATS.map((stat, index) => (
                <div key={stat.label} className="space-y-1">
                  <div className="flex justify-between text-xs text-[#b8c7da]">
                    <span>{stat.label}</span>
                    <span>{stat.value}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#15314d]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: stat.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${stat.value}%` }}
                      transition={{ delay: 0.5 + index * 0.15, duration: 0.8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 text-sm text-[#b8c7da]">
            <p>
              Your <span className="font-medium text-[#38bdf8]">Heart Line</span> shows passionate expression and strong emotional awareness.
            </p>
            <p>
              Your <span className="font-medium text-[#7dd3fc]">Life Line</span> points to renewal, resilience, and steady movement toward your goals.
            </p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="w-full max-w-sm">
          <h2 className="mb-4 text-center text-lg font-semibold">
            Sign up to understand yourself better with PalmCosmic
          </h2>

          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError(null);
            }}
            onBlur={() => {
              if (trimmedEmail) validateEmail();
            }}
            className="mb-2 h-12 w-full rounded-lg border border-[#38bdf8]/35 bg-white px-4 text-[#061525] caret-[#0284c7] outline-none placeholder:text-[#7f91a8] focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/20"
          />

          {emailError ? <p className="mb-4 text-center text-sm text-red-300">{emailError}</p> : null}

          <div className="mb-6 flex items-start gap-2 text-xs text-[#b8c7da]">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#38bdf8]" />
            <p>
              Your personal data is safe with us. We&apos;ll use your email for access, receipts, and restoring your reading.
            </p>
          </div>
        </motion.div>
      </div>

      <div className="px-6 pb-6">
        <Button
          onClick={handleContinue}
          disabled={!isEmailValid || isSubmitting}
          className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#7f91a8] disabled:shadow-none"
          size="lg"
        >
          {isSubmitting ? "Saving..." : "Continue"}
        </Button>
      </div>
    </motion.div>
  );
}
