"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { useOnboardingStore, type Gender } from "@/lib/onboarding-store";
import { cn } from "@/lib/utils";
import { useHaptic } from "@/hooks/useHaptic";
import { trackFunnelAction } from "@/lib/analytics-events";

const genderOptions: { value: Exclude<Gender, null>; label: string; symbol: string }[] = [
  { value: "female", label: "Female", symbol: "♀" },
  { value: "male", label: "Male", symbol: "♂" },
  { value: "non-binary", label: "Non-binary", symbol: "⚥" },
];

export default function GenderPage() {
  const router = useRouter();
  const { gender, setGender } = useOnboardingStore();
  const { triggerLight } = useHaptic();

  const handleContinue = () => {
    if (!gender) return;
    triggerLight();
    trackFunnelAction("continue_clicked", {
      route: "/onboarding/gender",
      step_id: "gender",
      selected_gender: gender,
      next_route: "/onboarding/birthday",
    });
    router.push("/onboarding/birthday");
  };

  return (
    <div className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[64%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="px-6 pt-3 flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full"
        >
          <h1 className="text-2xl md:text-[28px] leading-tight font-semibold tracking-tight mb-4 max-w-[21rem] mx-auto">
            Please Select Your Gender:
          </h1>
          <p className="text-base leading-relaxed text-[#b8c7da] max-w-[21rem] mx-auto mb-8">
            This helps our astrologers personalize your chart interpretation with more care.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 }}
          className="grid w-full max-w-[28rem] grid-cols-3 gap-3"
        >
          {genderOptions.map((option) => {
            const isSelected = gender === option.value;

            return (
              <button
                key={option.value}
                onClick={() => {
                  triggerLight();
                  setGender(option.value);
                  trackFunnelAction("answer_selected", {
                    route: "/onboarding/gender",
                    step_id: "gender",
                    answer: option.value,
                  });
                }}
                className={cn(
                  "flex min-h-[9.25rem] flex-col items-center justify-center rounded-[1.35rem] border px-2 transition-all duration-200",
                  "bg-[#0a1625] hover:bg-[#0d2238]",
                  isSelected
                    ? "border-[#38bdf8] shadow-[0_0_0_1px_rgba(56,189,248,0.38),0_18px_44px_rgba(56,189,248,0.16)]"
                    : "border-[#2d3b4f] text-white"
                )}
              >
                <span
                  className={cn(
                    "mb-5 flex h-16 w-16 items-center justify-center rounded-full text-4xl font-semibold",
                    isSelected ? "bg-[#38bdf8]/20 text-[#38bdf8]" : "bg-[#151b31] text-[#38bdf8]"
                  )}
                >
                  {option.symbol}
                </span>
                <span className="text-center text-base font-semibold leading-tight text-white">
                  {option.label}
                </span>
              </button>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-auto px-6 pb-6">
        <Button
          onClick={handleContinue}
          disabled={!gender}
          className="w-full h-14 rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da] disabled:shadow-none"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
