"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SOULMATE_SKETCH_ONBOARDING_QUESTIONS,
  type SoulmateSketchQuestionId,
} from "@/lib/soulmate-sketch-onboarding";
import { cn } from "@/lib/utils";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import {
  useOnboardingStore,
  type ColorPreference,
  type ElementPreference,
  type RelationshipStatus,
} from "@/lib/onboarding-store";

const ANSWERS_STORAGE_KEY = "astrorekha_soulmate_answers";
const MULTI_SELECT_QUESTION_IDS = new Set<SoulmateSketchQuestionId>(["future_goal"]);
const ONBOARDING_SOULMATE_QUESTION_ORDER: SoulmateSketchQuestionId[] = [
  "relationship_status",
  "future_goal",
  "color_preference",
  "element_preference",
];
const QUESTION_ACCENT_WORDS: Partial<Record<SoulmateSketchQuestionId, string>> = {
  relationship_status: "relationship status",
  future_goal: "goals",
  color_preference: "colors",
  element_preference: "element",
};
const MULTI_SELECT_LIMIT = 3;

interface SoulmateSketchQuestionStepProps {
  routeStep: number;
}

function parseMultiAnswer(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function SoulmateSketchQuestionStep({ routeStep }: SoulmateSketchQuestionStepProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const {
    setRelationshipStatus,
    setGoals,
    setColorPreference,
    setElementPreference,
  } = useOnboardingStore();

  const questions = useMemo(() => {
    const byId = new Map(SOULMATE_SKETCH_ONBOARDING_QUESTIONS.map((question) => [question.id, question]));
    return ONBOARDING_SOULMATE_QUESTION_ORDER.map((id) => byId.get(id)).filter((question): question is NonNullable<typeof question> => Boolean(question));
  }, []);
  const questionIndex = Math.max(0, routeStep - 7);
  const current = questions[questionIndex];
  const totalQuestionSteps = Math.max(questions.length, 1);
  const isMultiSelect = Boolean(current && MULTI_SELECT_QUESTION_IDS.has(current.id));
  const isGoalsScreen = current?.id === "future_goal";
  const selectedMultiValues = current ? parseMultiAnswer(answers[current.id]) : [];
  const route = `/onboarding/step-${routeStep}`;
  const stepId = `generic_question_step_${routeStep}`;

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

    pixelEvents.viewContent(`Generic Onboarding Question ${questionIndex + 1}`, "onboarding_step");
    trackFunnelAction("generic_onboarding_question_viewed", {
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

  const persistOnboardingSnapshot = async (userId: string, nextAnswers: Record<string, string>) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const state = useOnboardingStore.getState();

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
          relationshipStatus: state.relationshipStatus,
          goals: state.goals,
          colorPreference: state.colorPreference,
          elementPreference: state.elementPreference,
          genericAnswers: nextAnswers,
        },
        source: "generic_onboarding_question_page",
      }),
    }).catch((error) => {
      console.error("[generic-onboarding] failed to persist snapshot", error);
    });
  };

  const persistAnswers = (incomingAnswers: Record<string, string>) => {
    const nextAnswers = mergeWithStoredAnswers(incomingAnswers);
    localStorage.setItem(ANSWERS_STORAGE_KEY, JSON.stringify(nextAnswers));

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    fetch(`/api/soulmate-sketch/answers?userId=${encodeURIComponent(userId)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, answers: nextAnswers }),
    }).catch((error) => {
      console.error("[generic-onboarding] failed to persist answer archive", error);
    });

    persistOnboardingSnapshot(userId, nextAnswers);

    return nextAnswers;
  };

  const syncGenericAnswer = (questionId: SoulmateSketchQuestionId, value: string) => {
    if (questionId === "relationship_status") {
      setRelationshipStatus(value as RelationshipStatus);
    }
    if (questionId === "color_preference") {
      setColorPreference(value as ColorPreference);
    }
    if (questionId === "element_preference") {
      setElementPreference(value as ElementPreference);
    }
  };

  const handleContinue = () => {
    const nextRoute = questionIndex < totalQuestionSteps - 1 ? `/onboarding/step-${routeStep + 1}` : "/onboarding/step-12";
    trackFunnelAction("generic_onboarding_question_continue", {
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
      if (!existing.includes(value) && existing.length >= MULTI_SELECT_LIMIT) {
        return;
      }
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
      if (current.id === "future_goal") {
        setGoals(nextValues);
      }
      setAnswers(mergedAnswers);
      trackFunnelAction("generic_onboarding_answer_selected", {
        route,
        step_id: stepId,
        question_id: current.id,
        answer: value,
        multi_select: true,
      });
      return;
    }

    const nextAnswers = { ...answers, [current.id]: value };
    const mergedAnswers = persistAnswers(nextAnswers);
    syncGenericAnswer(current.id, value);
    setAnswers(mergedAnswers);
    trackFunnelAction("generic_onboarding_answer_selected", {
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

  const renderTitle = () => {
    if (!current) return null;

    const accentWord = QUESTION_ACCENT_WORDS[current.id];
    if (!accentWord) return current.title;

    const accentIndex = current.title.toLowerCase().indexOf(accentWord.toLowerCase());
    if (accentIndex < 0) return current.title;

    const before = current.title.slice(0, accentIndex);
    const highlighted = current.title.slice(accentIndex, accentIndex + accentWord.length);
    const after = current.title.slice(accentIndex + accentWord.length);

    return (
      <>
        {before}
        <span className="text-[#38bdf8]">{highlighted}</span>
        {after}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#03070d] text-white">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[430px] flex-col bg-[#061525] shadow-[0_0_48px_rgba(56,189,248,0.08)]">
        <header className="px-6 pt-6">
          <div className="grid grid-cols-[40px_1fr_40px] items-center">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Go back"
              className="flex h-10 w-10 items-center justify-start text-2xl leading-none text-white transition hover:text-[#38bdf8]"
            >
              ←
            </button>
            <div className="flex items-center justify-center gap-2">
              <img src="/logo.png" alt="PalmCosmic" className="h-6 w-6 rounded-full object-contain" />
              <span className="text-base font-semibold">PalmCosmic</span>
            </div>
            <div className="text-right text-sm text-[#b8c7da]">{routeStep}/14</div>
          </div>

          <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-[#162b43]">
            <div className="h-full rounded-full bg-[#38bdf8]" style={{ width: `${Math.min(96, routeStep * 8)}%` }} />
          </div>
        </header>

        <main className="flex flex-1 flex-col px-6 pt-8">
        {current ? (
          <>
            <h1 className="text-center text-2xl font-extrabold leading-tight tracking-normal">{renderTitle()}</h1>
            {isMultiSelect ? (
              <p className="mt-3 text-center text-xs text-[#9fb0c5]">
                Selected: {selectedMultiValues.length}/{MULTI_SELECT_LIMIT}
              </p>
            ) : null}
            <div className={cn(isGoalsScreen ? "mt-6 flex flex-wrap justify-center gap-3" : "mt-8 space-y-3")}>
              {current.options.map((option) => {
                const selected = isMultiSelect
                  ? selectedMultiValues.includes(option.value)
                  : answers[current.id] === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "border text-white transition-all duration-200",
                      isGoalsScreen
                        ? "inline-flex h-10 items-center justify-center gap-2 rounded-full border-[#29374d] bg-[#080d18]/80 px-4 text-sm font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] hover:border-[#38bdf8]/70 hover:bg-[#0d2237]"
                        : "flex h-[60px] w-full items-center gap-5 rounded-lg border-[#29374d] bg-[#080d18]/80 px-4 text-left hover:border-[#38bdf8]/70 hover:bg-[#0d2237]",
                      selected && "border-[#38bdf8] bg-[#38bdf8]/15 text-white shadow-[0_0_18px_rgba(56,189,248,0.16)]"
                    )}
                  >
                    <span
                      className={cn(
                        "leading-none",
                        isGoalsScreen ? "text-base" : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-xl"
                      )}
                    >
                      {option.emoji}
                    </span>
                    <span className="font-medium">{option.label}</span>
                  </button>
                );
              })}
            </div>
            {isMultiSelect ? (
              <div className="mt-auto pb-8 pt-10">
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={selectedMultiValues.length === 0}
                  className={cn(
                    "h-14 w-full rounded-lg text-base font-semibold transition-all",
                    selectedMultiValues.length > 0
                      ? "bg-[#38bdf8] text-black shadow-[0_14px_32px_rgba(56,189,248,0.22)] hover:bg-[#67d4ff]"
                      : "cursor-not-allowed bg-[#145c78] text-[#9fb0c5]"
                  )}
                >
                  Continue
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-center text-[#b8c7da]">Loading...</p>
        )}
        </main>
      </div>
    </div>
  );
}
