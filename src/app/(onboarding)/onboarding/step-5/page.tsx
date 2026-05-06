"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { fadeUp, staggerContainer, staggerItem } from "@/lib/motion";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { Button } from "@/components/ui/button";
import { ZodiacWheel } from "@/components/onboarding/ZodiacWheel";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useRouter } from "next/navigation";
import { useHaptic } from "@/hooks/useHaptic";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";

const insightTags = [
  { icon: "✨", label: "Your challenges" },
  { icon: "🌍", label: "Your approach to life" },
  { icon: "🦋", label: "Your transformations" },
  { icon: "🌙", label: "Your intuition and dreams" },
];

interface SignData {
  name: string;
  symbol: string;
  element: string;
  description: string;
}

const fallbackSign: SignData = { name: "...", symbol: "✦", element: "", description: "" };

export default function Step5Page() {
  const router = useRouter();
  const { triggerLight } = useHaptic();
  const onboarding = useOnboardingStore();
  const {
    birthMonth,
    birthYear,
    birthPlace,
    sunSign: storeSunSign,
    moonSign: storeMoonSign,
    ascendantSign: storeAscendant,
    calculateLocalSigns,
    fetchAccurateSigns,
    signsFromApi,
  } = onboarding;

  const [phase, setPhase] = useState<"loading" | "results">("loading");
  const [visibleTags, setVisibleTags] = useState(0);
  const [saving, setSaving] = useState(false);
  const [sunSign, setSunSign] = useState<SignData>(storeSunSign || fallbackSign);
  const [moonSign, setMoonSign] = useState<SignData>(storeMoonSign || fallbackSign);
  const [ascendant, setAscendant] = useState<SignData>(storeAscendant || fallbackSign);

  useEffect(() => {
    pixelEvents.viewContent("Birth Chart Mapping Step", "onboarding_step");
    trackFunnelAction("chart_mapping_started", {
      route: "/onboarding/step-5",
      step_id: "loading_analysis",
      birth_month: birthMonth,
      birth_year: birthYear,
      has_birthplace: Boolean(birthPlace),
      has_birth_time: onboarding.knowsBirthTime,
    });

    calculateLocalSigns();
    trackFunnelAction("chart_local_signs_calculated", {
      route: "/onboarding/step-5",
      step_id: "loading_analysis",
    });

    if (!signsFromApi) {
      trackFunnelAction("chart_accurate_signs_fetch_started", {
        route: "/onboarding/step-5",
        step_id: "loading_analysis",
      });

      fetchAccurateSigns()
        .then(() => {
          trackFunnelAction("chart_accurate_signs_fetch_completed", {
            route: "/onboarding/step-5",
            step_id: "loading_analysis",
          });
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "accurate_signs_fetch_failed";
          trackFunnelAction("chart_accurate_signs_fetch_failed", {
            route: "/onboarding/step-5",
            step_id: "loading_analysis",
            error: message,
          });
        });
    }
  }, [
    birthMonth,
    birthPlace,
    birthYear,
    calculateLocalSigns,
    fetchAccurateSigns,
    onboarding.knowsBirthTime,
    signsFromApi,
  ]);

  useEffect(() => {
    if (storeSunSign) setSunSign(storeSunSign);
    if (storeMoonSign) setMoonSign(storeMoonSign);
    if (storeAscendant) setAscendant(storeAscendant);
  }, [storeSunSign, storeMoonSign, storeAscendant]);

  useEffect(() => {
    const tagInterval = setInterval(() => {
      setVisibleTags((previous) => {
        if (previous >= insightTags.length) {
          clearInterval(tagInterval);
          return previous;
        }
        return previous + 1;
      });
    }, 800);

    const phaseTimer = setTimeout(() => {
      setPhase("results");
      trackFunnelAction("chart_mapping_results_shown", {
        route: "/onboarding/step-5",
        step_id: "loading_analysis",
      });
    }, 3500);

    return () => {
      clearInterval(tagInterval);
      clearTimeout(phaseTimer);
    };
  }, []);

  const persistChartSnapshot = async (userId: string) => {
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
        currentRoute: "/onboarding/step-5",
        currentStep: "loading_analysis",
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
          sunSign: state.sunSign?.name || null,
          moonSign: state.moonSign?.name || null,
          ascendantSign: state.ascendantSign?.name || null,
        },
        onboardingData,
        source: "chart_mapping_page",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Unable to save chart mapping");
    }
  };

  const handleContinue = async () => {
    if (saving) return;

    triggerLight();
    setSaving(true);

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    trackFunnelAction("chart_mapping_continue_clicked", {
      route: "/onboarding/step-5",
      step_id: "loading_analysis",
      user_id: userId,
      sun_sign: sunSign.name,
      moon_sign: moonSign.name,
      ascendant_sign: ascendant.name,
      next_route: "/onboarding/step-6",
    });

    try {
      await persistChartSnapshot(userId);
      trackFunnelAction("chart_mapping_snapshot_saved", {
        route: "/onboarding/step-5",
        step_id: "loading_analysis",
        user_id: userId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "snapshot_failed";
      console.error("[step-5] snapshot failed:", message);
      trackFunnelAction("chart_mapping_snapshot_failed", {
        route: "/onboarding/step-5",
        step_id: "loading_analysis",
        user_id: userId,
        error: message,
      });
    } finally {
      setSaving(false);
      router.push("/onboarding/step-6");
    }
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white"
    >
      <OnboardingHeader showBack currentStep={5} totalSteps={14} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full w-[40%] rounded-full bg-[#38bdf8]" />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "loading" ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center px-6 pt-8"
          >
            <h1 className="mb-8 text-center text-xl font-bold md:text-2xl">Mapping your birth chart...</h1>

            <div className="relative mb-8">
              <ZodiacWheel isAnimating size={180} />
            </div>

            <div className="flex flex-col items-center gap-3">
              {insightTags.map((tag, index) => (
                <motion.div
                  key={tag.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{
                    opacity: index < visibleTags ? 1 : 0,
                    y: index < visibleTags ? 0 : 10,
                  }}
                  transition={{ duration: 0.4 }}
                  className="rounded-full border border-[#38bdf8]/20 bg-[#0b2338] px-4 py-2 text-sm text-white shadow-[0_12px_32px_rgba(56,189,248,0.08)]"
                >
                  <span className="mr-2">{tag.icon}</span>
                  {tag.label}
                </motion.div>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="flex flex-1 flex-col items-center px-6 pt-4"
          >
            <motion.div variants={staggerItem} className="relative mb-4 max-w-sm rounded-2xl border border-[#38bdf8]/18 bg-[#0b2338] px-6 py-4">
              <p className="text-center text-sm text-[#d7e4f2]">
                Your chart shows a <span className="font-medium text-[#38bdf8]">rare spark</span> - let&apos;s discover your best match
              </p>
              <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-[#38bdf8]/18 bg-[#0b2338]" />
            </motion.div>

            <motion.div variants={staggerItem} className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#38bdf8]/25 to-[#7dd3fc]/10">
              <span className="text-2xl">🔮</span>
            </motion.div>

            <motion.div variants={staggerItem} className="mb-6">
              <ZodiacWheel isAnimating={false} size={160} />
            </motion.div>

            <motion.div variants={staggerItem} className="mb-8 flex w-full max-w-sm justify-center gap-8">
              <div className="flex flex-col items-center">
                <span className="mb-1 text-2xl">{moonSign.symbol}</span>
                <span className="text-sm font-medium">{moonSign.name}</span>
                <span className="text-xs text-[#b8c7da]">Moon Sign</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="mb-1 text-2xl">{sunSign.symbol}</span>
                <span className="text-sm font-medium">{sunSign.name}</span>
                <span className="text-xs text-[#b8c7da]">Sun Sign</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="mb-1 text-2xl">{ascendant.symbol}</span>
                <span className="text-sm font-medium">{ascendant.name}</span>
                <span className="text-xs text-[#b8c7da]">Ascendant</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "results" && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="px-6 pb-6">
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
