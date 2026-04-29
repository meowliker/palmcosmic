"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, Mail, LogOut, CreditCard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/lib/user-store";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";

type FeatureFlags = {
  palmReading?: boolean;
  birthChart?: boolean;
  compatibilityTest?: boolean;
  prediction2026?: boolean;
  soulmateSketch?: boolean;
  futurePartnerReport?: boolean;
};

type SubscriptionState = {
  primaryFlow: string | null;
  primaryReport: string | null;
  subscriptionStatus: string | null;
  accessStatus: string | null;
  bundlePurchased: string | null;
  unlockedFeatures: FeatureFlags;
};

const FLOW_LABELS: Record<string, string> = {
  future_prediction: "2026 Prediction",
  soulmate_sketch: "Soulmate Sketch",
  palm_reading: "Palm Reading",
  future_partner: "Future Partner",
  compatibility: "Compatibility",
};

const FLOW_BENEFITS: Record<string, { icon: string; text: string }[]> = {
  future_prediction: [
    { icon: "🪐", text: "2026 Future Prediction Report" },
  ],
  soulmate_sketch: [
    { icon: "🎨", text: "Soulmate Sketch Report" },
  ],
  palm_reading: [
    { icon: "🖐️", text: "Palm Reading Report" },
    { icon: "📊", text: "Birth Chart Report" },
  ],
  future_partner: [
    { icon: "💍", text: "Future Partner Report" },
  ],
  compatibility: [
    { icon: "💕", text: "Compatibility Report" },
  ],
};

const FEATURE_BENEFITS: { key: keyof FeatureFlags; icon: string; text: string }[] = [
  { key: "palmReading", icon: "🖐️", text: "Palm Reading Report" },
  { key: "birthChart", icon: "📊", text: "Birth Chart Report" },
  { key: "prediction2026", icon: "🪐", text: "2026 Future Prediction Report" },
  { key: "compatibilityTest", icon: "💕", text: "Compatibility Report" },
  { key: "soulmateSketch", icon: "🎨", text: "Soulmate Sketch Report" },
  { key: "futurePartnerReport", icon: "💍", text: "Future Partner Report" },
];

const BASE_APP_BENEFITS = [
  { icon: "🔮", text: "Daily Horoscope" },
  { icon: "💡", text: "Daily Tips" },
];

const ALL_REPORT_BENEFITS = [
  { icon: "🖐️", text: "Palm Reading Report" },
  { icon: "📊", text: "Birth Chart Report" },
  { icon: "🪐", text: "2026 Future Prediction Report" },
  { icon: "💕", text: "Compatibility Report" },
  { icon: "🎨", text: "Soulmate Sketch Report" },
  { icon: "💍", text: "Future Partner Report" },
];

function dedupeBenefits(benefits: { icon: string; text: string }[]) {
  const seen = new Set<string>();
  return benefits.filter((benefit) => {
    if (seen.has(benefit.text)) return false;
    seen.add(benefit.text);
    return true;
  });
}

function getSubscriptionBenefits(subscription: SubscriptionState) {
  const benefits: { icon: string; text: string }[] = [...BASE_APP_BENEFITS];

  if (subscription.subscriptionStatus === "active" || subscription.accessStatus === "subscription_active") {
    benefits.push(...ALL_REPORT_BENEFITS);
    benefits.push({ icon: "💬", text: "15 AI Chat Coins" });
    return dedupeBenefits(benefits);
  }

  if (subscription.primaryFlow && FLOW_BENEFITS[subscription.primaryFlow]) {
    benefits.push(...FLOW_BENEFITS[subscription.primaryFlow]);
  }

  for (const feature of FEATURE_BENEFITS) {
    if (subscription.unlockedFeatures?.[feature.key]) {
      benefits.push({ icon: feature.icon, text: feature.text });
    }
  }

  benefits.push({ icon: "💬", text: "15 AI Chat Coins for this flow" });

  return dedupeBenefits(benefits);
}

// Bundle benefits based on what was purchased
const getBundleBenefits = (bundleId: string | null, unlockedFeatures?: FeatureFlags) => {
  const benefits = [...BASE_APP_BENEFITS];

  benefits.push({ icon: "🖐️", text: "Palm Reading Report" });
  
  // Show based on what was purchased (check both bundleId and unlockedFeatures)
  if (bundleId === "palm-birth" || bundleId === "palm-birth-compat" || bundleId === "palm-birth-sketch" || unlockedFeatures?.birthChart) {
  benefits.push({ icon: "🌙", text: "Birth Chart Analysis" });
}
if (bundleId === "palm-birth-compat" || unlockedFeatures?.compatibilityTest) {
  benefits.push({ icon: "💕", text: "Compatibility Report" });
}
if (bundleId === "palm-birth-sketch" || unlockedFeatures?.soulmateSketch) {
  benefits.push({ icon: "🎨", text: "Soulmate Sketch" });
}
if (bundleId === "palm-birth-compat" || bundleId === "palm-birth-sketch" || unlockedFeatures?.futurePartnerReport) {
  benefits.push({ icon: "💍", text: "Future Partner Report" });
}

  benefits.push({ icon: "💬", text: "15 AI Chat Coins" });
  
  return benefits;
};

export default function SettingsPage() {
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isFlowB, setIsFlowB] = useState(false);
  const [bundleId, setBundleId] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState>({
    primaryFlow: null,
    primaryReport: null,
    subscriptionStatus: null,
    accessStatus: null,
    bundlePurchased: null,
    unlockedFeatures: {},
  });
  const { purchasedBundle, resetUserState, unlockedFeatures } = useUserStore();

  const userEmail = typeof window !== "undefined" 
    ? localStorage.getItem("astrorekha_email") || "user@example.com"
    : "user@example.com";

  useEffect(() => {
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
    pixelEvents.viewContent("Settings", "account");
    trackAnalyticsEvent("SettingsViewed", {
      route: "/settings",
      user_id: userId,
      email,
    });
    if (typeof window !== "undefined") {
      const flow = localStorage.getItem("astrorekha_onboarding_flow");
      const purchaseType = localStorage.getItem("astrorekha_purchase_type");
      const bundle = localStorage.getItem("astrorekha_bundle_id");
      setIsFlowB(flow === "flow-b" || purchaseType === "one-time");
      setBundleId(bundle);
    }
    loadSubscriptionState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubscriptionState = async () => {
    try {
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id");
      const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email");

      if (!userId && !email) return;

      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (email) params.set("email", email);
      const response = await fetch(`/api/user/hydrate?${params.toString()}`, { cache: "no-store" });
      const result = await response.json().catch(() => null);
      const data = response.ok && result?.success ? result.user : null;
      if (!data) return;

      setSubscription({
        primaryFlow: data.primaryFlow || null,
        primaryReport: data.primaryReport || null,
        subscriptionStatus: data.subscriptionStatus || null,
        accessStatus: data.accessStatus || null,
        bundlePurchased: data.purchasedBundle || null,
        unlockedFeatures: data.unlockedFeatures || {},
      });
      setBundleId(data.purchasedBundle || bundleId);
      setIsFlowB(data.purchaseType === "one-time" || isFlowB);
    } catch (error) {
      console.error("Failed to load subscription state:", error);
    }
  };

  const mergedUnlockedFeatures = {
    ...unlockedFeatures,
    ...subscription.unlockedFeatures,
  };
  const activeBundleId = subscription.bundlePurchased || bundleId || purchasedBundle;
  const hasSubscriptionFlow = Boolean(subscription.primaryFlow);
  const displayBenefits = hasSubscriptionFlow
    ? getSubscriptionBenefits({ ...subscription, unlockedFeatures: mergedUnlockedFeatures })
    : getBundleBenefits(activeBundleId, mergedUnlockedFeatures);
  const planTitle = hasSubscriptionFlow
    ? `Your ${FLOW_LABELS[subscription.primaryFlow || ""] || "PalmCosmic"} Access`
    : isFlowB
      ? "Your Purchase Benefits"
      : "Your Subscription Benefits";
  const planSubtitle = hasSubscriptionFlow
    ? subscription.subscriptionStatus === "active"
      ? "Monthly subscription active"
      : subscription.subscriptionStatus === "trialing"
        ? "Trial access active"
        : subscription.accessStatus?.replace(/_/g, " ") || "Subscription access"
    : activeBundleId
      ? "Unlocked from your selected bundle"
      : "Your current account benefits";

  const handleLogout = () => {
    trackAnalyticsEvent("SettingsAction", {
      route: "/settings",
      action: "logout_confirmed",
    });
    // Clear local storage
    if (typeof window !== "undefined") {
      localStorage.clear();
    }
    // Reset stores
    resetUserState();
    // Redirect to welcome screen
    router.push("/welcome");
  };

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/30 flex flex-col relative">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => {
                trackAnalyticsEvent("SettingsAction", {
                  route: "/settings",
                  action: "back_clicked",
                  destination: "/profile",
                });
                router.push("/profile");
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#b8c7da] transition-colors hover:bg-[#0b2338] hover:text-white"
              aria-label="Back to profile"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white text-xl font-semibold">Settings</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="px-4 py-5 space-y-4 pb-10">
            {/* Benefits Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#0b2338] rounded-lg p-5 border border-[#173653]"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">Access</p>
              <h2 className="mt-2 text-white text-xl font-bold">{planTitle}</h2>
              <p className="mt-1 mb-4 text-sm capitalize text-[#8fa3b8]">{planSubtitle}</p>
              <div className="space-y-3">
                {displayBenefits.map((benefit, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{benefit.icon}</span>
                      <span className="text-white">{benefit.text}</span>
                    </div>
                    <Check className="w-5 h-5 text-[#38bdf8]" />
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Links Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#0b2338] rounded-lg border border-[#173653] overflow-hidden"
            >
              <button
                onClick={() => {
                  trackAnalyticsEvent("SettingsAction", {
                    route: "/settings",
                    action: "legal_link_clicked",
                    link: "privacy_policy",
                  });
                  window.open("/Terms/privacy-policy.html", "_blank");
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-[#0d2a45] transition-colors border-b border-[#173653]"
              >
                <FileText className="w-5 h-5 text-[#8fa3b8]" />
                <span className="text-white flex-1 text-left">Privacy Policy</span>
                <ChevronRight className="w-5 h-5 text-[#8fa3b8]" />
              </button>
              <button
                onClick={() => {
                  trackAnalyticsEvent("SettingsAction", {
                    route: "/settings",
                    action: "legal_link_clicked",
                    link: "terms_of_service",
                  });
                  window.open("/Terms/terms-of-service.html", "_blank");
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-[#0d2a45] transition-colors border-b border-[#173653]"
              >
                <FileText className="w-5 h-5 text-[#8fa3b8]" />
                <span className="text-white flex-1 text-left">Terms of Service</span>
                <ChevronRight className="w-5 h-5 text-[#8fa3b8]" />
              </button>
              <button
                onClick={() => {
                  trackAnalyticsEvent("SettingsAction", {
                    route: "/settings",
                    action: "legal_link_clicked",
                    link: "contact_us",
                  });
                  window.open("/Terms/contact-us.html", "_blank");
                }}
                className="w-full p-4 flex items-center gap-3 hover:bg-[#0d2a45] transition-colors"
              >
                <Mail className="w-5 h-5 text-[#8fa3b8]" />
                <span className="text-white flex-1 text-left">Contact Us</span>
                <ChevronRight className="w-5 h-5 text-[#8fa3b8]" />
              </button>
            </motion.div>

            {/* Logout Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <button
                onClick={() => {
                  setShowLogoutConfirm(true);
                  trackAnalyticsEvent("SettingsAction", {
                    route: "/settings",
                    action: "logout_modal_opened",
                  });
                }}
                className="w-full bg-[#0b2338] rounded-lg p-4 border border-red-500/25 hover:bg-red-500/10 transition-colors"
              >
                <div className="flex flex-col items-center">
                  <span className="text-red-400 font-medium">Log out</span>
                  <span className="text-[#8fa3b8] text-sm">{userEmail}</span>
                </div>
              </button>
            </motion.div>

            {/* Manage Subscription Button - Only show for subscription users (Flow A) */}
            {!isFlowB && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <button
                  onClick={() => {
                    trackAnalyticsEvent("SettingsAction", {
                      route: "/settings",
                      action: "manage_subscription_clicked",
                      destination: "/manage-subscription",
                      subscription_status: subscription.subscriptionStatus,
                      access_status: subscription.accessStatus,
                    });
                    router.push("/manage-subscription");
                  }}
                  className="w-full bg-[#0b2338] rounded-lg p-4 border border-[#38bdf8]/30 hover:bg-[#0d2a45] transition-colors"
                >
                  <div className="flex items-center justify-center gap-2">
                    <CreditCard className="w-5 h-5 text-[#38bdf8]" />
                    <span className="text-white font-medium">Manage Subscription</span>
                  </div>
                </button>
              </motion.div>
            )}
          </div>
        </div>

        {/* Logout Confirmation Modal */}
        <AnimatePresence>
          {showLogoutConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowLogoutConfirm(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#0b2338] rounded-lg w-full max-w-sm p-6 border border-[#173653]"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                    <LogOut className="w-8 h-8 text-red-400" />
                  </div>
                </div>
                <h2 className="text-white text-xl font-bold text-center mb-2">
                  Log Out?
                </h2>
                <p className="text-white/60 text-center text-sm mb-6">
                  Are you sure you want to log out of your account?
                </p>
                <div className="space-y-3">
                  <Button
                    onClick={handleLogout}
                    className="w-full h-12 bg-red-500 hover:bg-red-600 text-white font-semibold"
                  >
                    Yes, Log Out
                  </Button>
                  <Button
                    onClick={() => setShowLogoutConfirm(false)}
                    variant="outline"
                    className="w-full h-12 border-[#173653] bg-transparent text-white hover:bg-[#082035]"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
