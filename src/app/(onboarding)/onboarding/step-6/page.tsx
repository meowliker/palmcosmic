"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useHaptic } from "@/hooks/useHaptic";
import { generateUserId } from "@/lib/user-profile";
import Image from "next/image";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { trackFunnelAction } from "@/lib/analytics-events";

export default function Step6Page() {
  const router = useRouter();
  const { triggerLight } = useHaptic();

  const handleContinue = async () => {
    triggerLight();
    trackFunnelAction("continue_clicked", {
      route: "/onboarding/step-6",
      step_id: "chart_preparing",
      next_route: "/onboarding/step-7",
    });

    const onboardingFlow = localStorage.getItem("astrorekha_onboarding_flow");
    if (onboardingFlow !== "flow-b") {
      router.push("/onboarding/step-7");
      return;
    }

    const existingVariant = localStorage.getItem("astrorekha_layout_variant");
    if (existingVariant === "B") {
      router.push("/onboarding/step-7");
      return;
    }
    if (existingVariant === "A") {
      router.push("/onboarding/step-7");
      return;
    }

    try {
      const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
      const visitorId =
        localStorage.getItem("astrorekha_ab_visitor_id") ||
        userId;
      localStorage.setItem("astrorekha_ab_visitor_id", visitorId);

      const cfgRes = await fetch("/api/ab-test/layout-config", { cache: "no-store" });
      const cfgJson = await cfgRes.json().catch(() => ({}));
      const testId = cfgJson?.config?.testId || "onboarding-layout-qa";
      const enabled = cfgJson?.config?.enabled !== false;
      localStorage.setItem("astrorekha_ab_test_id", testId);

      if (!enabled) {
        localStorage.setItem("astrorekha_layout_variant", "A");
        router.push("/onboarding/step-7");
        return;
      }

      const variantParams = new URLSearchParams({
        testId,
        visitorId,
        userId,
      });
      const variantRes = await fetch(`/api/ab-test?${variantParams.toString()}`, { cache: "no-store" });
      const variantJson = await variantRes.json().catch(() => ({}));
      const variant = variantJson?.variant === "B" ? "B" : "A";
      const resolvedTestId = variantJson?.testId || testId;
      localStorage.setItem("astrorekha_ab_test_id", resolvedTestId);

      localStorage.setItem("astrorekha_layout_variant", variant);
      if (variant === "B") {
        router.push("/onboarding/step-7");
        return;
      }
    } catch (error) {
      console.error("Failed to assign onboarding layout variant at step-6:", error);
    }

    router.push("/onboarding/step-7");
  };

  return (
    <div className="flex-1 min-h-[100svh] max-h-[100svh] overflow-hidden bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-3">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[78%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-6 pt-3 text-center">
        <h1 className="text-xl md:text-2xl leading-tight font-semibold tracking-tight max-w-[21rem] mb-3">
          The Astrologer has started preparing your natal chart
        </h1>

        <p className="text-sm md:text-base leading-relaxed text-[#b8c7da] max-w-[22rem]">
          Your upcoming transits may reveal new timing, opportunities, and relationship energy.
        </p>

        <p className="mt-3 text-sm md:text-base leading-relaxed text-[#d7e4f2]">
          Let&apos;s turn it into clear guidance.
        </p>

        <div className="flex-1 min-h-0 w-full flex items-center justify-center py-4">
        <div className="w-full max-w-[19rem]">
          <div className="relative mx-auto h-[38svh] min-h-[15rem] max-h-[21rem] w-full">
            <div className="absolute inset-[-18%] rounded-full bg-[#38bdf8]/10 blur-3xl" />
            <Image
              src="/onboarding-couple.png"
              alt="Happy couple laughing together"
              fill
              sizes="(max-width: 768px) 78vw, 304px"
              className="object-cover object-center opacity-70 mix-blend-luminosity contrast-110 brightness-[0.72] saturate-[0.82]"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 34%, rgba(0,0,0,0.82) 52%, rgba(0,0,0,0.28) 66%, transparent 76%)",
                maskImage:
                  "radial-gradient(ellipse at center, black 34%, rgba(0,0,0,0.82) 52%, rgba(0,0,0,0.28) 66%, transparent 76%)",
              }}
              priority
            />
            <div
              className="absolute inset-0 bg-gradient-to-b from-[#061525]/25 via-transparent to-[#061525]/70 pointer-events-none"
              style={{
                WebkitMaskImage:
                  "radial-gradient(ellipse at center, black 38%, rgba(0,0,0,0.7) 58%, transparent 78%)",
                maskImage:
                  "radial-gradient(ellipse at center, black 38%, rgba(0,0,0,0.7) 58%, transparent 78%)",
              }}
            />
          </div>
        </div>
        </div>
      </div>

      <div className="mt-auto px-6 pb-5">
        <Button
          onClick={handleContinue}
          className="w-full h-[52px] rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
