"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { WheelPicker } from "@/components/onboarding/WheelPicker";
import { Button } from "@/components/ui/button";
import { useHaptic } from "@/hooks/useHaptic";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";

const hours = Array.from({ length: 12 }, (_, index) => String(index + 1));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const periods: Array<"AM" | "PM"> = ["AM", "PM"];

export default function BirthTimePage() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const { birthHour, birthMinute, birthPeriod, setBirthTime, setKnowsBirthTime } = onboarding;
  const { triggerLight } = useHaptic();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    pixelEvents.viewContent("Birth Time Step", "onboarding_step");
  }, []);

  const persistBirthTimeSnapshot = async (userId: string, knowsBirthTime: boolean) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const onboardingData = {
      gender: onboarding.gender,
      birthMonth: onboarding.birthMonth,
      birthDay: onboarding.birthDay,
      birthYear: onboarding.birthYear,
      birthHour,
      birthMinute,
      birthPeriod,
      birthPlace: onboarding.birthPlace,
      knowsBirthTime,
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
        currentRoute: "/onboarding/birth-time",
        currentStep: "birth_time",
        answers: {
          gender: onboarding.gender,
          birthMonth: onboarding.birthMonth,
          birthDay: onboarding.birthDay,
          birthYear: onboarding.birthYear,
          birthHour,
          birthMinute,
          birthPeriod,
          knowsBirthTime,
        },
        onboardingData,
        source: "birth_time_page",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Unable to save birth time");
    }
  };

  const continueToBirthplace = async (knowsBirthTime: boolean) => {
    if (saving) return;

    triggerLight();
    setSaving(true);
    setKnowsBirthTime(knowsBirthTime);

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    trackFunnelAction(knowsBirthTime ? "birthtime_submitted" : "birthtime_skipped", {
      route: "/onboarding/birth-time",
      step_id: "birth_time",
      knows_birth_time: knowsBirthTime,
      selected_hour: knowsBirthTime ? birthHour : undefined,
      selected_minute: knowsBirthTime ? birthMinute : undefined,
      selected_period: knowsBirthTime ? birthPeriod : undefined,
      user_id: userId,
      next_route: "/onboarding/birthplace",
    });

    try {
      await persistBirthTimeSnapshot(userId, knowsBirthTime);
      trackFunnelAction("birthtime_snapshot_saved", {
        route: "/onboarding/birth-time",
        step_id: "birth_time",
        knows_birth_time: knowsBirthTime,
        user_id: userId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "snapshot_failed";
      console.error("[birth-time] snapshot failed:", message);
      trackFunnelAction("birthtime_snapshot_failed", {
        route: "/onboarding/birth-time",
        step_id: "birth_time",
        knows_birth_time: knowsBirthTime,
        user_id: userId,
        error: message,
      });
    } finally {
      setSaving(false);
      router.push("/onboarding/birthplace");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white"
    >
      <OnboardingHeader showBack currentStep={3} totalSteps={14} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full w-[24%] rounded-full bg-[#38bdf8]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-6 pt-8">
        <h1 className="mb-2 text-center text-xl font-bold md:text-2xl">Do you know your birth time?</h1>

        <p className="mb-12 max-w-sm text-center text-sm leading-relaxed text-[#b8c7da]">
          This helps us find out where planets were placed in the sky at the moment of your birth
        </p>

        <div className="mb-auto flex w-full max-w-sm justify-center gap-2">
          <WheelPicker
            items={hours}
            value={birthHour}
            onChange={(hour) => setBirthTime(hour, birthMinute, birthPeriod)}
            className="w-20"
            infinite
          />
          <WheelPicker
            items={minutes}
            value={birthMinute}
            onChange={(minute) => setBirthTime(birthHour, minute, birthPeriod)}
            className="w-20"
            infinite
          />
          <WheelPicker
            items={periods}
            value={birthPeriod}
            onChange={(period) => setBirthTime(birthHour, birthMinute, period as "AM" | "PM")}
            className="w-20"
          />
        </div>
      </div>

      <div className="space-y-3 px-6 pb-6">
        <button
          onClick={() => continueToBirthplace(false)}
          disabled={saving}
          className="w-full text-sm font-medium text-[#38bdf8] transition-colors hover:text-[#7dd3fc] disabled:text-[#8fa3b8]"
        >
          I don&apos;t remember
        </button>

        <Button
          onClick={() => continueToBirthplace(true)}
          disabled={saving}
          className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da] disabled:shadow-none"
          size="lg"
        >
          {saving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </motion.div>
  );
}
