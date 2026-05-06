"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { fadeUp } from "@/lib/motion";
import { useHaptic } from "@/hooks/useHaptic";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import { SOULMATE_SKETCH_ONBOARDING_QUESTIONS, type SoulmateSketchQuestionId } from "@/lib/soulmate-sketch-onboarding";

const ANSWERS_STORAGE_KEY = "astrorekha_soulmate_answers";

function normalizeAnswerValues(rawValue: unknown): string[] {
  if (rawValue === null || rawValue === undefined) return [];
  if (Array.isArray(rawValue)) {
    return rawValue.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof rawValue === "string") {
    const trimmed = rawValue.trim();
    if (!trimmed) return [];
    return trimmed
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  const asText = String(rawValue).trim();
  return asText ? [asText] : [];
}

function getAnswerLabel(id: SoulmateSketchQuestionId, rawValue: unknown) {
  const question = SOULMATE_SKETCH_ONBOARDING_QUESTIONS.find((item) => item.id === id);
  if (!question) return "";

  const values = normalizeAnswerValues(rawValue);
  const labels = values.map((value) => {
    const option = question.options.find((item) => item.value === value);
    return option?.label || value.replaceAll("_", " ");
  });
  return labels.join(", ");
}

export default function Step12Page() {
  const router = useRouter();
  const { triggerLight } = useHaptic();
  const [phase, setPhase] = useState(0);
  const [soulmateAnswers, setSoulmateAnswers] = useState<Record<string, unknown>>({});

  const {
    gender,
    birthMonth,
    birthDay,
    birthYear,
    birthPlace,
    elementPreference,
    sunSign: storeSunSign,
    moonSign: storeMoonSign,
    ascendantSign: storeAscendant,
    modality: storeModality,
    polarity: storePolarity,
    calculateLocalSigns,
    fetchAccurateSigns,
    signsFromApi,
  } = useOnboardingStore();

  const sunSign = storeSunSign || { name: "...", symbol: "✦", element: "", description: "" };
  const moonSign = storeMoonSign || { name: "...", symbol: "✦", element: "", description: "" };
  const ascendant = storeAscendant || { name: "...", symbol: "✦", element: "", description: "" };
  const modality = storeModality || "Cardinal";
  const polarity = storePolarity || "Feminine";

  useEffect(() => {
    pixelEvents.viewContent("Soulmate Chart Reveal", "onboarding_step");
    trackFunnelAction("soulmate_chart_reveal_viewed", {
      route: "/onboarding/step-12",
      step_id: "soulmate_chart_reveal",
    });

    if (!storeSunSign) {
      calculateLocalSigns();
    }
    if (!signsFromApi) {
      fetchAccurateSigns();
    }

    try {
      const saved = localStorage.getItem(ANSWERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          setSoulmateAnswers(parsed as Record<string, unknown>);
        }
      }
    } catch {
      // Ignore malformed local data.
    }

    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2500),
      setTimeout(() => setPhase(3), 5500),
      setTimeout(() => setPhase(4), 7500),
      setTimeout(() => setPhase(5), 9000),
    ];

    return () => timers.forEach(clearTimeout);
  }, [calculateLocalSigns, fetchAccurateSigns, signsFromApi, storeSunSign]);

  const persistSnapshot = async (userId: string) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const state = useOnboardingStore.getState();

    await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        currentRoute: "/onboarding/step-12",
        currentStep: "soulmate_chart_reveal",
        answers: {
          soulmateAnswers,
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
          soulmateAnswers,
        },
        source: "soulmate_chart_reveal_page",
      }),
    }).catch((error) => {
      console.error("[step-12] snapshot failed:", error);
    });
  };

  const handleContinue = () => {
    triggerLight();
    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);
    persistSnapshot(userId);
    trackFunnelAction("soulmate_chart_reveal_continue", {
      route: "/onboarding/step-12",
      step_id: "soulmate_chart_reveal",
      user_id: userId,
      next_route: "/onboarding/step-13",
    });
    router.push("/onboarding/step-13");
  };

  const formattedBirthDate = birthMonth ? `${birthMonth.slice(0, 3)} ${birthDay}, ${birthYear}` : "Not specified";
  const genderLabel = gender === "male" ? "Man" : gender === "female" ? "Woman" : "Person";
  const elementLabel = elementPreference ? elementPreference.charAt(0).toUpperCase() + elementPreference.slice(1) : "Water";
  const mainWorry = getAnswerLabel("main_worry", soulmateAnswers.main_worry) || "Not specified";
  const futureGoal = getAnswerLabel("future_goal", soulmateAnswers.future_goal) || "Not specified";

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white">
      <OnboardingHeader showBack currentStep={12} totalSteps={14} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full w-[92%] rounded-full bg-[#38bdf8]" />
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-y-auto px-6 pt-4">
        <AnimatePresence>
          {phase >= 4 ? (
            <motion.div
              initial={{ opacity: 0, y: -30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative mb-4 max-w-sm rounded-2xl border border-[#38bdf8]/18 bg-[#0b2338] px-6 py-4"
            >
              <p className="text-center text-sm text-[#d7e4f2]">
                Your chart shows a <span className="font-medium text-[#38bdf8]">rare spark</span> — let&apos;s uncover how you can use this power!
              </p>
              <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-[#38bdf8]/18 bg-[#0b2338]" />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {phase >= 4 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: 0.2, ease: "backOut" }}
              className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#38bdf8]/25 to-[#7dd3fc]/10"
            >
              <span className="text-xl">🔮</span>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-[#173653] bg-gradient-to-b from-[#0b2338] to-[#071a2b] p-6"
        >
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#38bdf8]/8 via-transparent to-[#7dd3fc]/5" />

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: phase >= 1 ? 1 : 0 }} className="relative z-10 mb-4 text-center">
            <h2 className="mb-1 text-xl font-bold">You</h2>
            <p className="text-sm text-[#b8c7da]">
              {genderLabel} • {sunSign.name} • {elementLabel}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.8 }}
            transition={{ delay: 0.3 }}
            className="relative z-10 mb-6 flex items-center justify-center gap-6"
          >
            <div className="text-center">
              <span className="text-2xl">{sunSign.symbol}</span>
              <p className="mt-1 text-sm font-medium">{modality}</p>
              <p className="text-xs text-[#b8c7da]">Modality</p>
            </div>

            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-white/18 bg-gradient-to-br from-[#0f2d47] to-[#061525]">
              <span className="text-4xl">{sunSign.symbol}</span>
            </div>

            <div className="text-center">
              <span className="text-2xl">{polarity === "Masculine" ? "♂" : "♀"}</span>
              <p className="mt-1 text-sm font-medium">{polarity}</p>
              <p className="text-xs text-[#b8c7da]">Polarity</p>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {phase >= 2 && phase < 3 ? (
              <motion.div
                key="details"
                initial={{ opacity: 0, height: 0, y: 20 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -10 }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                className="relative z-10 mb-4 overflow-hidden rounded-xl bg-[#15314d]/55 p-4"
              >
                <h3 className="mb-3 text-center text-sm font-semibold">Your Details</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-[#b8c7da]">Birth</span>
                    <span>{formattedBirthDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#b8c7da]">Place</span>
                    <span className="max-w-[180px] truncate text-right">{birthPlace || "Not specified"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#b8c7da]">Relationship Worries</span>
                    <span className="max-w-[180px] text-right">{mainWorry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#b8c7da]">Future</span>
                    <span className="max-w-[180px] text-right">{futureGoal}</span>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {phase >= 3 ? (
              <motion.div
                key="signs"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative z-10 flex justify-center gap-8 py-4"
              >
                {[
                  { sign: moonSign, label: "Moon Sign" },
                  { sign: sunSign, label: "Sun Sign" },
                  { sign: ascendant, label: "Ascendant" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + index * 0.15, duration: 0.4 }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-xl">{item.sign.symbol}</span>
                    <span className="text-xs font-medium">{item.sign.name}</span>
                    <span className="text-xs text-[#b8c7da]">{item.label}</span>
                  </motion.div>
                ))}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {phase >= 5 ? (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="px-6 pb-6">
            <Button
              onClick={handleContinue}
              className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7]"
              size="lg"
            >
              Continue
            </Button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}
