"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { trackFunnelAction } from "@/lib/analytics-events";
import type { PalmReadingImageScreen } from "./palmReadingFlow";

interface PalmReadingImagePageProps {
  screen: PalmReadingImageScreen;
  onContinue?: () => void;
}

export function PalmReadingImagePage({ screen, onContinue }: PalmReadingImagePageProps) {
  const router = useRouter();
  const isPalmArtwork = screen.imageSrc?.startsWith("/palm-reading-");

  const handleContinue = () => {
    onContinue?.();
    trackFunnelAction("palm_reading_continue_clicked", {
      funnel: "palm_reading",
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
          <div className="h-full bg-[#38bdf8] rounded-full" style={{ width: `${screen.progress}%` }} />
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
          <motion.p variants={staggerItem} className="mt-4 max-w-[23rem] text-sm md:text-base leading-relaxed text-[#b8c7da]">
            {screen.body}
          </motion.p>
        ) : null}

        <motion.div variants={staggerItem} className="flex-1 min-h-0 w-full flex items-center justify-center py-4">
          <div className="relative w-full max-w-[21rem] h-[41svh] min-h-[16rem] max-h-[25rem]">
            <div className="absolute inset-[-18%] rounded-full bg-[#38bdf8]/14 blur-3xl" />
            <div className="absolute left-1/2 top-1/2 h-[78%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7dd3fc]/18 blur-3xl" />
            <div className="absolute inset-x-7 bottom-8 h-20 rounded-full bg-[#a78bfa]/14 blur-2xl" />
            <Image
              src={screen.imageSrc || "/palmoutline.png"}
              alt={screen.imageAlt}
              fill
              sizes="(max-width: 768px) 82vw, 320px"
              className={`object-cover ${screen.imagePosition || "object-center"} ${isPalmArtwork ? "opacity-95 brightness-[1.08] contrast-110 saturate-[1.03] drop-shadow-[0_0_36px_rgba(125,211,252,0.38)]" : "opacity-85 brightness-[1.12] contrast-125 drop-shadow-[0_0_35px_rgba(56,189,248,0.22)]"}`}
              style={isPalmArtwork ? {
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 0 45%, rgba(0,0,0,0.84) 58%, rgba(0,0,0,0.28) 73%, transparent 90%)",
                maskImage:
                  "radial-gradient(ellipse at center, black 0 45%, rgba(0,0,0,0.84) 58%, rgba(0,0,0,0.28) 73%, transparent 90%)",
              } : undefined}
              priority
            />
            {isPalmArtwork ? (
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_44%,rgba(6,21,37,0.16)_68%,#061525_100%)]" />
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
