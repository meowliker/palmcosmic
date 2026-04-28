"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { useHaptic } from "@/hooks/useHaptic";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { generateUserId } from "@/lib/user-profile";
import { trackFunnelAction, trackLeadCaptured } from "@/lib/analytics-events";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ANSWER_KEYS = [
  "soulmate-partner-gender",
  "soulmate-age-range",
  "soulmate-visual-style",
  "soulmate-core-quality",
  "attracted_to",
  "age_group",
  "appearance_preference",
  "vibe",
];

export default function SoulmateSketchEmailPage() {
  const router = useRouter();
  const { triggerLight } = useHaptic();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    gender,
    birthMonth,
    birthDay,
    birthYear,
    birthHour,
    birthMinute,
    birthPeriod,
    birthPlace,
    knowsBirthTime,
    relationshipStatus,
    goals,
    colorPreference,
    elementPreference,
    sunSign,
    moonSign,
    ascendantSign,
    modality,
    polarity,
  } = useOnboardingStore();

  const trimmedEmail = email.trim();
  const isEmailValid = useMemo(
    () => EMAIL_PATTERN.test(trimmedEmail),
    [trimmedEmail]
  );

  const validateEmail = () => {
    if (!trimmedEmail) {
      setEmailError("Please enter your email address.");
      return false;
    }

    if (!isEmailValid) {
      setEmailError("Please enter a valid email address.");
      return false;
    }

    setEmailError("");
    return true;
  };

  const getSoulmateSketchAnswers = () => {
    if (typeof window === "undefined") return {};

    return ANSWER_KEYS.reduce<Record<string, string | null>>((answers, key) => {
      answers[key] =
        localStorage.getItem(`palmcosmic_${key}`) ||
        localStorage.getItem(`astrorekha_${key}`) ||
        null;
      return answers;
    }, {});
  };

  const saveSoulmateAnswers = async (userId: string) => {
    const answers = getSoulmateSketchAnswers();
    const compactAnswers = Object.fromEntries(
      Object.entries(answers).filter(([, value]) => Boolean(value))
    );

    if (Object.keys(compactAnswers).length === 0) return;

    await fetch("/api/soulmate-sketch/answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, answers: compactAnswers }),
    });
  };

  const saveOnboardingSnapshot = async (normalizedEmail: string) => {
    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);

    const snapshotResponse = await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email: normalizedEmail,
        currentRoute: "/onboarding/soulmate-sketch/email",
        currentStep: "soulmate-sketch-email",
        priorityArea: "soulmate_sketch",
        answers: getSoulmateSketchAnswers(),
        source: "soulmate_sketch_email",
        onboardingData: {
          gender,
          birthMonth,
          birthDay,
          birthYear,
          birthHour,
          birthMinute,
          birthPeriod,
          birthPlace,
          knowsBirthTime,
          relationshipStatus,
          goals: goals || [],
          colorPreference,
          elementPreference,
          sunSign,
          moonSign,
          ascendantSign,
          modality,
          polarity,
        },
      }),
    });

    if (!snapshotResponse.ok) {
      const data = await snapshotResponse.json().catch(() => null);
      throw new Error(data?.error || "Unable to save onboarding progress");
    }

    await saveSoulmateAnswers(userId);
    return userId;
  };

  const handleContinue = async () => {
    triggerLight();

    if (!validateEmail()) return;

    setIsSubmitting(true);

    const normalizedEmail = trimmedEmail.toLowerCase();
    localStorage.setItem("astrorekha_email", normalizedEmail);
    localStorage.setItem("palmcosmic_email", normalizedEmail);

    try {
      trackFunnelAction("soulmate_sketch_email_submit_started", {
        funnel: "soulmate_sketch",
        route: "/onboarding/soulmate-sketch/email",
        step_id: "soulmate_email",
      });

      const savedUserId = await saveOnboardingSnapshot(normalizedEmail);
      trackLeadCaptured({
        event_id: `lead_${savedUserId}`,
        funnel: "soulmate_sketch",
        route: "/onboarding/soulmate-sketch/email",
        step_id: "soulmate_email",
        lead_source: "soulmate_sketch_email",
      });

      router.push("/onboarding/soulmate-sketch/paywall");
    } catch (error) {
      console.error("Soulmate sketch email step failed:", error);
      trackFunnelAction("soulmate_sketch_email_submit_failed", {
        funnel: "soulmate_sketch",
        route: "/onboarding/soulmate-sketch/email",
        step_id: "soulmate_email",
      });
      setEmailError("We couldn't save your progress. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 min-h-[100svh] bg-[#061525] text-white flex flex-col"
    >
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[99%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-10 pb-6">
        <div className="text-center">
          <h1 className="mx-auto max-w-[25rem] text-2xl md:text-3xl leading-tight font-semibold tracking-tight">
            Sign up to save your soulmate sketch with PalmCosmic
          </h1>

          <p className="mx-auto mt-7 max-w-[23rem] text-base leading-relaxed text-[#b8c7da]">
            Your personal data is safe with us. We will use your email for access, receipts, and restoring your sketch if you return later.
          </p>
        </div>

        <div className="mt-12">
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (emailError) setEmailError("");
            }}
            onBlur={() => {
              if (trimmedEmail) validateEmail();
            }}
            className={cn(
              "w-full h-16 rounded-2xl border bg-[#0a1d31] px-5 text-lg text-white outline-none transition-all",
              "placeholder:text-[#7f91a8] focus:border-[#38bdf8] focus:ring-4 focus:ring-[#38bdf8]/15",
              emailError ? "border-red-400" : "border-[#38bdf8]/35"
            )}
          />

          {emailError ? (
            <p className="mt-3 text-sm font-medium text-red-300">
              {emailError}
            </p>
          ) : null}
        </div>

        <div className="mt-auto">
          <Button
            onClick={handleContinue}
            disabled={!isEmailValid || isSubmitting}
            className={cn(
              "w-full h-[56px] rounded-xl text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)]",
              "bg-[#38bdf8] hover:bg-[#0284c7]",
              "disabled:bg-[#15314d] disabled:text-[#7f91a8] disabled:shadow-none"
            )}
          >
            {isSubmitting ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
