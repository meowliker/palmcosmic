"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";
import { pixelEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";
import { generateUserId } from "@/lib/user-profile";
import { OnboardingFunnelTracker } from "@/components/onboarding/OnboardingFunnelTracker";

const progressSteps = [
  { label: "Order submitted", completed: true },
  { label: "Special offer", completed: true },
  { label: "Create account", active: true },
  { label: "Access to the app", completed: false },
];

const passwordRules = [
  { key: "minLength", label: "Minimum 8 characters", test: (value: string) => value.length >= 8 },
  { key: "uppercase", label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { key: "lowercase", label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { key: "number", label: "One number", test: (value: string) => /[0-9]/.test(value) },
  { key: "special", label: "One special character", test: (value: string) => /[!@#$%^&*(),.?":{}|<>]/.test(value) },
];

function getStoredEmail() {
  return (
    localStorage.getItem("palmcosmic_email") ||
    localStorage.getItem("astrorekha_checkout_email") ||
    localStorage.getItem("astrorekha_email") ||
    ""
  ).trim().toLowerCase();
}

function getOrCreateUserId() {
  const existing = localStorage.getItem("palmcosmic_user_id") || localStorage.getItem("astrorekha_user_id");
  const userId = existing || generateUserId();
  localStorage.setItem("palmcosmic_user_id", userId);
  localStorage.setItem("astrorekha_user_id", userId);
  return userId;
}

function getPasswordValidationMessage(password: string) {
  const failed = passwordRules.find((rule) => !rule.test(password));
  return failed ? `Password needs: ${failed.label.toLowerCase()}` : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function RegistrationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isPaymentEmailLocked, setIsPaymentEmailLocked] = useState(false);
  const [formError, setFormError] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const rules = useMemo(
    () => passwordRules.map((rule) => ({ ...rule, valid: rule.test(password) })),
    [password]
  );
  const passwordIsValid = rules.every((rule) => rule.valid);
  const passwordsMatch = !!confirmPassword && password === confirmPassword;
  const emailIsValid = isValidEmail(email);

  useEffect(() => {
    const storedEmail = getStoredEmail();
    if (storedEmail) setEmail(storedEmail);

    const hasCompletedRegistration = localStorage.getItem("astrorekha_registration_completed") === "true";
    if (hasCompletedRegistration) {
      router.replace("/reports");
      return;
    }

    const paymentSuccess =
      searchParams.get("payment") === "success" ||
      searchParams.get("payment_status") === "paid" ||
      searchParams.get("recovered") === "true";

    if (paymentSuccess) {
      localStorage.setItem("astrorekha_payment_completed", "true");
    }

    if (!storedEmail) {
      router.replace("/onboarding/email");
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
        if (state?.hasPaid || localStorage.getItem("astrorekha_payment_completed") === "true") {
          localStorage.setItem("astrorekha_payment_completed", "true");
          localStorage.setItem("palmcosmic_active_flow", "palm_reading");
          setIsPaymentEmailLocked(true);
          setIsAuthorized(true);
          return;
        }
        router.replace("/paywall");
      })
      .catch(() => {
        if (!cancelled) {
          if (localStorage.getItem("astrorekha_payment_completed") === "true") {
            setIsPaymentEmailLocked(true);
            setIsAuthorized(true);
          } else {
            router.replace("/paywall");
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  useEffect(() => {
    pixelEvents.viewContent("PalmCosmic Registration", "registration");
    trackFunnelAction("registration_viewed", {
      route: "/registration",
      step_id: "registration",
      funnel: "palm_reading",
      payment_return: searchParams.get("payment") === "success",
      upsell_success: searchParams.get("upsell_success") === "true",
    });
  }, [searchParams]);

  const validate = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const checkoutEmail = getStoredEmail();

    if (!normalizedEmail || !emailIsValid) return "Please enter a valid email.";
    if (isPaymentEmailLocked && checkoutEmail && normalizedEmail !== checkoutEmail) {
      return "Please use the same email used during payment.";
    }
    if (!password) return "Please create a password.";
    if (!confirmPassword) return "Please confirm your password.";
    if (!passwordIsValid) return getPasswordValidationMessage(password);
    if (!passwordsMatch) return "Passwords do not match.";
    return "";
  };

  const handleSignUp = async () => {
    setHasSubmitted(true);
    const validationError = validate();
    if (validationError || isLoading) {
      setFormError(validationError);
      return;
    }

    setIsLoading(true);
    setFormError("");

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const userId = getOrCreateUserId();
      const anonId = localStorage.getItem("astrorekha_anon_id") || userId;

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password, anonId }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (data?.error === "auth/email-already-in-use") {
          router.push(`/login?email=${encodeURIComponent(normalizedEmail)}`);
          return;
        }
        throw new Error(data?.message || data?.error || "Registration failed. Please try again.");
      }

      const registeredUserId = data?.user?.id || userId;
      localStorage.setItem("astrorekha_user_id", registeredUserId);
      localStorage.setItem("palmcosmic_user_id", registeredUserId);
      localStorage.setItem("astrorekha_email", normalizedEmail);
      localStorage.setItem("astrorekha_checkout_email", normalizedEmail);
      localStorage.setItem("palmcosmic_email", normalizedEmail);
      localStorage.setItem("astrorekha_registration_completed", "true");
      localStorage.setItem("palmcosmic_active_flow", "palm_reading");
      if (anonId) localStorage.setItem("astrorekha_prev_anon_id", anonId);

      pixelEvents.completeRegistration(normalizedEmail);
      trackFunnelAction("registration_completed", {
        route: "/registration",
        step_id: "registration",
        funnel: "palm_reading",
        user_id: registeredUserId,
      });

      fetch("/api/session", { method: "POST", credentials: "include" }).catch(() => undefined);
      fetch("/api/onboarding/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: registeredUserId,
          email: normalizedEmail,
          currentRoute: "/registration",
          currentStep: "registration",
          priorityArea: "palm_reading",
          answers: {
            registered: true,
            selectedBundle: localStorage.getItem("palmcosmic_selected_bundle") || localStorage.getItem("astrorekha_selected_plan"),
            selectedUpsells: localStorage.getItem("palmcosmic_selected_upsells") || localStorage.getItem("astrorekha_selected_upsells"),
          },
          source: "registration_completed",
        }),
      }).catch(() => undefined);

      setShowSuccess(true);
    } catch (error) {
      console.error("Registration failed:", error);
      const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
      setFormError(message);
      trackFunnelAction("registration_failed", {
        route: "/registration",
        step_id: "registration",
        funnel: "palm_reading",
        error: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    router.push("/reports");
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
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="relative flex min-h-[100svh] flex-col bg-[#061525] text-white">
      <OnboardingFunnelTracker />

      <div className="px-6 pb-4 pt-6">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-start">
            {progressSteps.map((step, index) => (
              <div key={step.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${step.completed || step.active ? "bg-[#38bdf8] text-black" : "bg-[#173653] text-[#8ba2bc]"}`}>
                    {step.completed ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span className={`mt-1 w-14 text-center text-[10px] ${step.active ? "font-medium text-[#38bdf8]" : "text-[#8ba2bc]"}`}>
                    {step.label}
                  </span>
                </div>
                {index < progressSteps.length - 1 ? (
                  <div className={`mx-1 mt-3.5 h-0.5 flex-1 ${step.completed ? "bg-[#38bdf8]" : "bg-[#173653]"}`} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center px-6 py-4">
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-2 text-center text-2xl font-bold md:text-3xl">
          Finish registration
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mb-8 text-center text-sm text-[#b8c7da]">
          Create an account to access your PalmCosmic reports
        </motion.p>

        <div className="w-full max-w-sm space-y-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(event) => setEmail(event.target.value.trim().toLowerCase())}
              readOnly={isPaymentEmailLocked}
              className={`h-12 w-full border-b border-[#173653] bg-transparent px-4 text-white outline-none transition-colors placeholder:text-[#7f91a8] focus:border-[#38bdf8] ${isPaymentEmailLocked ? "cursor-not-allowed opacity-80" : ""}`}
            />
            {isPaymentEmailLocked ? <p className="mt-2 text-xs text-[#8ba2bc]">Email is locked to match your completed payment.</p> : null}
            {hasSubmitted && !emailIsValid ? <p className="mt-2 text-xs text-red-300">Please enter a valid email.</p> : null}
          </motion.div>

          <PasswordInput
            delay={0.3}
            value={password}
            onChange={setPassword}
            placeholder="Create password"
            show={showPassword}
            setShow={setShowPassword}
          />

          <PasswordInput
            delay={0.4}
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm password"
            show={showConfirmPassword}
            setShow={setShowConfirmPassword}
            onEnter={handleSignUp}
          />

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="text-xs text-[#8ba2bc]">
            Password must be 8+ characters with uppercase, lowercase, number, and special character.
          </motion.p>

          <div className="space-y-1 text-xs text-[#8ba2bc]">
            {rules.map((rule) => (
              <p key={rule.key} className={rule.valid ? "text-emerald-300" : ""}>
                {rule.valid ? "✓" : "•"} {rule.label}
              </p>
            ))}
            {confirmPassword && !passwordsMatch ? <p className="text-red-300">✗ Passwords do not match</p> : null}
          </div>

          {formError ? <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-red-300">{formError}</motion.p> : null}
        </div>
      </div>

      <div className="px-6 pb-24">
        <div className="mx-auto w-full max-w-sm">
          <Button onClick={handleSignUp} disabled={isLoading} className="h-14 w-full bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0ea5e9]" size="lg">
            {isLoading ? "Creating account..." : "Sign up with Email"}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showSuccess ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-50 flex items-end">
            <div className="absolute inset-0 bg-black/55" />
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative w-full rounded-t-3xl bg-gradient-to-b from-[#0b2338] to-[#061525] p-8 pb-12">
              <div className="relative z-10 flex flex-col items-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }} className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#38bdf8]/15">
                  <ThumbsUp className="h-10 w-10 text-[#38bdf8]" strokeWidth={1.5} />
                </motion.div>
                <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-4 text-2xl font-bold">
                  Congratulations
                </motion.h2>
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="mb-8 max-w-xs text-center text-[#b8c7da]">
                  You have successfully registered for PalmCosmic. You can now access your reports.
                </motion.p>
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="w-full">
                  <Button onClick={handleContinue} className="h-14 w-full bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0ea5e9]" size="lg">
                    Get My Prediction
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

function PasswordInput({
  delay,
  value,
  onChange,
  placeholder,
  show,
  setShow,
  onEnter,
}: {
  delay: number;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  setShow: (value: boolean) => void;
  onEnter?: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="relative">
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onEnter?.();
        }}
        className="h-12 w-full border-b border-[#173653] bg-transparent px-4 pr-12 text-white outline-none transition-colors placeholder:text-[#7f91a8] focus:border-[#38bdf8]"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8ba2bc] hover:text-white" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
      </button>
    </motion.div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense fallback={<main className="min-h-[100svh] bg-[#061525]" />}>
      <RegistrationContent />
    </Suspense>
  );
}
