"use client";

import { useRouter } from "next/navigation";
import { UserRound, Sparkles, HandHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";

const points = [
  {
    icon: UserRound,
    text: "Personalized palm reading for love, career, and future insights.",
  },
  {
    icon: Sparkles,
    text: "Full birth chart and daily horoscope tailored to your exact birth details.",
  },
  {
    icon: HandHeart,
    text: "Compatibility reports plus private AI chat for your personal questions.",
  },
];

export default function WhyAstrorekhaPage() {
  const router = useRouter();

  return (
    <div className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[46%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="px-6 pt-6">
        <h1 className="text-2xl md:text-[30px] leading-tight font-semibold tracking-tight text-center mb-8">
          PalmCosmic is different...
        </h1>

        <div className="max-w-[30rem] mx-auto space-y-5">
          {points.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-4">
              <Icon className="w-5 h-5 text-[#38bdf8] mt-1 flex-shrink-0" />
              <p className="text-lg leading-snug text-[#d7e4f2]">{text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto px-6 pb-6">
        <Button
          onClick={() => router.push("/onboarding/birth-details-intro")}
          className="w-full h-14 rounded-xl bg-[#38bdf8] text-base font-semibold text-black shadow-[0_18px_40px_rgba(56,189,248,0.24)] hover:bg-[#0284c7]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
