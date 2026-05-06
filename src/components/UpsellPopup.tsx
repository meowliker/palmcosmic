"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { featureNames, featurePrices, UnlockedFeatures } from "@/lib/user-store";
import { startStripeCheckout } from "@/lib/stripe-checkout";

// Map feature keys to report IDs for Razorpay checkout
const featureToReportId: Record<keyof UnlockedFeatures, string> = {
  palmReading: "report-palm",
  prediction2026: "report-2026",
  birthChart: "report-birth-chart",
  compatibilityTest: "report-compatibility",
  soulmateSketch: "report-soulmate-sketch",
  futurePartnerReport: "report-future-partner",
};

interface UpsellPopupProps {
  isOpen: boolean;
  onClose: () => void;
  feature: keyof UnlockedFeatures;
  onPurchase?: () => void;
}

export function UpsellPopup({ isOpen, onClose, feature }: UpsellPopupProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const handlePageShow = () => setIsProcessing(false);
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  const handlePurchase = async () => {
    setIsProcessing(true);
    setError("");

    try {
      const reportId = featureToReportId[feature];

      await startStripeCheckout({
        type: "report",
        packageId: reportId,
        userId: localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "",
        email: localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "",
        firstName: localStorage.getItem("astrorekha_name") || localStorage.getItem("palmcosmic_name") || "Customer",
        successPath: "/reports",
        cancelPath: "/reports",
      });
    } catch (err) {
      console.error("Checkout error:", err);
      setError("Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  const featureName = featureNames[feature];
  const featurePrice = featurePrices[feature];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-gradient-to-b from-[#0b2338] to-[#061525] rounded-3xl w-full max-w-sm p-6 border border-[#38bdf8]/25 shadow-2xl shadow-black/40"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#061525] border border-[#173653] flex items-center justify-center hover:border-[#38bdf8]/60 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-[#061525] border border-[#173653] flex items-center justify-center">
                <Sparkles className="w-10 h-10 text-[#38bdf8]" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-white text-xl font-bold text-center mb-2">
              {featureName}
            </h2>

            {/* Description */}
            <p className="text-white/60 text-center text-sm mb-6">
              Get lifetime access to this report with a one-time payment.
            </p>

            <div className="mb-6 rounded-2xl border border-[#38bdf8]/25 bg-[#38bdf8]/10 px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7dd3fc]">One-time price</p>
              <p className="mt-1 text-3xl font-extrabold text-white">${featurePrice}</p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            {/* Purchase Button */}
            <Button
              onClick={handlePurchase}
              disabled={isProcessing}
              className="w-full h-14 text-lg font-semibold bg-[#38bdf8] text-[#03111f] hover:bg-[#7dd3fc]"
              size="lg"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                `Unlock for $${featurePrice}`
              )}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
