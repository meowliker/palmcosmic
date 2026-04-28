"use client";

import { motion } from "framer-motion";
import { fadeUp } from "@/lib/motion";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { Button } from "@/components/ui/button";
import { LocationInput } from "@/components/onboarding/LocationInput";
import { useHaptic } from "@/hooks/useHaptic";
import { ChevronRight } from "lucide-react";
import { trackFunnelAction } from "@/lib/analytics-events";

export default function BirthplacePage() {
  const router = useRouter();
  const { birthPlace, setBirthPlace } = useOnboardingStore();
  const { triggerLight } = useHaptic();

  const handleContinue = () => {
    triggerLight();
    trackFunnelAction("birthplace_submitted", {
      route: "/onboarding/birthplace",
      step_id: "birthplace",
      has_birthplace: true,
      next_route: "/onboarding/step-5",
    });
    router.push("/onboarding/step-5");
  };

  const handleAddLater = () => {
    triggerLight();
    setBirthPlace("");
    trackFunnelAction("birthplace_skipped", {
      route: "/onboarding/birthplace",
      step_id: "birthplace",
      has_birthplace: false,
      next_route: "/onboarding/step-5",
    });
    router.push("/onboarding/step-5");
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
          <div className="h-full w-[82%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-3 text-center">
        <h1 className="text-2xl md:text-[28px] leading-tight font-semibold tracking-tight mb-4 max-w-[21rem]">
          Where were you born?
        </h1>

        <p className="text-base leading-relaxed text-[#b8c7da] max-w-[22rem] mb-10">
          Your birthplace helps map the sky more precisely, including your rising sign and house placements.
        </p>

        <div className="w-full max-w-[28rem]">
          <LocationInput
            placeholder="Enter your birthplace"
            value={birthPlace}
            onChange={setBirthPlace}
            className="h-14 rounded-xl border-[#38bdf8]/35 bg-[#0b2035] px-4 text-base text-white placeholder:text-[#b8c7da]/55 focus-visible:border-[#38bdf8] focus-visible:ring-[#38bdf8]/20"
          />
        </div>
      </div>

      <div className="mt-auto px-6 pb-6 space-y-4">
        <Button
          onClick={handleContinue}
          className="w-full h-14 rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da] disabled:shadow-none"
          disabled={!birthPlace.trim()}
        >
          Continue
        </Button>

        <button
          type="button"
          onClick={handleAddLater}
          className="mx-auto flex items-center justify-center gap-2 text-base font-semibold text-[#b8c7da] transition-colors hover:text-[#7dd3fc]"
        >
          Add later
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </motion.div>
  );
}
