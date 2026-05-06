"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ForecastSphere } from "@/components/onboarding/ForecastSphere";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { fadeUp } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import { useOnboardingStore } from "@/lib/onboarding-store";

export default function Step15Page() {
  const router = useRouter();
  const { triggerLight } = useHaptic();

  const persistSnapshot = async (userId: string) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const state = useOnboardingStore.getState();

    await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        currentRoute: "/onboarding/step-15",
        currentStep: "forecast_accuracy_complete",
        answers: {
          forecastAccuracy: 100,
          palmImageSaved: localStorage.getItem("palmcosmic_palm_image_saved") === "true",
        },
        onboardingData: {
          gender: state.gender,
          birthMonth: state.birthMonth,
          birthDay: state.birthDay,
          birthYear: state.birthYear,
          birthHour: state.birthHour,
          birthMinute: state.birthMinute,
          birthPeriod: state.birthPeriod,
          birthPlace: state.birthPlace,
          knowsBirthTime: state.knowsBirthTime,
          sunSign: state.sunSign?.name || null,
          moonSign: state.moonSign?.name || null,
          ascendantSign: state.ascendantSign?.name || null,
          modality: state.modality,
          polarity: state.polarity,
        },
        source: "forecast_accuracy_complete_page",
      }),
    }).catch((error) => {
      console.error("[step-15] snapshot failed:", error);
    });
  };

  const handleContinue = () => {
    triggerLight();
    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);
    pixelEvents.viewContent("Forecast Accuracy Complete", "onboarding_step");
    persistSnapshot(userId);
    trackFunnelAction("forecast_accuracy_complete_continue", {
      route: "/onboarding/step-15",
      step_id: "forecast_accuracy_complete",
      user_id: userId,
      next_route: "/onboarding/email",
    });
    router.push("/onboarding/email");
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white">
      <OnboardingHeader showBack currentStep={15} totalSteps={15} onBack={() => router.push("/onboarding/step-14")} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full w-full rounded-full bg-[#38bdf8]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 pt-8">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center text-xl font-bold md:text-2xl">
          Forecast accuracy
        </motion.h1>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <ForecastSphere targetPercentage={100} startPercentage={68} duration={2.5} size={180} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="relative mb-2 max-w-sm rounded-2xl border border-[#38bdf8]/18 bg-[#0b2338] px-6 py-4"
        >
          <p className="text-center text-sm text-[#d7e4f2]">
            Maximum accuracy reached! Let&apos;s reveal your powerful prediction!
          </p>
          <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-[#38bdf8]/18 bg-[#0b2338]" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.8 }}
          className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#38bdf8]/25 to-[#7dd3fc]/10 text-lg"
        >
          🔮
        </motion.div>
      </div>

      <div className="px-6 pb-6">
        <Button onClick={handleContinue} className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7]" size="lg">
          Get the Results!
        </Button>
      </div>
    </motion.div>
  );
}
