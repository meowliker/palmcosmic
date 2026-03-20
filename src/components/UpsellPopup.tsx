"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore, featureNames, featurePrices, UnlockedFeatures } from "@/lib/user-store";
import { generateUserId } from "@/lib/user-profile";
import { startStripeCheckout } from "@/lib/stripe-checkout";

// Map feature keys to report IDs for checkout
const featureToReportId: Record<keyof UnlockedFeatures, string> = {
  palmReading: "report-palm",
  prediction2026: "report-2026",
  birthChart: "report-birth-chart",
  compatibilityTest: "report-compatibility",
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
        userId: generateUserId(),
        email: localStorage.getItem("astrorekha_email") || "",
        firstName: localStorage.getItem("astrorekha_name") || "Customer",
        successPath: window.location.pathname,
        cancelPath: window.location.pathname,
      });
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(err?.message || "Something went wrong. Please try again.");
      setIsProcessing(false);
    }
  };

  const featureName = featureNames[feature];
  const price = featurePrices[feature];

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
            className="bg-gradient-to-b from-[#1A1F2E] to-[#0A0E1A] rounded-3xl w-full max-w-sm p-6 border border-white/10"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>

            {/* Icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/30 flex items-center justify-center">
                <Lock className="w-10 h-10 text-primary" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-white text-xl font-bold text-center mb-2">Unlock {featureName}</h2>

            {/* Description */}
            <p className="text-white/60 text-center text-sm mb-6">
              Get your personalized {featureName.toLowerCase()} and discover deeper insights about your cosmic journey.
            </p>

            {/* Price */}
            <div className="bg-white/5 rounded-2xl p-4 mb-6 border border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="text-white font-medium">{featureName}</span>
                </div>
                <div className="text-right">
                  <span className="text-white text-xl font-bold">${(price / 100).toFixed(2)}</span>
                </div>
              </div>
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
              className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
              size="lg"
            >
              {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : `Get ${featureName}`}
            </Button>

            {/* Cancel Link */}
            <button
              onClick={onClose}
              className="w-full mt-3 text-white/50 text-sm hover:text-white/70 transition-colors"
            >
              Maybe later
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
