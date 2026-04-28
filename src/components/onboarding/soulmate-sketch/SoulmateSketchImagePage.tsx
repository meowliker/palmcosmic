"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { trackFunnelAction } from "@/lib/analytics-events";
import type { SoulmateSketchImageScreen } from "./soulmateSketchFlow";

interface SoulmateSketchImagePageProps {
  screen: SoulmateSketchImageScreen;
}

export function SoulmateSketchImagePage({ screen }: SoulmateSketchImagePageProps) {
  const router = useRouter();
  const isIntro = screen.id === "soulmate-intro";

  const handleContinue = () => {
    trackFunnelAction("soulmate_sketch_continue_clicked", {
      funnel: "soulmate_sketch",
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
          <div className={isIntro ? "relative w-full max-w-[22rem] h-[43svh] min-h-[17rem] max-h-[27rem]" : "relative w-full max-w-[20rem] h-[40svh] min-h-[15rem] max-h-[24rem]"}>
            <div className="absolute inset-[-18%] rounded-full bg-[#38bdf8]/10 blur-3xl" />
            {isIntro ? (
              <>
                <div className="absolute left-1/2 top-1/2 h-[76%] w-[76%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7dd3fc]/20 blur-3xl" />
                <div className="absolute inset-x-7 bottom-8 h-20 rounded-full bg-[#a78bfa]/16 blur-2xl" />
              </>
            ) : null}
            <Image
              src={screen.imageSrc}
              alt={screen.imageAlt}
              fill
              sizes="(max-width: 768px) 82vw, 320px"
              className={`object-cover ${screen.imagePosition || "object-center"} ${isIntro ? "opacity-95 contrast-110 saturate-[1.02] drop-shadow-[0_0_34px_rgba(125,211,252,0.42)]" : "opacity-90 contrast-105 saturate-[0.92]"}`}
              style={{
                WebkitMaskImage:
                  isIntro
                    ? "radial-gradient(circle at 50% 50%, black 0 52%, rgba(0,0,0,0.72) 59%, transparent 69%)"
                    : "radial-gradient(ellipse at center, black 42%, rgba(0,0,0,0.8) 58%, rgba(0,0,0,0.3) 72%, transparent 84%)",
                maskImage:
                  isIntro
                    ? "radial-gradient(circle at 50% 50%, black 0 52%, rgba(0,0,0,0.72) 59%, transparent 69%)"
                    : "radial-gradient(ellipse at center, black 42%, rgba(0,0,0,0.8) 58%, rgba(0,0,0,0.3) 72%, transparent 84%)",
              }}
              priority
            />
            {isIntro ? (
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,transparent_52%,rgba(6,21,37,0.2)_74%,transparent_100%)]"
              />
            ) : null}
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
