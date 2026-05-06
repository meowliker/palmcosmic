"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import {
  SOULMATE_SKETCH_ONBOARDING_QUESTIONS,
  type SoulmateSketchQuestionId,
} from "@/lib/soulmate-sketch-onboarding";
import { cn } from "@/lib/utils";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";

const ANSWERS_STORAGE_KEY = "astrorekha_soulmate_answers";
const MULTI_SELECT_QUESTION_IDS = new Set(["main_worry", "future_goal"]);
const ONBOARDING_SOULMATE_QUESTION_ORDER: SoulmateSketchQuestionId[] = [
  "attracted_to",
  "age_group",
  "vibe",
  "main_worry",
  "future_goal",
];
const ATTRACTED_TO_ALIAS_KEYS = [
  "attractedTo",
  "attracted",
  "gender_preference",
  "genderPreference",
  "target_gender",
] as const;

interface SoulmateSketchQuestionStepProps {
  routeStep: number;
}

export function SoulmateSketchQuestionStep({ routeStep }: SoulmateSketchQuestionStepProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);

  const questions = useMemo(() => {
    const byId = new Map(SOULMATE_SKETCH_ONBOARDING_QUESTIONS.map((question) => [question.id, question]));
    return ONBOARDING_SOULMATE_QUESTION_ORDER.map((id) => byId.get(id)).filter((question): question is NonNullable<typeof question> => Boolean(question));
  }, []);
  const questionIndex = Math.max(0, routeStep - 7);
  const current = questions[questionIndex];
  const totalQuestionSteps = Math.max(questions.length, 1);
  const isMultiSelect = Boolean(current && MULTI_SELECT_QUESTION_IDS.has(current.id));
  const route = `/onboarding/step-${routeStep}`;
  const stepId = `soulmate_sketch_step_${routeStep}`;

  useEffect(() => {
    try {
      const savedAnswers = localStorage.getItem(ANSWERS_STORAGE_KEY);
      if (savedAnswers) {
        setAnswers(JSON.parse(savedAnswers));
      }
    } catch {
      // Ignore invalid local data.
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(answers));
  }, [answers, ready]);

  useEffect(() => {
    if (!ready) return;

    pixelEvents.viewContent(`Soulmate Sketch Step ${routeStep}`, "onboarding_step");
    trackFunnelAction("soulmate_sketch_question_viewed", {
      route,
      step_id: stepId,
      question_id: current?.id,
      question_index: questionIndex + 1,
    });

    if (questionIndex >= totalQuestionSteps) {
      router.replace("/onboarding/step-12");
    }
  }, [current?.id, questionIndex, ready, route, routeStep, router, stepId, totalQuestionSteps]);

  const mergeWithStoredAnswers = (incoming: Record<string, string>) => {
    try {
      const savedAnswers = localStorage.getItem(ANSWERS_STORAGE_KEY);
      if (!savedAnswers) return incoming;
      const parsed = JSON.parse(savedAnswers);
      if (!parsed || typeof parsed !== "object") return incoming;
      return { ...(parsed as Record<string, string>), ...incoming };
    } catch {
      return incoming;
    }
  };

  const withAttractedAliases = (sourceAnswers: Record<string, string>) => {
    const attractedValue = sourceAnswers.attracted_to;
    if (!attractedValue) return sourceAnswers;

    const next = { ...sourceAnswers };
    for (const key of ATTRACTED_TO_ALIAS_KEYS) {
      next[key] = attractedValue;
    }
    return next;
  };

  const persistOnboardingSnapshot = async (userId: string, nextAnswers: Record<string, string>) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;

    await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        currentRoute: route,
        currentStep: stepId,
        answers: nextAnswers,
        onboardingData: {
          soulmateAnswers: nextAnswers,
        },
        source: "soulmate_sketch_question_page",
      }),
    }).catch((error) => {
      console.error("[soulmate-sketch/onboarding] failed to persist snapshot", error);
    });
  };

  const persistAnswers = (incomingAnswers: Record<string, string>) => {
    const nextAnswers = withAttractedAliases(mergeWithStoredAnswers(incomingAnswers));
    localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(nextAnswers));

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    fetch(`/api/soulmate-sketch/answers?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, answers: nextAnswers }),
    }).catch((error) => {
      console.error("[soulmate-sketch/onboarding] failed to persist soulmate answers", error);
    });

    persistOnboardingSnapshot(userId, nextAnswers);

    return nextAnswers;
  };

  const parseMultiAnswer = (raw: string | undefined): string[] => {
    if (!raw) return [];
    return raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  };

  const handleContinue = () => {
    const nextRoute = questionIndex < totalQuestionSteps - 1 ? `/onboarding/step-${routeStep + 1}` : "/onboarding/step-12";
    trackFunnelAction("soulmate_sketch_question_continue", {
      route,
      step_id: stepId,
      question_id: current?.id,
      next_route: nextRoute,
    });
    router.push(nextRoute);
  };

  const handleSelect = (value: string) => {
    if (!current) return;

    if (isMultiSelect) {
      const existing = parseMultiAnswer(answers[current.id]);
      const nextValues = existing.includes(value)
        ? existing.filter((item) => item !== value)
        : [...existing, value];

      const nextAnswers = { ...answers };
      if (nextValues.length === 0) {
        delete nextAnswers[current.id];
      } else {
        nextAnswers[current.id] = nextValues.join(",");
      }

      const mergedAnswers = persistAnswers(nextAnswers);
      setAnswers(mergedAnswers);
      trackFunnelAction("soulmate_sketch_answer_selected", {
        route,
        step_id: stepId,
        question_id: current.id,
        answer: value,
        multi_select: true,
      });
      return;
    }

    const nextAnswers =
      current.id === "attracted_to"
        ? withAttractedAliases({ ...answers, [current.id]: value })
        : { ...answers, [current.id]: value };
    const mergedAnswers = persistAnswers(nextAnswers);
    setAnswers(mergedAnswers);
    trackFunnelAction("soulmate_sketch_answer_selected", {
      route,
      step_id: stepId,
      question_id: current.id,
      answer: value,
      multi_select: false,
    });
    handleContinue();
  };

  const handleBack = () => {
    if (routeStep <= 7) {
      router.push("/onboarding/step-6");
      return;
    }
    router.push(`/onboarding/step-${routeStep - 1}`);
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white">
      <OnboardingHeader showBack currentStep={routeStep} totalSteps={14} onBack={handleBack} />

      <div className="px-6 pb-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
          <div className="h-full rounded-full bg-[#38bdf8]" style={{ width: `${Math.min(96, routeStep * 8)}%` }} />
        </div>
      </div>

      <div className="flex flex-1 flex-col px-6 pt-8">
        {current ? (
          <>
            <h1 className="mb-8 text-center text-xl font-bold md:text-2xl">{current.title}</h1>
            {isMultiSelect ? (
              <p className="-mt-4 mb-5 text-center text-xs text-[#b8c7da]">Select one or more options.</p>
            ) : null}
            <div className="space-y-3">
              {current.options.map((option) => {
                const selected = isMultiSelect
                  ? parseMultiAnswer(answers[current.id]).includes(option.value)
                  : answers[current.id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-xl border p-4 transition-all duration-200",
                      "border-[#173653] bg-[#0b2338] hover:border-[#38bdf8]/50 hover:bg-[#0d2a44]",
                      selected && "border-[#38bdf8] bg-[#38bdf8]/10"
                    )}
                  >
                    <span className="text-2xl">{option.emoji}</span>
                    <span className="font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {isMultiSelect ? (
              <button
                type="button"
                onClick={handleContinue}
                disabled={parseMultiAnswer(answers[current.id]).length === 0}
                className={cn(
                  "mt-5 h-12 w-full rounded-xl font-semibold transition-all",
                  parseMultiAnswer(answers[current.id]).length > 0
                    ? "bg-[#38bdf8] text-black"
                    : "cursor-not-allowed bg-[#15314d] text-[#b8c7da]"
                )}
              >
                Continue
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-center text-[#b8c7da]">Loading...</p>
        )}
      </div>
    </div>
  );
}
