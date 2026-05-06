"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { Button } from "@/components/ui/button";
import { LocationInput } from "@/components/onboarding/LocationInput";
import { useHaptic } from "@/hooks/useHaptic";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";

export default function BirthplacePage() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const { birthPlace, setBirthPlace } = onboarding;
  const { triggerLight } = useHaptic();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    pixelEvents.viewContent("Birthplace Step", "onboarding_step");
  }, []);

  const persistBirthplaceSnapshot = async (userId: string) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const onboardingData = {
      gender: onboarding.gender,
      birthMonth: onboarding.birthMonth,
      birthDay: onboarding.birthDay,
      birthYear: onboarding.birthYear,
      birthHour: onboarding.birthHour,
      birthMinute: onboarding.birthMinute,
      birthPeriod: onboarding.birthPeriod,
      birthPlace,
      knowsBirthTime: onboarding.knowsBirthTime,
      relationshipStatus: onboarding.relationshipStatus,
      goals: onboarding.goals,
      colorPreference: onboarding.colorPreference,
      elementPreference: onboarding.elementPreference,
      sunSign: onboarding.sunSign?.name || null,
      moonSign: onboarding.moonSign?.name || null,
      ascendantSign: onboarding.ascendantSign?.name || null,
      modality: onboarding.modality,
      polarity: onboarding.polarity,
    };

    const response = await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        currentRoute: "/onboarding/birthplace",
        currentStep: "birthplace",
        answers: {
          gender: onboarding.gender,
          birthMonth: onboarding.birthMonth,
          birthDay: onboarding.birthDay,
          birthYear: onboarding.birthYear,
          birthHour: onboarding.birthHour,
          birthMinute: onboarding.birthMinute,
          birthPeriod: onboarding.birthPeriod,
          knowsBirthTime: onboarding.knowsBirthTime,
          birthPlace,
        },
        onboardingData,
        source: "birthplace_page",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Unable to save birthplace");
    }
  };

  const handleContinue = async () => {
    if (saving || !birthPlace.trim()) return;

    triggerLight();
    setSaving(true);

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    trackFunnelAction("birthplace_submitted", {
      route: "/onboarding/birthplace",
      step_id: "birthplace",
      has_birthplace: true,
      user_id: userId,
      next_route: "/onboarding/step-5",
    });

    try {
      await persistBirthplaceSnapshot(userId);
      trackFunnelAction("birthplace_snapshot_saved", {
        route: "/onboarding/birthplace",
        step_id: "birthplace",
        user_id: userId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "snapshot_failed";
      console.error("[birthplace] snapshot failed:", message);
      trackFunnelAction("birthplace_snapshot_failed", {
        route: "/onboarding/birthplace",
        step_id: "birthplace",
        user_id: userId,
        error: message,
      });
    } finally {
      setSaving(false);
      router.push("/onboarding/step-5");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white"
    >
      <OnboardingHeader showBack currentStep={4} totalSteps={14} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full w-[32%] rounded-full bg-[#38bdf8]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-6 pt-8">
        <h1 className="mb-2 text-center text-xl font-bold md:text-2xl">Where were you born?</h1>

        <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-[#b8c7da]">
          The place is important to explore your core personality traits, needs, and desires
        </p>

        <div className="w-full max-w-md">
          <LocationInput
            placeholder="Your birthplace"
            value={birthPlace}
            onChange={setBirthPlace}
            className="h-14 rounded-xl border-[#38bdf8]/35 bg-[#0b2035] px-4 text-base text-white placeholder:text-[#b8c7da]/55 focus-visible:border-[#38bdf8] focus-visible:ring-[#38bdf8]/20"
          />
        </div>
      </div>

      <div className="px-6 pb-6">
        <Button
          onClick={handleContinue}
          className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da] disabled:shadow-none"
          size="lg"
          disabled={saving || !birthPlace.trim()}
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </motion.div>
  );
}
