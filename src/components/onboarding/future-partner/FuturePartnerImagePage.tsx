"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { trackFunnelAction } from "@/lib/analytics-events";
import type { FuturePartnerImageScreen } from "./futurePartnerFlow";

interface FuturePartnerImagePageProps {
  screen: FuturePartnerImageScreen;
}

export function FuturePartnerImagePage({ screen }: FuturePartnerImagePageProps) {
  const router = useRouter();
  const isIntro = screen.id === "future-partner-intro";
  const isFuturePartnerArtwork = screen.imageSrc?.startsWith("/future-partner-");

  const handleContinue = () => {
    trackFunnelAction("future_partner_continue_clicked", {
      funnel: "future_partner",
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
          <div className="relative w-full max-w-[21rem] h-[39svh] min-h-[15rem] max-h-[23rem] overflow-hidden rounded-[2rem]">
            <div className="absolute inset-[-18%] rounded-full bg-[#38bdf8]/14 blur-3xl" />
            {isFuturePartnerArtwork ? (
              <>
                <div className="absolute left-1/2 top-1/2 h-[82%] w-[82%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7dd3fc]/18 blur-3xl" />
                <div className="absolute inset-x-8 bottom-8 h-20 rounded-full bg-[#a78bfa]/14 blur-2xl" />
              </>
            ) : (
              <div className="absolute inset-0 rounded-[2rem] bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.15),transparent_68%)]" />
            )}
            <Image
              src={screen.imageSrc || "/onboarding-couple.png"}
              alt={screen.imageAlt}
              fill
              sizes="(max-width: 768px) 84vw, 340px"
              className={`${isIntro ? "object-cover object-[50%_58%] opacity-95 brightness-[0.95] contrast-105 saturate-[0.9] sepia-[0.1] drop-shadow-[0_0_36px_rgba(125,211,252,0.32)]" : isFuturePartnerArtwork ? "object-cover opacity-95 brightness-[1.02] contrast-105 saturate-[0.94] drop-shadow-[0_0_36px_rgba(125,211,252,0.34)]" : "object-contain opacity-90 brightness-[1.08] contrast-110 drop-shadow-[0_0_35px_rgba(56,189,248,0.18)]"} ${isIntro ? "" : screen.imagePosition || "object-center"}`}
              style={isFuturePartnerArtwork ? {
                WebkitMaskImage:
                  isIntro
                    ? "radial-gradient(ellipse 60% 72% at 50% 54%, black 0 50%, rgba(0,0,0,0.84) 66%, rgba(0,0,0,0.24) 82%, transparent 100%)"
                    : "radial-gradient(ellipse at center, black 0 44%, rgba(0,0,0,0.82) 59%, rgba(0,0,0,0.28) 75%, transparent 91%)",
                maskImage:
                  isIntro
                    ? "radial-gradient(ellipse 60% 72% at 50% 54%, black 0 50%, rgba(0,0,0,0.84) 66%, rgba(0,0,0,0.24) 82%, transparent 100%)"
                    : "radial-gradient(ellipse at center, black 0 44%, rgba(0,0,0,0.82) 59%, rgba(0,0,0,0.28) 75%, transparent 91%)",
              } : undefined}
              priority
            />
            {isFuturePartnerArtwork ? (
              <>
                <div className="pointer-events-none absolute inset-0 bg-[#38bdf8]/12 mix-blend-screen" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_38%,rgba(6,21,37,0.16)_68%,#061525_100%)]" />
              </>
            ) : null}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#061525] to-transparent" />
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
