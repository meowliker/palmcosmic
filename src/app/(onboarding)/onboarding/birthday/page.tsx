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

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const days = Array.from({ length: 31 }, (_, index) => String(index + 1));
const years = Array.from({ length: 100 }, (_, index) => String(2010 - index));

export default function BirthdayPage() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const { birthMonth, birthDay, birthYear, setBirthDate } = onboarding;
  const { triggerLight } = useHaptic();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    pixelEvents.viewContent("Birthday Step", "onboarding_step");
  }, []);

  const persistBirthdaySnapshot = async (userId: string) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const onboardingData = {
      gender: onboarding.gender,
      birthMonth,
      birthDay,
      birthYear,
      birthHour: onboarding.birthHour,
      birthMinute: onboarding.birthMinute,
      birthPeriod: onboarding.birthPeriod,
      birthPlace: onboarding.birthPlace,
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
        currentRoute: "/onboarding/birthday",
        currentStep: "birthday",
        answers: {
          gender: onboarding.gender,
          birthMonth,
          birthDay,
          birthYear,
        },
        onboardingData,
        source: "birthday_page",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Unable to save birthday");
    }
  };

  const handleContinue = async () => {
    if (saving) return;

    triggerLight();
    setSaving(true);

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    trackFunnelAction("birthdate_submitted", {
      route: "/onboarding/birthday",
      step_id: "birthday",
      birth_month: birthMonth,
      birth_year: birthYear,
      user_id: userId,
      next_route: "/onboarding/birth-time",
    });

    try {
      await persistBirthdaySnapshot(userId);
      trackFunnelAction("birthday_snapshot_saved", {
        route: "/onboarding/birthday",
        step_id: "birthday",
        user_id: userId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "snapshot_failed";
      console.error("[birthday] snapshot failed:", message);
      trackFunnelAction("birthday_snapshot_failed", {
        route: "/onboarding/birthday",
        step_id: "birthday",
        user_id: userId,
        error: message,
      });
    } finally {
      setSaving(false);
      router.push("/onboarding/birth-time");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white"
    >
      <OnboardingHeader showBack currentStep={2} totalSteps={14} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full w-[16%] rounded-full bg-[#38bdf8]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-6 pt-8">
        <h1 className="mb-2 text-center text-xl font-bold md:text-2xl">When&apos;s your birthday?</h1>

        <p className="mb-12 max-w-sm text-center text-sm leading-relaxed text-[#b8c7da]">
          It&apos;s also important to know your date of birth for making complete and accurate predictions
        </p>

        <div className="mb-auto flex w-full max-w-md justify-center gap-2">
          <WheelPicker
            items={months}
            value={birthMonth}
            onChange={(month) => setBirthDate(month, birthDay, birthYear)}
            className="flex-1"
            infinite
          />
          <WheelPicker
            items={days}
            value={birthDay}
            onChange={(day) => setBirthDate(birthMonth, day, birthYear)}
            className="w-20"
            infinite
          />
          <WheelPicker
            items={years}
            value={birthYear}
            onChange={(year) => setBirthDate(birthMonth, birthDay, year)}
            className="w-24"
          />
        </div>
      </div>

      <div className="px-6 pb-6">
        <Button
          onClick={handleContinue}
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
