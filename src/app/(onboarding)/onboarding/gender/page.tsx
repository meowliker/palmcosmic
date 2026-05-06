"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { OnboardingSidebar } from "@/components/OnboardingSidebar";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { useOnboardingStore, type Gender } from "@/lib/onboarding-store";
import { generateUserId } from "@/lib/user-profile";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import { cn } from "@/lib/utils";

const genderOptions: { value: Exclude<Gender, null>; label: string; icon: string }[] = [
  { value: "female", label: "Female", icon: "♀" },
  { value: "male", label: "Male", icon: "♂" },
  { value: "non-binary", label: "Non-binary", icon: "⚥" },
];

export default function GenderPage() {
  const router = useRouter();
  const onboarding = useOnboardingStore();
  const { gender, setGender } = onboarding;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [savingGender, setSavingGender] = useState<Gender>(null);

  useEffect(() => {
    const hasCompletedPayment = localStorage.getItem("astrorekha_payment_completed") === "true";
    const hasCompletedRegistration = localStorage.getItem("astrorekha_registration_completed") === "true";

    if (hasCompletedRegistration) {
      router.replace("/dashboard");
      return;
    }

    if (hasCompletedPayment) {
      const flow = localStorage.getItem("palmcosmic_active_flow") || "future_prediction";
      router.replace(`/onboarding/create-password?flow=${encodeURIComponent(flow)}`);
    }
  }, [router]);

  const persistGenderSnapshot = async (selectedGender: Exclude<Gender, null>, userId: string) => {
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || undefined;
    const onboardingData = {
      gender: selectedGender,
      birthMonth: onboarding.birthMonth,
      birthDay: onboarding.birthDay,
      birthYear: onboarding.birthYear,
      birthHour: onboarding.birthHour,
      birthMinute: onboarding.birthMinute,
      birthPeriod: onboarding.birthPeriod,
      birthPlace: onboarding.birthPlace,
      knowsBirthTime: onboarding.knowsBirthTime,
      relationshipStatus: onboarding.relationshipStatus,
      goals: onboarding.goals,
      colorPreference: onboarding.colorPreference,
      elementPreference: onboarding.elementPreference,
      sunSign: onboarding.sunSign?.name || null,
      moonSign: onboarding.moonSign?.name || null,
      ascendantSign: onboarding.ascendantSign?.name || null,
      modality: onboarding.modality,
      polarity: onboarding.polarity,
    };

    const response = await fetch("/api/onboarding/snapshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        email,
        currentRoute: "/onboarding/gender",
        currentStep: "gender",
        answers: { gender: selectedGender },
        onboardingData,
        source: "gender_page",
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Unable to save gender");
    }
  };

  const handleGenderSelect = async (selectedGender: Exclude<Gender, null>) => {
    if (savingGender) return;

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);

    setGender(selectedGender);
    setSavingGender(selectedGender);

    const leadEventId = `lead_gender_${userId}`;
    pixelEvents.lead(leadEventId);
    trackFunnelAction("gender_selected", {
      route: "/onboarding/gender",
      step_id: "gender",
      answer: selectedGender,
      user_id: userId,
      next_route: "/onboarding/birthday",
    });

    try {
      await persistGenderSnapshot(selectedGender, userId);
      trackFunnelAction("gender_snapshot_saved", {
        route: "/onboarding/gender",
        step_id: "gender",
        answer: selectedGender,
        user_id: userId,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "snapshot_failed";
      console.error("[gender] snapshot failed:", message);
      trackFunnelAction("gender_snapshot_failed", {
        route: "/onboarding/gender",
        step_id: "gender",
        answer: selectedGender,
        user_id: userId,
        error: message,
      });
    } finally {
      setSavingGender(null);
      router.push("/onboarding/birthday");
    }
  };

  return (
    <>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white"
      >
        <header className="flex items-center justify-end px-4 py-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="-mr-2 p-2 text-[#b8c7da] transition-colors hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-1 flex-col items-center px-6">
          <motion.div variants={staggerItem} className="mb-6 flex flex-col items-center gap-2">
            <div className="relative">
              <div className="absolute inset-0 scale-150 rounded-full bg-[#38bdf8]/20 blur-xl" />
              <Image
                src="/logo.png"
                alt="PalmCosmic"
                width={48}
                height={48}
                className="relative"
                priority
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
            </div>
            <span className="text-xl font-semibold">PalmCosmic</span>
          </motion.div>

          <motion.h1 variants={staggerItem} className="mb-2 text-center text-2xl font-bold md:text-3xl">
            Personalized palm reading with
            <br />
            powerful predictions
          </motion.h1>

          <motion.p variants={staggerItem} className="mb-12 max-w-sm text-center text-sm leading-relaxed text-[#b8c7da]">
            Complete a 1-minute quiz to get a personalized prediction. The result is not guaranteed and may vary from case to case.
          </motion.p>

          <motion.p variants={staggerItem} className="mb-6 text-sm text-[#b8c7da]">
            Select your gender to start
          </motion.p>

          <motion.div variants={staggerItem} className="flex w-full max-w-md justify-center gap-4">
            {genderOptions.map((option) => {
              const isSelected = gender === option.value;
              const isSaving = savingGender === option.value;

              return (
                <button
                  key={option.value}
                  onClick={() => handleGenderSelect(option.value)}
                  disabled={Boolean(savingGender)}
                  className={cn(
                    "flex min-w-[100px] flex-col items-center justify-center gap-3 rounded-2xl border p-6 transition-all duration-200 md:min-w-[120px]",
                    "border-[#173653] bg-[#0b2338] hover:border-[#38bdf8]/50 hover:bg-[#0d2a44]",
                    "disabled:cursor-not-allowed disabled:opacity-75",
                    isSelected && "border-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_18px_44px_rgba(56,189,248,0.16)]"
                  )}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#071a2b]">
                    <span className="text-2xl text-[#38bdf8]">{isSaving ? "..." : option.icon}</span>
                  </div>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              );
            })}
          </motion.div>
        </div>
      </motion.div>

      <OnboardingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
