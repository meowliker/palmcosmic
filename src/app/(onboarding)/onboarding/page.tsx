"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Apple } from "lucide-react";
import { pixelEvents } from "@/lib/pixel-events";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";

export default function OnboardingPage() {
  const router = useRouter();

  // Route protection: Check user status and redirect accordingly
  useEffect(() => {
    const hasCompletedPayment = localStorage.getItem("astrorekha_payment_completed") === "true";
    const hasCompletedRegistration = localStorage.getItem("astrorekha_registration_completed") === "true";

    if (hasCompletedRegistration) {
      router.replace("/dashboard");
      return;
    } else if (hasCompletedPayment) {
      const flow = localStorage.getItem("palmcosmic_active_flow") || "future_prediction";
      router.replace(`/onboarding/create-password?flow=${encodeURIComponent(flow)}`);
      return;
    }
  }, [router]);

  const handleContinue = () => {
    pixelEvents.lead();
    router.push("/onboarding/insights-history");
  };

  return (
    <div className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[27%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="px-6 pt-3 flex flex-col items-center text-center">
        <h1 className="text-2xl md:text-[28px] leading-tight font-semibold tracking-tight mb-4 max-w-[21rem]">
          Trusted by over 8 million users for guidance and clarity
        </h1>

        <p className="text-base leading-relaxed text-[#b8c7da] mb-2">
          Rated 4.9 Stars
          <br />
          by our satisfied users
        </p>

        <div className="text-2xl leading-none tracking-[0.18em] text-[#FFBE2F] mb-8">
          ★★★★★
        </div>

        <div className="flex items-center justify-center gap-7 text-sm leading-none text-white/90 font-medium">
          <div className="flex items-center gap-2.5">
            <Apple className="w-4 h-4 text-white" strokeWidth={2.3} />
            <span>App Store</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-base font-semibold text-[#4285F4]">G</span>
            <span>Google Play</span>
          </div>
        </div>
      </div>

      <div className="mt-auto px-6 pb-6">
        <Button
          onClick={handleContinue}
          className="w-full h-14 rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
