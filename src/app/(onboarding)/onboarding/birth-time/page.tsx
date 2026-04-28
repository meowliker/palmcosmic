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

const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function TimeSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: string[];
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
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white" />
      </span>
    </label>
  );
}

export default function BirthTimePage() {
  const router = useRouter();
  const { setBirthTime, setKnowsBirthTime } = useOnboardingStore();
  const { triggerLight } = useHaptic();
  const [selectedHour, setSelectedHour] = useState("");
  const [selectedMinute, setSelectedMinute] = useState("");

  const isComplete = Boolean(selectedHour && selectedMinute);

  const handleContinue = () => {
    if (!isComplete) return;
    triggerLight();
    setKnowsBirthTime(true);
    const hour24 = Number(selectedHour);
    const period = hour24 >= 12 ? "PM" : "AM";
    const hour12 = hour24 % 12 || 12;
    setBirthTime(String(hour12), selectedMinute, period);
    trackFunnelAction("birthtime_submitted", {
      route: "/onboarding/birth-time",
      step_id: "birth_time",
      knows_birth_time: true,
      selected_hour_24: selectedHour,
      next_route: "/onboarding/birthplace",
    });
    router.push("/onboarding/birthplace");
  };

  const handleDontRemember = () => {
    triggerLight();
    setKnowsBirthTime(false);
    trackFunnelAction("birthtime_skipped", {
      route: "/onboarding/birth-time",
      step_id: "birth_time",
      knows_birth_time: false,
      next_route: "/onboarding/birthplace",
    });
    router.push("/onboarding/birthplace");
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
          <div className="h-full w-[76%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-3 text-center">
        <h1 className="text-2xl md:text-[28px] leading-tight font-semibold tracking-tight mb-4 max-w-[21rem]">
          What time were you born?
        </h1>

        <p className="text-base leading-relaxed text-[#b8c7da] max-w-[22rem] mb-10">
          Your birth time helps astrologers refine your houses, rising sign, and the timing in your chart.
        </p>

        <div className="grid w-full max-w-[28rem] grid-cols-[1fr_auto_1fr] items-end gap-3">
          <TimeSelect
            label="Hour"
            placeholder="HH"
            value={selectedHour}
            options={hours}
            onChange={setSelectedHour}
          />
          <span className="pb-4 text-2xl font-semibold text-[#b8c7da]">:</span>
          <TimeSelect
            label="Minute"
            placeholder="MM"
            value={selectedMinute}
            options={minutes}
            onChange={setSelectedMinute}
          />
        </div>
      </div>

      <div className="mt-auto px-6 pb-6 space-y-4">
        <Button
          onClick={handleContinue}
          disabled={!isComplete}
          className="w-full h-14 rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da] disabled:shadow-none"
        >
          Continue
        </Button>

        <button
          onClick={handleDontRemember}
          className="w-full text-sm font-semibold text-[#b8c7da] transition-colors hover:text-[#7dd3fc]"
        >
          I don&apos;t remember
        </button>
      </div>
    </motion.div>
  );
}
