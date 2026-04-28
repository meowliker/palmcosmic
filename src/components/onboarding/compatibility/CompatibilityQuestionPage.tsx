"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { trackFunnelAction } from "@/lib/analytics-events";
import { generateUserId } from "@/lib/user-profile";
import type { CompatibilityQuestionScreen } from "./compatibilityFlow";

interface CompatibilityQuestionPageProps {
  screen: CompatibilityQuestionScreen;
}

async function persistCompatibilityAnswer(screen: CompatibilityQuestionScreen, answer: string) {
  const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
  localStorage.setItem("astrorekha_user_id", userId);

  await fetch("/api/compatibility/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      answers: { [screen.id]: answer },
      currentRoute: `/onboarding/compatibility/${screen.id.replace("compatibility-", "")}`,
      currentStep: screen.id,
    }),
  });
}

export function CompatibilityQuestionPage({ screen }: CompatibilityQuestionPageProps) {
  const router = useRouter();

  const handleSelect = (answer: string) => {
    localStorage.setItem(`palmcosmic_${screen.id}`, answer);
    localStorage.setItem(`astrorekha_${screen.id}`, answer);

    trackFunnelAction("compatibility_answer_selected", {
      funnel: "compatibility",
      route: `/onboarding/compatibility/${screen.id.replace("compatibility-", "")}`,
      step_id: screen.id,
      answer,
      next_route: screen.nextRoute,
      progress: screen.progress,
    });

    persistCompatibilityAnswer(screen, answer).catch(() => {
      trackFunnelAction("compatibility_answer_save_failed", {
        funnel: "compatibility",
        step_id: screen.id,
      });
    });

    router.push(screen.nextRoute);
  };

  const isGenderCard = screen.id === "compatibility-partner-gender";

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full bg-[#38bdf8] rounded-full" style={{ width: `${screen.progress}%` }} />
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-10">
        <motion.h1 variants={staggerItem} className="mx-auto max-w-[25rem] text-center text-2xl md:text-3xl leading-tight font-semibold tracking-tight">
          {screen.title}
        </motion.h1>

        <motion.div variants={staggerItem} className={isGenderCard ? "mt-10 grid grid-cols-2 gap-4" : "mt-10 space-y-4"}>
          {screen.options.map((option) => {
            const genderSymbol = option.toLowerCase() === "female" ? "♀" : "♂";
            return (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                className={cn(
                  "border transition-all duration-200 active:scale-[0.99]",
                  "border-[#38bdf8]/45 bg-[#0a1d31] text-white shadow-[0_14px_30px_rgba(2,132,199,0.08)]",
                  "hover:border-[#38bdf8] hover:bg-[#102942]",
                  isGenderCard ? "rounded-3xl px-4 py-8 text-center" : "w-full rounded-2xl px-5 py-5 text-left"
                )}
              >
                {isGenderCard ? (
                  <span className="flex flex-col items-center gap-4">
                    <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#38bdf8]/12 text-[#38bdf8]">
                      <span className="text-5xl leading-none">{genderSymbol}</span>
                    </span>
                    <span className="text-lg font-semibold tracking-tight">{option}</span>
                  </span>
                ) : (
                  <span className="block text-lg font-semibold tracking-tight">{option}</span>
                )}
              </button>
            );
          })}
        </motion.div>
      </div>
    </motion.div>
  );
}
