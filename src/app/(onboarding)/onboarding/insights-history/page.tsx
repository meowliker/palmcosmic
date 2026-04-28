"use client";

import { useRouter } from "next/navigation";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";

export default function InsightsHistoryPage() {
  const router = useRouter();

  const handleSelect = (answer: "yes" | "no") => {
    localStorage.setItem("astrorekha_used_other_services", answer);
    router.push("/onboarding/why-astrorekha");
  };

  return (
    <div className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[36%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="px-6 pt-5">
        <h1 className="text-2xl md:text-[28px] leading-tight font-semibold text-center tracking-tight max-w-[21rem] mx-auto mb-8">
          Have you used other services to get insights into your future before?
        </h1>

        <div className="space-y-3 max-w-[28rem] mx-auto">
          <button
            onClick={() => handleSelect("yes")}
            className="w-full h-14 rounded-xl border border-[#38bdf8]/40 bg-[#0b2035] hover:bg-[#103554] text-left px-6 text-lg font-medium text-white transition-colors"
          >
            Yes
          </button>
          <button
            onClick={() => handleSelect("no")}
            className="w-full h-14 rounded-xl border border-[#38bdf8]/40 bg-[#0b2035] hover:bg-[#103554] text-left px-6 text-lg font-medium text-white transition-colors"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}
