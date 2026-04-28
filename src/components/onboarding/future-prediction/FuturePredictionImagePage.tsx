"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { trackFunnelAction } from "@/lib/analytics-events";
import type { FuturePredictionImageScreen } from "./futurePredictionFlow";

interface FuturePredictionImagePageProps {
  screen: FuturePredictionImageScreen;
}

export function FuturePredictionImagePage({ screen }: FuturePredictionImagePageProps) {
  const router = useRouter();

  const handleContinue = () => {
    trackFunnelAction("future_prediction_continue_clicked", {
      funnel: "future_prediction",
      step_id: screen.id,
      step_name: screen.title,
      next_route: screen.nextRoute,
      progress: screen.progress,
    });
    router.push(screen.nextRoute);
  };

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="flex-1 min-h-[100svh] max-h-[100svh] overflow-hidden bg-[#061525] text-white flex flex-col"
    >
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-3">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#38bdf8] rounded-full"
            style={{ width: `${screen.progress}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col items-center px-6 pt-5 text-center">
        <motion.h1
          variants={staggerItem}
          className="max-w-[24rem] text-2xl md:text-3xl leading-tight font-semibold tracking-tight"
        >
          {screen.title}
        </motion.h1>

        {screen.body ? (
          <motion.p
            variants={staggerItem}
            className="mt-4 max-w-[23rem] text-sm md:text-base leading-relaxed text-[#b8c7da]"
          >
            {screen.body}
          </motion.p>
        ) : null}

        <motion.div
          variants={staggerItem}
          className="flex-1 min-h-0 w-full flex items-center justify-center py-4"
        >
          <div className="relative w-full max-w-[20rem] h-[39svh] min-h-[15rem] max-h-[23rem]">
            <div className="absolute inset-[-16%] rounded-full bg-[#38bdf8]/10 blur-3xl" />
            <Image
              src={screen.imageSrc || "/future-prediction-cosmic-path.png"}
              alt={screen.imageAlt}
              fill
              sizes="(max-width: 768px) 82vw, 320px"
              className={`object-cover ${screen.imagePosition || "object-center"} opacity-80 mix-blend-luminosity contrast-110 brightness-[0.82] saturate-[0.9]`}
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 34%, rgba(0,0,0,0.82) 53%, rgba(0,0,0,0.28) 68%, transparent 80%)",
                maskImage:
                  "radial-gradient(ellipse at center, black 34%, rgba(0,0,0,0.82) 53%, rgba(0,0,0,0.28) 68%, transparent 80%)",
              }}
              priority
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#061525]/25 via-transparent to-[#061525]/75 pointer-events-none"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 38%, rgba(0,0,0,0.74) 60%, transparent 82%)",
                maskImage:
                  "radial-gradient(ellipse at center, black 38%, rgba(0,0,0,0.74) 60%, transparent 82%)",
              }}
            />
          </div>
        </motion.div>
      </div>

      <div className="mt-auto px-6 pb-5">
        <Button
          onClick={handleContinue}
          className="w-full h-[52px] rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7]"
        >
          Continue
        </Button>
      </div>
    </motion.div>
  );
}
