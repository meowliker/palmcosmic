"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { trackFunnelAction } from "@/lib/analytics-events";
import { generateUserId } from "@/lib/user-profile";
import type { FlowKey } from "@/lib/report-entitlements";

type CouponCodeLinkProps = {
  flow: FlowKey;
  route: string;
  stepId: string;
  emailPath: string;
};

export function CouponCodeLink({ flow, route, stepId, emailPath }: CouponCodeLinkProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const openModal = () => {
    setIsOpen(true);
    setError("");
    trackFunnelAction("coupon_code_link_clicked", {
      funnel: flow,
      route,
      step_id: stepId,
    });
  };

  const applyCode = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode || isApplying) return;

    setError("");
    setIsApplying(true);

    try {
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || generateUserId();
      localStorage.setItem("astrorekha_user_id", userId);
      localStorage.setItem("palmcosmic_active_flow", flow);

      const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
      if (!email) {
        localStorage.setItem("palmcosmic_pending_coupon_code", trimmedCode);
        router.push(emailPath);
        return;
      }

      trackFunnelAction("coupon_code_apply_clicked", {
        funnel: flow,
        route,
        step_id: stepId,
        code_length: trimmedCode.length,
      });

      const response = await fetch("/api/promo/activate-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmedCode,
          userId,
          email,
          flow,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || "Unable to apply coupon code");
      }

      localStorage.setItem("astrorekha_payment_completed", "true");
      localStorage.setItem("palmcosmic_promo_code_applied", "true");
      localStorage.setItem("palmcosmic_promo_kind", data.kind || "");
      localStorage.setItem("palmcosmic_trial_end_date", data.trialEndsAt || "");

      trackFunnelAction("coupon_code_applied", {
        funnel: flow,
        route,
        step_id: stepId,
        promo_kind: data.kind,
        reports: data.reports?.join(",") || "",
      });

      router.push(data.redirectPath || `/onboarding/create-password?flow=${encodeURIComponent(flow)}&promo=true`);
    } catch (err: any) {
      const message = err?.message || "Unable to apply coupon code";
      setError(message);
      trackFunnelAction("coupon_code_apply_failed", {
        funnel: flow,
        route,
        step_id: stepId,
        error: message,
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="mt-3 text-sm font-semibold text-[#38bdf8] underline-offset-4 transition-colors hover:text-[#7dd3fc] hover:underline"
      >
        Have a coupon code?
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#020b15]/85 p-4 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              onClick={(event) => event.stopPropagation()}
              className="w-full max-w-sm rounded-lg border border-[#38bdf8]/25 bg-[#061525] p-5 shadow-2xl shadow-black/40"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Enter coupon code</h2>
                  <p className="mt-1 text-sm leading-5 text-[#8fa3b8]">
                    Test access without a payment charge.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#173653] bg-[#0b2338] text-white transition-colors hover:border-[#38bdf8]/60"
                  aria-label="Close coupon code"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyCode();
                }}
                placeholder="Coupon code"
                className="h-12 w-full rounded-lg border border-[#173653] bg-[#0b2338] px-4 text-white outline-none transition-colors placeholder:text-[#8fa3b8] focus:border-[#38bdf8]"
                autoFocus
              />

              {error ? <p className="mt-3 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">{error}</p> : null}

              <Button
                onClick={applyCode}
                disabled={isApplying || !code.trim()}
                className="mt-4 h-12 w-full rounded-lg bg-[#38bdf8] font-bold text-black hover:bg-[#7dd3fc] disabled:bg-[#173653] disabled:text-[#8fa3b8]"
              >
                {isApplying ? <Loader2 className="h-5 w-5 animate-spin" /> : "Apply Coupon"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
