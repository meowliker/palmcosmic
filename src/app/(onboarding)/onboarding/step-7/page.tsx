"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { trackFunnelAction } from "@/lib/analytics-events";
import { getPriorityRoute, PRIORITY_OPTIONS } from "@/lib/onboarding-priority-routes";

export default function Step7Page() {
  const router = useRouter();

  const handleSelect = (priorityId: string, label: string) => {
    localStorage.setItem("palmcosmic_priority_area", priorityId);
    localStorage.setItem("astrorekha_priority_area", priorityId);

    const nextRoute = getPriorityRoute(priorityId);

    trackFunnelAction("priority_selected", {
      route: "/onboarding/step-7",
      step_id: "priority_area",
      priority_id: priorityId,
      answer: label,
      next_route: nextRoute,
    });

    router.push(nextRoute);
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
          <div className="h-full w-[84%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 px-6 pt-8 pb-10">
        <motion.h1
          variants={staggerItem}
          className="mx-auto max-w-[24rem] text-center text-2xl md:text-3xl leading-tight font-semibold tracking-tight"
        >
          What area of your life is your priority now?
        </motion.h1>

        <motion.div
          variants={staggerItem}
          className="mt-10 space-y-4"
        >
          {PRIORITY_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id, option.label)}
              className={cn(
                "w-full rounded-2xl border px-5 py-5 text-left transition-all duration-200",
                "border-[#38bdf8]/45 bg-[#0a1d31] text-white shadow-[0_14px_30px_rgba(2,132,199,0.08)]",
                "hover:border-[#38bdf8] hover:bg-[#102942] active:scale-[0.99]"
              )}
            >
              <span className="block text-lg font-semibold tracking-tight">
                {option.label}
              </span>
            </button>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}
