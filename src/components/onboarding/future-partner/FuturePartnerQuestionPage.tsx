"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { trackFunnelAction } from "@/lib/analytics-events";
import { generateUserId } from "@/lib/user-profile";
import type { FuturePartnerQuestionScreen } from "./futurePartnerFlow";

interface FuturePartnerQuestionPageProps {
  screen: FuturePartnerQuestionScreen;
}

async function persistFuturePartnerAnswer(screen: FuturePartnerQuestionScreen, answer: string) {
  const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
  localStorage.setItem("astrorekha_user_id", userId);

  await fetch("/api/future-partner/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      answers: {
        [screen.id]: answer,
      },
      currentRoute: `/onboarding/future-partner/${screen.id.replace("future-partner-", "")}`,
      currentStep: screen.id,
    }),
  });
}

export function FuturePartnerQuestionPage({ screen }: FuturePartnerQuestionPageProps) {
  const router = useRouter();

  const handleSelect = async (answer: string) => {
    localStorage.setItem(`palmcosmic_${screen.id}`, answer);
    localStorage.setItem(`astrorekha_${screen.id}`, answer);

    trackFunnelAction("future_partner_answer_selected", {
      funnel: "future_partner",
      route: `/onboarding/future-partner/${screen.id.replace("future-partner-", "")}`,
      step_id: screen.id,
      answer,
      next_route: screen.nextRoute,
      progress: screen.progress,
    });

    persistFuturePartnerAnswer(screen, answer).catch(() => {
      trackFunnelAction("future_partner_answer_save_failed", {
        funnel: "future_partner",
        step_id: screen.id,
      });
    });

    router.push(screen.nextRoute);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col"
    >
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full bg-[#38bdf8] rounded-full" style={{ width: `${screen.progress}%` }} />
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-10">
        <motion.h1
          variants={staggerItem}
          className="mx-auto max-w-[25rem] text-center text-2xl md:text-3xl leading-tight font-semibold tracking-tight"
        >
          {screen.title}
        </motion.h1>

        <motion.div variants={staggerItem} className="mt-10 space-y-4">
          {screen.options.map((option) => (
            <button
              key={option}
              onClick={() => handleSelect(option)}
              className={cn(
                "w-full rounded-2xl border px-5 py-5 text-left transition-all duration-200",
                "border-[#38bdf8]/45 bg-[#0a1d31] text-white shadow-[0_14px_30px_rgba(2,132,199,0.08)]",
                "hover:border-[#38bdf8] hover:bg-[#102942] active:scale-[0.99]"
              )}
            >
              <span className="block text-lg font-semibold tracking-tight">{option}</span>
            </button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
