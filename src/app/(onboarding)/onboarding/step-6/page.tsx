"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { fadeUp } from "@/lib/motion";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { Button } from "@/components/ui/button";
import { ForecastSphere } from "@/components/onboarding/ForecastSphere";
import { useRouter } from "next/navigation";
import { useHaptic } from "@/hooks/useHaptic";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import { useOnboardingStore } from "@/lib/onboarding-store";

export default function Step6Page() {
  const router = useRouter();
  const { triggerLight } = useHaptic();
  const [showButton, setShowButton] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    pixelEvents.viewContent("Forecast Accuracy Step", "onboarding_step");
    trackFunnelAction("forecast_accuracy_viewed", {
      route: "/onboarding/step-6",
      step_id: "forecast_accuracy",
      target_percentage: 34,
      button_delay_ms: 3500,
    });

    const timer = setTimeout(() => {
      setShowButton(true);
      trackFunnelAction("forecast_accuracy_continue_revealed", {
        route: "/onboarding/step-6",
        step_id: "forecast_accuracy",
      });
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const persistStepSnapshot = async (userId: string) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const state = useOnboardingStore.getState();
    const onboardingData = {
      gender: state.gender,
      birthMonth: state.birthMonth,
      birthDay: state.birthDay,
      birthYear: state.birthYear,
      birthHour: state.birthHour,
      birthMinute: state.birthMinute,
      birthPeriod: state.birthPeriod,
      birthPlace: state.birthPlace,
      knowsBirthTime: state.knowsBirthTime,
      relationshipStatus: state.relationshipStatus,
      goals: state.goals,
      colorPreference: state.colorPreference,
      elementPreference: state.elementPreference,
      sunSign: state.sunSign?.name || null,
      moonSign: state.moonSign?.name || null,
      ascendantSign: state.ascendantSign?.name || null,
      modality: state.modality,
      polarity: state.polarity,
    };

    const response = await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        currentRoute: "/onboarding/step-6",
        currentStep: "forecast_accuracy",
        answers: {
          gender: state.gender,
          birthMonth: state.birthMonth,
          birthDay: state.birthDay,
          birthYear: state.birthYear,
          birthHour: state.birthHour,
          birthMinute: state.birthMinute,
          birthPeriod: state.birthPeriod,
          birthPlace: state.birthPlace,
          knowsBirthTime: state.knowsBirthTime,
          forecastAccuracy: 34,
        },
        onboardingData,
        source: "forecast_accuracy_page",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Unable to save forecast step");
    }
  };

  const handleContinue = async () => {
    if (saving) return;

    triggerLight();
    setSaving(true);

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    trackFunnelAction("forecast_accuracy_continue_clicked", {
      route: "/onboarding/step-6",
      step_id: "forecast_accuracy",
      user_id: userId,
      next_route: "/onboarding/step-7",
    });

    try {
      await persistStepSnapshot(userId);
      trackFunnelAction("forecast_accuracy_snapshot_saved", {
        route: "/onboarding/step-6",
        step_id: "forecast_accuracy",
        user_id: userId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "snapshot_failed";
      console.error("[step-6] snapshot failed:", message);
      trackFunnelAction("forecast_accuracy_snapshot_failed", {
        route: "/onboarding/step-6",
        step_id: "forecast_accuracy",
        user_id: userId,
        error: message,
      });
    } finally {
      setSaving(false);
      router.push("/onboarding/step-7");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white"
    >
      <OnboardingHeader showBack currentStep={6} totalSteps={14} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full w-[48%] rounded-full bg-[#38bdf8]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-6 pt-8">
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center text-xl font-bold md:text-2xl"
        >
          Forecast accuracy
        </motion.h1>

        <div className="mb-8">
          <ForecastSphere targetPercentage={34} duration={3} size={180} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          className="relative max-w-sm rounded-2xl border border-[#38bdf8]/18 bg-[#0b2338] px-6 py-4"
        >
          <p className="text-center text-sm text-[#d7e4f2]">
            The cosmic energy is building up! Share a bit more to reveal what&apos;s driving you
          </p>
          <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-[#38bdf8]/18 bg-[#0b2338]" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2.5 }}
          className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#38bdf8]/25 to-[#7dd3fc]/10"
        >
          <span className="text-xl">🔮</span>
        </motion.div>
      </div>

      {showButton && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-6 pb-6">
          <Button
            onClick={handleContinue}
            disabled={saving}
            className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da] disabled:shadow-none"
            size="lg"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
