"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { Button } from "@/components/ui/button";
import { useHaptic } from "@/hooks/useHaptic";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { trackFunnelAction } from "@/lib/analytics-events";

const monthOptions = [
  { value: "January", label: "January" },
  { value: "February", label: "February" },
  { value: "March", label: "March" },
  { value: "April", label: "April" },
  { value: "May", label: "May" },
  { value: "June", label: "June" },
  { value: "July", label: "July" },
  { value: "August", label: "August" },
  { value: "September", label: "September" },
  { value: "October", label: "October" },
  { value: "November", label: "November" },
  { value: "December", label: "December" },
];

const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, "0"));
const years = Array.from({ length: 100 }, (_, i) => String(2010 - i));

function DateSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block min-w-0 text-left">
      <span className="mb-2 block text-base font-medium text-[#b8c7da]">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-14 w-full appearance-none rounded-xl border border-[#38bdf8]/35 bg-[#0b2035] px-4 pr-10 text-xl font-semibold text-white outline-none transition-colors hover:bg-[#103554] focus:border-[#38bdf8]"
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
      </span>
    </label>
  );
}

export default function BirthdayPage() {
  const router = useRouter();
  const { setBirthDate } = useOnboardingStore();
  const { triggerLight } = useHaptic();
  const [selectedDay, setSelectedDay] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  const isComplete = Boolean(selectedDay && selectedMonth && selectedYear);

  const handleContinue = () => {
    if (!isComplete) return;
    triggerLight();
    setBirthDate(selectedMonth, String(Number(selectedDay)), selectedYear);
    trackFunnelAction("birthdate_submitted", {
      route: "/onboarding/birthday",
      step_id: "birthday",
      birth_month: selectedMonth,
      birth_year: selectedYear,
      next_route: "/onboarding/birth-time",
    });
    router.push("/onboarding/birth-time");
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={fadeUp}
      className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col"
    >
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[70%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-3 text-center">
        <h1 className="text-2xl md:text-[28px] leading-tight font-semibold tracking-tight mb-4 max-w-[21rem]">
          When were you born?
        </h1>

        <p className="text-base leading-relaxed text-[#b8c7da] max-w-[22rem] mb-10">
          Your birthdate helps our astrologers identify your sun sign and begin shaping your personal chart.
        </p>

        <div className="grid w-full max-w-[28rem] grid-cols-[0.95fr_1.25fr_1fr] gap-3">
          <DateSelect
            label="Day"
            placeholder="DD"
            value={selectedDay}
            options={days.map((day) => ({ value: day, label: day }))}
            onChange={setSelectedDay}
          />
          <DateSelect
            label="Month"
            placeholder="MM"
            value={selectedMonth}
            options={monthOptions}
            onChange={setSelectedMonth}
          />
          <DateSelect
            label="Year"
            placeholder="YYYY"
            value={selectedYear}
            options={years.map((year) => ({ value: year, label: year }))}
            onChange={setSelectedYear}
          />
        </div>
      </div>

      <div className="mt-auto px-6 pb-6">
        <Button
          onClick={handleContinue}
          disabled={!isComplete}
          className="w-full h-14 rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da] disabled:shadow-none"
        >
          Continue
        </Button>
      </div>
    </motion.div>
  );
}
