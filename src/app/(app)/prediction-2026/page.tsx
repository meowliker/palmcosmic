"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2, Star, Heart, Briefcase, Activity, Sparkles } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { extractStoredSignName } from "@/lib/zodiac-utils";
import ReportDisclaimer from "@/components/ReportDisclaimer";
import predictions2026Data from "../../../../data/predictions-2026.json";

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const MONTH_ICONS: Record<string, string> = {
  january: "❄️",
  february: "💝",
  march: "🌸",
  april: "🌷",
  may: "🌺",
  june: "☀️",
  july: "🌊",
  august: "🌻",
  september: "🍂",
  october: "🎃",
  november: "🍁",
  december: "🎄",
};

const VALID_SIGN_KEYS = new Set(Object.keys(predictions2026Data));

function normalizeSignKey(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === "prediction_2026") return null;
    return VALID_SIGN_KEYS.has(normalized) ? normalized : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeSignKey(record.name || record.sign || record.id);
  }
  return null;
}

function displaySignName(signKey: string) {
  return signKey.slice(0, 1).toUpperCase() + signKey.slice(1);
}

export default function Prediction2026Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [prediction, setPrediction] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [zodiacSign, setZodiacSign] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Get sun sign from onboarding store as fallback
  const { sunSign: storeSunSign } = useOnboardingStore();

  useEffect(() => {
    initializeReport();
  }, []);

  const checkReportAccess = async () => {
    try {
      const userId = localStorage.getItem("astrorekha_user_id") || "";
      const email =
        localStorage.getItem("palmcosmic_email") ||
        localStorage.getItem("astrorekha_email") ||
        "";

      if (!userId && !email) {
        router.replace("/onboarding/future-prediction/paywall");
        return false;
      }

      const params = new URLSearchParams({ reportKey: "prediction_2026" });
      if (userId) params.set("userId", userId);
      if (email) params.set("email", email);

      const response = await fetch(`/api/user/report-access?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.canAccess) {
        router.replace("/onboarding/future-prediction/paywall");
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to check 2026 prediction access:", error);
      router.replace("/onboarding/future-prediction/paywall");
      return false;
    } finally {
    }
  };

  const loadUserSunSign = async () => {
    try {
      const userId = localStorage.getItem("astrorekha_user_id");
      if (userId) {
        const response = await fetch(`/api/user/hydrate?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const result = await response.json().catch(() => null);
        const dbUser = response.ok && result?.success ? result.user : null;

        const reportSignKey =
          normalizeSignKey(dbUser?.prediction2026ReportId) ||
          normalizeSignKey(dbUser?.zodiacSign) ||
          normalizeSignKey(dbUser?.sunSign);

        if (reportSignKey) {
          return displaySignName(reportSignKey);
        }

        if (dbUser?.sunSign) {
          const signName = extractStoredSignName(dbUser.sunSign);
          const signKey = normalizeSignKey(signName);
          if (signKey) {
            return displaySignName(signKey);
          }
        }
      }
      // Fallback to onboarding store
      if (storeSunSign?.name) {
        return storeSunSign.name;
      }
    } catch (err) {
      console.error("Failed to load sun sign:", err);
      if (storeSunSign?.name) {
        return storeSunSign.name;
      }
    }
    return null;
  };

  const initializeReport = async () => {
    setCheckingAccess(true);
    setLoading(true);
    try {
      const canAccess = await checkReportAccess();
      if (!canAccess) return;
      const sign = await loadUserSunSign();
      if (!sign) {
        setError("We need your zodiac sign to load your 2026 prediction.");
        return;
      }
      setZodiacSign(sign);
      await loadPrediction(sign);
    } finally {
      setCheckingAccess(false);
      setLoading(false);
    }
  };

  const loadPrediction = async (sign = zodiacSign) => {
    if (!sign) return;
    setLoading(true);
    setError(null);

    try {
      const signKey = sign.toLowerCase() as keyof typeof predictions2026Data;
      const response = await fetch(`/api/prediction-2026/global?sign=${encodeURIComponent(signKey)}`, { cache: "no-store" });
      const supabasePrediction = await response.json().catch(() => null);

      if (response.ok && supabasePrediction?.prediction) {
        setPrediction(supabasePrediction.prediction);
      } else {
        const predictionData = predictions2026Data[signKey];
        if (predictionData) {
          setPrediction(predictionData.prediction);
        } else {
          setError("Prediction not available for your zodiac sign.");
        }
      }
    } catch (err) {
      console.error("Failed to load prediction:", err);
      setError("Failed to load prediction. Please try again.");
    } finally {
      if (!checkingAccess) setLoading(false);
    }
  };

  const toggleMonth = (month: string) => {
    setExpandedMonth(expandedMonth === month ? null : month);
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 8.5) return "text-green-400";
    if (rating >= 7) return "text-yellow-400";
    return "text-orange-400";
  };

  if (checkingAccess || loading) {
    return (
      <div className="min-h-screen bg-[#061525] flex items-center justify-center">
        <div className="w-full max-w-md h-screen bg-[#061525] flex items-center justify-center">
          <div className="text-center px-8">
            <Loader2 className="w-16 h-16 text-[#38bdf8] animate-spin mx-auto mb-6" />
            <h2 className="text-white text-xl font-bold mb-2">
              {checkingAccess ? "Checking your access..." : "Consulting the Stars..."}
            </h2>
            <p className="text-white/60 text-sm">
              {checkingAccess
                ? "Restoring your 2026 prediction unlock."
                : `Loading your personalized 2026 predictions${zodiacSign ? ` for ${zodiacSign}` : ""}.`}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#061525] flex items-center justify-center">
        <div className="w-full max-w-md h-screen bg-[#061525] flex flex-col">
          <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
            <div className="flex items-center gap-4 px-4 py-3">
              <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-white text-xl font-semibold flex-1 text-center pr-10">2026 Predictions</h1>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center">
              <p className="text-red-400 mb-4">{error}</p>
              <button
                onClick={() => loadPrediction()}
                className="px-6 py-3 bg-[#38bdf8] rounded-xl text-black font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
          <div className="flex items-center justify-between px-4 py-3">
            <button onClick={() => router.back()} className="w-10 h-10 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white text-xl font-semibold">2026 Predictions</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 space-y-4 pb-24">
            {/* Year Overview */}
            {prediction?.yearOverview && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-[#0b2338] to-[#061525] rounded-2xl p-5 border border-[#38bdf8]/30"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#38bdf8] to-[#0ea5e9] flex items-center justify-center">
                    <Sparkles className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-xl">{prediction.yearOverview.title}</h2>
                    <p className="text-[#38bdf8] text-sm">{zodiacSign} • 2026</p>
                  </div>
                </div>

                <p className="text-white/80 text-base leading-relaxed mb-4">
                  {prediction.yearOverview.summary}
                </p>

                {/* Key Themes */}
                {prediction.yearOverview.keyThemes && (
                  <div className="mb-4">
                    <h4 className="text-white/60 text-xs uppercase tracking-wider mb-2">Key Themes</h4>
                    <div className="flex flex-wrap gap-2">
                      {prediction.yearOverview.keyThemes.map((theme: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-white/10 rounded-full text-white text-sm"
                        >
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lucky Numbers & Colors */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/20 rounded-xl p-3">
                    <p className="text-white/40 text-xs mb-1">Lucky Numbers</p>
                    <p className="text-white font-semibold">
                      {prediction.yearOverview.luckyNumbers?.join(", ")}
                    </p>
                  </div>
                  <div className="bg-black/20 rounded-xl p-3">
                    <p className="text-white/40 text-xs mb-1">Lucky Colors</p>
                    <p className="text-white font-semibold">
                      {prediction.yearOverview.luckyColors?.join(", ")}
                    </p>
                  </div>
                </div>

                {/* Overall Rating */}
                {prediction.yearOverview.overallRating && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-bold text-lg">
                      {prediction.yearOverview.overallRating}/10
                    </span>
                    <span className="text-white/40 text-sm">Year Rating</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Monthly Predictions */}
            <div>
              <h3 className="text-white font-semibold text-lg mb-3">Monthly Breakdown</h3>
              <div className="space-y-2">
                {MONTHS.map((month, idx) => {
                  const monthData = prediction?.months?.[month];
                  if (!monthData) return null;

                  const isExpanded = expandedMonth === month;

                  return (
                    <motion.div
                      key={month}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-[#1A1F2E] rounded-2xl border border-white/10 overflow-hidden"
                    >
                      {/* Month Header */}
                      <button
                        onClick={() => toggleMonth(month)}
                        className="w-full p-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{MONTH_ICONS[month]}</span>
                          <div className="text-left">
                            <h4 className="text-white font-semibold capitalize">{monthData.title || `${month} 2026`}</h4>
                            {!isExpanded && (
                              <p className="text-white/50 text-xs line-clamp-1">{monthData.overview}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {monthData.rating && (
                            <span className={`font-bold ${getRatingColor(monthData.rating)}`}>
                              {monthData.rating}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-white/40" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-white/40" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-4">
                              {/* Overview */}
                              <p className="text-white/70 text-sm">{monthData.overview}</p>

                              {/* Love */}
                              {monthData.love && (
                                <div className="bg-pink-500/10 rounded-xl p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Heart className="w-4 h-4 text-pink-400" />
                                    <span className="text-pink-400 font-semibold text-sm">Love & Relationships</span>
                                  </div>
                                  <p className="text-white/70 text-sm">{monthData.love}</p>
                                </div>
                              )}

                              {/* Career */}
                              {monthData.career && (
                                <div className="bg-blue-500/10 rounded-xl p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Briefcase className="w-4 h-4 text-blue-400" />
                                    <span className="text-blue-400 font-semibold text-sm">Career & Finance</span>
                                  </div>
                                  <p className="text-white/70 text-sm">{monthData.career}</p>
                                </div>
                              )}

                              {/* Health */}
                              {monthData.health && (
                                <div className="bg-green-500/10 rounded-xl p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Activity className="w-4 h-4 text-green-400" />
                                    <span className="text-green-400 font-semibold text-sm">Health & Wellness</span>
                                  </div>
                                  <p className="text-white/70 text-sm">{monthData.health}</p>
                                </div>
                              )}

                              {/* Lucky Days */}
                              {monthData.luckyDays && monthData.luckyDays.length > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className="text-white/40 text-xs">Lucky Days:</span>
                                  <div className="flex gap-1">
                                    {monthData.luckyDays.map((day: number, i: number) => (
                                      <span
                                        key={i}
                                        className="w-7 h-7 rounded-full bg-[#38bdf8]/15 text-[#38bdf8] text-xs font-bold flex items-center justify-center"
                                      >
                                        {day}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <ReportDisclaimer />
          </div>
        </div>
      </div>
    </div>
  );
}
