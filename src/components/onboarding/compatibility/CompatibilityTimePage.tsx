"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { trackFunnelAction } from "@/lib/analytics-events";
import { generateUserId } from "@/lib/user-profile";
import { cn } from "@/lib/utils";

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

async function saveAnswers(answers: Record<string, string>) {
  const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
  localStorage.setItem("astrorekha_user_id", userId);

  await fetch("/api/compatibility/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      answers,
      currentRoute: "/onboarding/compatibility/partner-birth-time",
      currentStep: "compatibility-partner-birth-time",
    }),
  });
}

export function CompatibilityTimePage() {
  const router = useRouter();
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const canContinue = useMemo(() => Boolean(hour && minute), [hour, minute]);

  const persistAndGo = (answers: Record<string, string>) => {
    Object.entries(answers).forEach(([key, value]) => {
      localStorage.setItem(`palmcosmic_${key}`, value);
      localStorage.setItem(`astrorekha_${key}`, value);
    });

    trackFunnelAction("compatibility_answer_selected", {
      funnel: "compatibility",
      route: "/onboarding/compatibility/partner-birth-time",
      step_id: "compatibility-partner-birth-time",
      answer: answers["compatibility-partner-birth-time-known"] || "known",
      next_route: "/onboarding/compatibility/ready",
      progress: 97,
    });

    saveAnswers(answers).catch(() => {
      trackFunnelAction("compatibility_answer_save_failed", {
        funnel: "compatibility",
        step_id: "compatibility-partner-birth-time",
      });
    });

    router.push("/onboarding/compatibility/ready");
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex-1 min-h-[100svh] bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[97%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8 pb-6">
        <motion.div variants={staggerItem} className="text-center">
          <h1 className="mx-auto max-w-[25rem] text-2xl md:text-3xl leading-tight font-semibold tracking-tight">Do you know your partner's birth time?</h1>
          <p className="mx-auto mt-5 max-w-[22rem] text-sm md:text-base leading-relaxed text-[#b8c7da]">
            Exact time helps refine emotional and timing layers. If you do not know it, we will still map the core compatibility.
          </p>
        </motion.div>

        <motion.div variants={staggerItem} className="mt-8 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <SelectField label="Hour" value={hour} onChange={setHour} placeholder="HH" options={hours} />
          <span className="pb-4 text-xl font-semibold text-white">:</span>
          <SelectField label="Minute" value={minute} onChange={setMinute} placeholder="MM" options={minutes} />
        </motion.div>

        <div className="mt-auto space-y-5">
          <Button
            onClick={() => persistAndGo({ "compatibility-partner-birth-time-known": "yes", "compatibility-partner-birth-hour": hour, "compatibility-partner-birth-minute": minute })}
            disabled={!canContinue}
            className={cn(
              "w-full h-[56px] rounded-xl text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)]",
              "bg-[#38bdf8] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#7f91a8] disabled:shadow-none"
            )}
          >
            Continue
          </Button>
          <button onClick={() => persistAndGo({ "compatibility-partner-birth-time-known": "no" })} className="mx-auto flex items-center gap-2 text-sm font-semibold text-white/90 transition hover:text-[#38bdf8]">
            I don't know <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function SelectField({ label, value, onChange, placeholder, options }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-[#b8c7da]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-14 w-full rounded-xl border border-[#38bdf8]/35 bg-[#0a1d31] px-3 text-base font-semibold text-white outline-none focus:border-[#38bdf8] focus:ring-4 focus:ring-[#38bdf8]/15"
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}
