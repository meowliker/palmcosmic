"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandedOnboardingHeader } from "@/components/onboarding/BrandedOnboardingHeader";
import { trackFunnelAction } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";
import { generateUserId } from "@/lib/user-profile";
import type { FlowKey } from "@/lib/report-entitlements";

const FLOW_LABELS: Record<FlowKey, string> = {
  future_prediction: "2026 Prediction",
  soulmate_sketch: "Soulmate Sketch",
  palm_reading: "Palm Reading",
  future_partner: "Future Partner",
  compatibility: "Compatibility",
};

const REQUIREMENTS = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "Uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "Number", test: (value: string) => /[0-9]/.test(value) },
  { label: "Special character", test: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
];

function normalizeFlow(value: string | null): FlowKey {
  if (value && value in FLOW_LABELS) return value as FlowKey;
  const stored = typeof window !== "undefined" ? localStorage.getItem("palmcosmic_active_flow") : null;
  if (stored && stored in FLOW_LABELS) return stored as FlowKey;
  return "future_prediction";
}

function getPasswordError(password: string, confirmPassword: string) {
  const failed = REQUIREMENTS.find((requirement) => !requirement.test(password));
  if (failed) return `Password needs: ${failed.label.toLowerCase()}`;
  if (password !== confirmPassword) return "Passwords do not match";
  return "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function CreatePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const flow = useMemo(() => normalizeFlow(searchParams.get("flow")), [searchParams]);
  const reportLabel = FLOW_LABELS[flow];
  const passwordError = password || confirmPassword ? getPasswordError(password, confirmPassword) : "";
  const emailIsValid = isValidEmail(email);
  const emailError = hasSubmitted && !emailIsValid ? "Enter a valid email address." : "";
  const passwordsMatch = !!confirmPassword && password === confirmPassword;
  const formIsValid = emailIsValid && !!password && !!confirmPassword && !passwordError;

  useEffect(() => {
    const storedEmail =
      localStorage.getItem("palmcosmic_email") ||
      localStorage.getItem("astrorekha_email") ||
      "";

    if (storedEmail) setEmail(storedEmail);

    const hasCompletedPayment = localStorage.getItem("astrorekha_payment_completed") === "true";
    const isDemoReturn = searchParams.get("demo") === "true";
    const paymentSuccess = searchParams.get("payment") === "success" || searchParams.get("payment_status") === "paid";

    if (hasCompletedPayment || isDemoReturn || paymentSuccess) {
      setIsAuthorized(true);
      localStorage.setItem("astrorekha_payment_completed", "true");
      localStorage.setItem("palmcosmic_active_flow", flow);
      return;
    }

    if (!storedEmail) {
      router.replace("/welcome");
      return;
    }

    let cancelled = false;
    fetch(`/api/user/payment-state?email=${encodeURIComponent(storedEmail)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((state) => {
        if (cancelled) return;
        if (state?.hasPaid && state?.isRegistered) {
          router.replace(`/login?email=${encodeURIComponent(storedEmail)}`);
          return;
        }
        if (state?.hasPaid) {
          localStorage.setItem("astrorekha_payment_completed", "true");
          setIsAuthorized(true);
          return;
        }
        router.replace(`/onboarding/${flow.replace(/_/g, "-")}/paywall`);
      })
      .catch(() => {
        if (!cancelled) router.replace(`/onboarding/${flow.replace(/_/g, "-")}/paywall`);
      });

    return () => {
      cancelled = true;
    };
  }, [flow, router, searchParams]);

  useEffect(() => {
    pixelEvents.viewContent("Create Password", "registration");
    trackFunnelAction("create_password_viewed", {
      funnel: flow,
      route: "/onboarding/create-password",
      step_id: "create_password",
      report: reportLabel,
      demo: searchParams.get("demo") === "true",
    });
  }, [flow, reportLabel, searchParams]);

  const handleSubmit = async () => {
    setHasSubmitted(true);
    if (!formIsValid || isLoading) return;

    setError("");
    setIsLoading(true);

    try {
      const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
      const anonId = localStorage.getItem("astrorekha_anon_id") || userId;

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, anonId }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data?.error === "auth/email-already-in-use") {
          router.push(`/login?email=${encodeURIComponent(email)}`);
          return;
        }
        throw new Error(data?.message || data?.error || "Unable to create your password");
      }

      const registeredUserId = data?.user?.id || userId;
      localStorage.setItem("astrorekha_user_id", registeredUserId);
      localStorage.setItem("palmcosmic_user_id", registeredUserId);
      localStorage.setItem("astrorekha_email", email);
      localStorage.setItem("palmcosmic_email", email);
      localStorage.setItem("astrorekha_registration_completed", "true");
      localStorage.setItem("palmcosmic_active_flow", flow);
      if (anonId) localStorage.setItem("astrorekha_prev_anon_id", anonId);

      trackFunnelAction("create_password_completed", {
        funnel: flow,
        route: "/onboarding/create-password",
        step_id: "create_password",
        report: reportLabel,
        user_id: registeredUserId,
      });
      pixelEvents.completeRegistration(email);

      try {
        await fetch("/api/session", { method: "POST", credentials: "include" });
      } catch (sessionError) {
        console.error("Failed to set session after registration:", sessionError);
      }

      router.push("/reports");
    } catch (err: any) {
      console.error("Create password failed:", err);
      const message = err?.message || "Unable to create your password. Please try again.";
      setError(message);
      trackFunnelAction("create_password_failed", {
        funnel: flow,
        route: "/onboarding/create-password",
        step_id: "create_password",
        report: reportLabel,
        error: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <main className="min-h-[100svh] bg-[#061525] text-white">
        <div className="flex min-h-[100svh] items-center justify-center px-6">
          <Loader2 className="h-8 w-8 animate-spin text-[#38bdf8]" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100svh] bg-[#061525] text-white">
      <div className="mx-auto flex min-h-[100svh] max-w-[30rem] flex-col px-5 pb-7">
        <BrandedOnboardingHeader onBack={() => router.back()} />

        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#173653]">
          <div className="h-full w-full rounded-full bg-[#38bdf8]" />
        </div>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-1 flex-col justify-center py-7"
        >
          <h1 className="text-center text-3xl font-bold leading-tight sm:text-4xl">Create your account</h1>

          <div className="mt-8 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#b8c7da]">Email</label>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
                type="email"
                placeholder="Enter your email"
                className="h-14 w-full rounded-2xl border border-[#38bdf8]/25 bg-[#0b2338] px-4 text-white outline-none transition placeholder:text-[#6f8196] focus:border-[#38bdf8]"
              />
              {emailError && <p className="mt-2 text-xs font-medium text-red-300">{emailError}</p>}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#b8c7da]">Password</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  className="h-14 w-full rounded-2xl border border-[#38bdf8]/25 bg-[#0b2338] px-4 pr-12 text-white outline-none transition placeholder:text-[#6f8196] focus:border-[#38bdf8]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b8c7da] hover:text-white"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-[#b8c7da]">Confirm password</label>
              <div className="relative">
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  className="h-14 w-full rounded-2xl border border-[#38bdf8]/25 bg-[#0b2338] px-4 pr-12 text-white outline-none transition placeholder:text-[#6f8196] focus:border-[#38bdf8]"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSubmit();
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#b8c7da] hover:text-white"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-0.5 text-[10px] font-medium leading-4 sm:text-[11px]">
            <span className={passwordsMatch ? "text-emerald-300" : hasSubmitted ? "text-red-300" : "text-[#7f91a7]"}>
              Passwords match
            </span>
            {REQUIREMENTS.map((requirement) => {
              const met = requirement.test(password);
              return (
                <span
                  key={requirement.label}
                  className={met ? "text-emerald-300" : hasSubmitted ? "text-red-300" : "text-[#7f91a7]"}
                >
                  {requirement.label}
                </span>
              );
            })}
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}
        </motion.section>

        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="h-16 w-full rounded-2xl bg-[#38bdf8] text-lg font-bold text-black shadow-[0_20px_48px_rgba(56,189,248,0.28)] hover:bg-[#0284c7] disabled:cursor-not-allowed disabled:bg-[#173653] disabled:text-[#6f8196]"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create"}
        </Button>
      </div>
    </main>
  );
}

export default function CreatePasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-[100svh] bg-[#061525]" />}>
      <CreatePasswordContent />
    </Suspense>
  );
}
