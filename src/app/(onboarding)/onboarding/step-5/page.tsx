"use client";

import { useEffect, useState } from "react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useRouter } from "next/navigation";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { trackFunnelAction } from "@/lib/analytics-events";

const START_PERCENT = 0;
const END_PERCENT = 100;
const LOADING_DURATION_MS = 9000;
const REVIEW_ROTATE_MS = 2400;
const RING_RADIUS = 86;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const reviews = [
  {
    text: "Palm + chart insights felt uncannily personal and accurate for my current phase.",
    author: "Megan R.",
  },
  {
    text: "The compatibility guidance was practical, clear, and way more detailed than I expected.",
    author: "Jordan T.",
  },
  {
    text: "Elysia explained my reading in simple language and gave me steps I could actually use.",
    author: "Sofia W.",
  },
];

export default function Step5Page() {
  const router = useRouter();
  const [progress, setProgress] = useState(START_PERCENT);
  const [reviewIndex, setReviewIndex] = useState(0);

  // Keep sign generation behavior intact while loading is shown.
  const { 
    calculateLocalSigns,
    fetchAccurateSigns,
    signsFromApi,
  } = useOnboardingStore();

  useEffect(() => {
    trackFunnelAction("analysis_loading_started", {
      route: "/onboarding/step-5",
      step_id: "loading_analysis",
      duration_ms: LOADING_DURATION_MS,
    });

    calculateLocalSigns();
    if (!signsFromApi) {
      fetchAccurateSigns();
    }
  }, [calculateLocalSigns, fetchAccurateSigns, signsFromApi]);

  useEffect(() => {
    let frameId = 0;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const ratio = Math.min(elapsed / LOADING_DURATION_MS, 1);
      setProgress(Math.round(ratio * END_PERCENT));

      if (ratio < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    const rotation = setInterval(() => {
      setReviewIndex((prev) => (prev + 1) % reviews.length);
    }, REVIEW_ROTATE_MS);

    return () => clearInterval(rotation);
  }, []);

  useEffect(() => {
    if (progress < END_PERCENT) return;

    const nextStepTimer = setTimeout(() => {
      trackFunnelAction("analysis_loading_completed", {
        route: "/onboarding/step-5",
        step_id: "loading_analysis",
        next_route: "/onboarding/step-6",
      });
      router.push("/onboarding/step-6");
    }, 350);

    return () => clearTimeout(nextStepTimer);
  }, [progress, router]);

  const ringOffset = RING_CIRCUMFERENCE - (progress / 100) * RING_CIRCUMFERENCE;
  const activeReview = reviews[reviewIndex];

  return (
    <div className="flex-1 min-h-screen bg-[#061525] text-white flex flex-col">
      <BrandedOnboardingHeader onBack={() => router.back()} />

      <div className="px-6 pb-4">
        <div className="w-full h-1.5 bg-[#15314d] rounded-full overflow-hidden">
          <div className="h-full w-[70%] bg-[#38bdf8] rounded-full" />
        </div>
      </div>

      <div className="flex-1 px-6 pt-6 pb-10 flex flex-col items-center">
        <div className="relative h-48 w-48">
          <svg
            className="absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 192 192"
            aria-hidden="true"
          >
            <circle
              cx="96"
              cy="96"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              className="text-[#15314d]"
            />
            <circle
              cx="96"
              cy="96"
              r={RING_RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              className="text-[#38bdf8] transition-[stroke-dashoffset] duration-100 ease-linear"
            />
          </svg>
          <div className="absolute inset-[12px] rounded-full bg-[#061525] flex items-center justify-center">
            <span className="text-[54px] leading-none font-semibold tracking-tight">{progress}%</span>
          </div>
        </div>

        <div className="mt-10 text-center max-w-[24rem] min-h-[9.25rem]">
          <p
            key={`${reviewIndex}-${activeReview.author}`}
            className="text-lg leading-relaxed font-normal text-[#d7e4f2] transition-opacity duration-500"
          >
            &quot;{activeReview.text}&quot;
            <br />
            ({activeReview.author})
          </p>
        </div>

        <p className="mt-14 text-center text-base text-[#b8c7da]">
          The Astrologer is preparing your personalized cosmic guidance...
        </p>
      </div>
    </div>
  );
}
