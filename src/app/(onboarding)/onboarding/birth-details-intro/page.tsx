"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { trackFunnelAction } from "@/lib/analytics-events";

export default function BirthDetailsIntroPage() {
  const router = useRouter();

  return (
    <div className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[58%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="px-6 pt-6 text-center">
        <h1 className="text-2xl md:text-[28px] leading-tight font-semibold tracking-tight max-w-[21rem] mx-auto mb-4">
          Every birth moment carries a cosmic signature
        </h1>
        <p className="text-base leading-relaxed text-[#b8c7da] max-w-[21rem] mx-auto">
          With your birth details, your natal birth chart is mapped and interpreted by our astrologers to reveal personal guidance about your timing, relationships, and life path.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-6">
        <div className="relative h-44 w-44">
          <div className="absolute inset-[-12%] rounded-full bg-[radial-gradient(circle,_rgba(56,189,248,0.62)_0%,_rgba(37,99,235,0.36)_48%,_rgba(244,63,94,0.22)_74%,_transparent_100%)] blur-2xl" />
          <div className="absolute inset-[26%] rounded-full bg-[#38bdf8]/30 blur-xl" />
        </div>
      </div>

      <div className="mt-auto px-6 pb-6">
        <Button
          onClick={() => {
            trackFunnelAction("continue_clicked", {
              route: "/onboarding/birth-details-intro",
              step_id: "birth_details_intro",
              next_route: "/onboarding/gender",
            });
            router.push("/onboarding/gender");
          }}
          className="w-full h-14 rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
