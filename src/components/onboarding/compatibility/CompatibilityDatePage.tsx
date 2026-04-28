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

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const days = Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0"));
const years = Array.from({ length: 86 }, (_, index) => String(new Date().getFullYear() - 18 - index));

async function saveAnswers(answers: Record<string, string>, currentStep: string) {
  const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
  localStorage.setItem("astrorekha_user_id", userId);

  await fetch("/api/compatibility/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      answers,
      currentRoute: "/onboarding/compatibility/partner-birthday",
      currentStep,
    }),
  });
}

export function CompatibilityDatePage() {
  const router = useRouter();
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const canContinue = useMemo(() => Boolean(day && month && year), [day, month, year]);

  const persistAndGo = (answers: Record<string, string>, nextRoute = "/onboarding/compatibility/partner-birthplace") => {
    Object.entries(answers).forEach(([key, value]) => {
      localStorage.setItem(`palmcosmic_${key}`, value);
      localStorage.setItem(`astrorekha_${key}`, value);
    });

    trackFunnelAction("compatibility_answer_selected", {
      funnel: "compatibility",
      route: "/onboarding/compatibility/partner-birthday",
      step_id: "compatibility-partner-birthday",
      answer: answers["compatibility-partner-birth-date-known"] || "known",
      next_route: nextRoute,
      progress: 91,
    });

    saveAnswers(answers, "compatibility-partner-birthday").catch(() => {
      trackFunnelAction("compatibility_answer_save_failed", {
        funnel: "compatibility",
        step_id: "compatibility-partner-birthday",
      });
    });

    router.push(nextRoute);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    persistAndGo({
      "compatibility-partner-birth-date-known": "yes",
      "compatibility-partner-birth-day": day,
      "compatibility-partner-birth-month": month,
      "compatibility-partner-birth-year": year,
    });
  };

  const handleUnknown = () => {
    persistAndGo({ "compatibility-partner-birth-date-known": "no" });
  };

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="flex-1 min-h-[100svh] bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[91%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-6 pt-8 pb-6">
        <motion.div variants={staggerItem} className="text-center">
          <h1 className="mx-auto max-w-[25rem] text-2xl md:text-3xl leading-tight font-semibold tracking-tight">Enter your partner's birth date</h1>
          <p className="mx-auto mt-5 max-w-[22rem] text-sm md:text-base leading-relaxed text-[#b8c7da]">
            If you do not know it yet, we can still prepare a meaningful compatibility reading and you can update it later.
          </p>
        </motion.div>

        <motion.div variants={staggerItem} className="mt-8 grid grid-cols-[1fr_1.35fr_1fr] gap-3">
          <SelectField label="Day" value={day} onChange={setDay} placeholder="DD" options={days} />
          <SelectField label="Month" value={month} onChange={setMonth} placeholder="Month" options={months} />
          <SelectField label="Year" value={year} onChange={setYear} placeholder="YYYY" options={years} />
        </motion.div>

        <div className="mt-auto space-y-5">
          <Button
            onClick={handleContinue}
            disabled={!canContinue}
            className={cn(
              "w-full h-[56px] rounded-xl text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)]",
              "bg-[#38bdf8] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#7f91a8] disabled:shadow-none"
            )}
          >
            Continue
          </Button>
          <button onClick={handleUnknown} className="mx-auto flex items-center gap-2 text-sm font-semibold text-white/90 transition hover:text-[#38bdf8]">
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
