"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ChevronRight, Star, Sun, Moon, Sparkles, Loader2, Lock, MessageCircle, Lightbulb, CheckCircle, XCircle, Clock } from "lucide-react";
import Image from "next/image";
import { getZodiacSign, getZodiacSymbol, getZodiacColor } from "@/lib/astrology-api";
import { extractStoredSignName } from "@/lib/zodiac-utils";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useUserStore, UnlockedFeatures } from "@/lib/user-store";
import { UpsellPopup } from "@/components/UpsellPopup";
import { TrialStatusBanner } from "@/components/TrialStatusBanner";
import { UserAvatar, cacheUserInfo } from "@/components/UserAvatar";
import { BirthChartTimer } from "@/components/BirthChartTimer";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";

// Removed unused DailyData interface - these API calls were failing and not displayed in UI

interface DailyInsights {
  daily_tip: string;
  dos: string[];
  donts: string[];
  lucky_time: string;
  lucky_number: number;
  lucky_color: string;
  mood: string;
  sun_sign?: string;
  moon_sign?: string;
  rising_sign?: string;
  current_dasha?: string;
}

interface SoulmateSketchStatus {
  status?: "not_started" | "pending" | "generating" | "complete" | "failed";
  sketch_image_url?: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userZodiac, setUserZodiac] = useState({ sign: "Aries", symbol: "♈", color: "from-red-500 to-orange-500" });
  const [upsellPopup, setUpsellPopup] = useState<{ isOpen: boolean; feature: keyof UnlockedFeatures | null }>({
    isOpen: false,
    feature: null,
  });
  const [userName, setUserName] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [birthChartTimerActive, setBirthChartTimerActive] = useState(false);
  const [birthChartTimerStartedAt, setBirthChartTimerStartedAt] = useState<string | null>(null);
  const [birthChartTimerExpired, setBirthChartTimerExpired] = useState(false);
  const [dailyInsights, setDailyInsights] = useState<DailyInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [soulmateSketchStatus, setSoulmateSketchStatus] = useState<SoulmateSketchStatus | null>(null);

  // Get sun sign from onboarding store as fallback
  const { birthMonth: storeBirthMonth, birthDay: storeBirthDay, sunSign: storeSunSign } = useOnboardingStore();

  // Get unlocked features from user store
  const { unlockedFeatures, birthChartGenerating, birthChartReady, syncFromServer, unlockFeature } = useUserStore();

  useEffect(() => {
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
    pixelEvents.viewContent("Reports Dashboard", "dashboard");
    trackAnalyticsEvent("ReportsDashboardViewed", {
      route: "/reports",
      user_id: userId,
      email,
      palm_reading_unlocked: unlockedFeatures.palmReading,
      birth_chart_unlocked: unlockedFeatures.birthChart,
      prediction_2026_unlocked: unlockedFeatures.prediction2026,
      compatibility_unlocked: unlockedFeatures.compatibilityTest,
      soulmate_sketch_unlocked: unlockedFeatures.soulmateSketch,
      future_partner_unlocked: unlockedFeatures.futurePartnerReport,
    });
    loadUserZodiac();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchDailyInsightsV2();
  }, []);

  useEffect(() => {
    if (!unlockedFeatures.soulmateSketch) return;

    let stopped = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const pollSoulmateSketch = async () => {
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
      if (!userId) return;

      try {
        const response = await fetch(`/api/soulmate-sketch/status?userId=${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });
        const json = (await response.json().catch(() => ({}))) as SoulmateSketchStatus;
        if (!response.ok || stopped) return;

        setSoulmateSketchStatus(json);

        const isActive = json.status === "generating" || json.status === "pending";
        if (!isActive && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      } catch (pollError) {
        console.error("[reports] soulmate sketch status poll failed", pollError);
      }
    };

    pollSoulmateSketch();
    intervalId = setInterval(pollSoulmateSketch, 7000);

    return () => {
      stopped = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [unlockedFeatures.soulmateSketch]);

  const loadUserZodiac = async () => {
    try {
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id");

      if (userId) {
        await fetch("/api/user/refresh-entitlements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            email: localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "",
          }),
        }).catch((refreshError) => {
          console.error("Error refreshing entitlements:", refreshError);
        });

        const hydrateResponse = await fetch(`/api/user/hydrate?userId=${encodeURIComponent(userId)}`, {
          cache: "no-store",
        });
        const hydrateResult = await hydrateResponse.json().catch(() => null);
        const userData = hydrateResponse.ok && hydrateResult?.success ? hydrateResult.user : null;

        if (userData) {
          if (userData.name) setUserName(userData.name);
          if (userData.email) setUserEmail(userData.email);
          cacheUserInfo(userData.name, userData.email);

          syncFromServer({
            unlockedFeatures: userData.unlockedFeatures,
            palmReading: userData.palmReading,
            birthChart: userData.birthChart,
            compatibilityTest: userData.compatibilityTest,
            prediction2026: userData.prediction2026,
            coins: userData.coins,
            purchasedBundle: userData.purchasedBundle || null,
          });

          if (userData.birthChartTimerActive !== undefined) {
            setBirthChartTimerActive(userData.birthChartTimerActive);
          }
          if (userData.birthChartTimerStartedAt) {
            setBirthChartTimerStartedAt(userData.birthChartTimerStartedAt);
          }

          let sunSignName = extractStoredSignName(userData.sunSign);

          if (!sunSignName && userData.birthMonth && userData.birthDay) {
            sunSignName = getZodiacSign(Number(userData.birthMonth), Number(userData.birthDay));
          }

          if (sunSignName) {
            setUserZodiac({
              sign: sunSignName,
              symbol: getZodiacSymbol(sunSignName),
              color: getZodiacColor(sunSignName),
            });

            const storedEmail = localStorage.getItem("astrorekha_email");
            if (storedEmail && !userEmail) {
              setUserEmail(storedEmail);
            }

            return;
          }
        }
      }

      // Also try to get email from localStorage as fallback
      const storedEmail = localStorage.getItem("astrorekha_email");
      if (storedEmail && !userEmail) {
        setUserEmail(storedEmail);
      }
    } catch (error) {
      console.error("Error loading user zodiac:", error);
    }

    // Fallback to onboarding store sun sign or calculate from birth date
    // This only runs if Supabase fetch failed or user not found
    if (storeSunSign?.name) {
      setUserZodiac({
        sign: storeSunSign.name,
        symbol: getZodiacSymbol(storeSunSign.name),
        color: getZodiacColor(storeSunSign.name),
      });
    } else if (storeBirthMonth && storeBirthDay) {
      // Calculate sun sign from birth date
      const month = Number(storeBirthMonth);
      const day = Number(storeBirthDay);
      const sign = getZodiacSign(month, day);
      setUserZodiac({
        sign,
        symbol: getZodiacSymbol(sign),
        color: getZodiacColor(sign),
      });
    }
  };


  const fetchDailyInsightsV2 = async (options?: { force?: boolean }) => {
    try {
      setInsightsLoading(true);
      setInsightsError(null);
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id");
      const params = new URLSearchParams();
      if (userId) {
        params.set("userId", userId);
      } else if (userZodiac.sign) {
        params.set("sign", userZodiac.sign);
      }
      if (options?.force) {
        params.set("force", "true");
        trackAnalyticsEvent("ReportsDashboardAction", {
          action: "daily_insights_retry_clicked",
          route: "/reports",
          sign: userZodiac.sign,
          user_id: userId || "",
        });
      }

      if (!params.has("userId") && !params.has("sign")) {
        setDailyInsights(null);
        setInsightsError("We need your zodiac sign to load today's insights.");
        return;
      }

      const response = await fetch(`/api/horoscope/daily-insights-v2?${params.toString()}`);
      const result = await response.json().catch(() => null);
      if (response.ok && result?.success && result.data) {
        setDailyInsights(result.data);
        setInsightsError(null);
      } else {
        setDailyInsights(null);
        setInsightsError(result?.error || "Insights unavailable right now.");
      }
    } catch (error) {
      console.error("Failed to fetch daily insights:", error);
      setDailyInsights(null);
      setInsightsError("Insights unavailable right now.");
    } finally {
      setInsightsLoading(false);
    }
  };

  const trackReportAction = (
    action: string,
    params: {
      reportKey: string;
      feature: keyof UnlockedFeatures;
      reportName: string;
      destination?: string;
      unlocked: boolean;
    }
  ) => {
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";

    trackAnalyticsEvent("ReportsDashboardAction", {
      action,
      route: "/reports",
      report_key: params.reportKey,
      feature: params.feature,
      report_name: params.reportName,
      destination: params.destination,
      unlocked: params.unlocked,
      user_id: userId,
      email,
    });
  };

  const openReportOrUpsell = (params: {
    reportKey: string;
    feature: keyof UnlockedFeatures;
    reportName: string;
    destination: string;
    unlocked: boolean;
  }) => {
    trackReportAction("report_card_clicked", params);

    if (params.unlocked) {
      pixelEvents.viewContent(params.reportName, "report");
      trackReportAction("report_opened", params);
      router.push(params.destination);
      return;
    }

    trackReportAction("locked_report_selected", params);
    setUpsellPopup({ isOpen: true, feature: params.feature });
  };

  const handleInsightCardClick = (card: string) => {
    setExpandedCard(card);
    trackAnalyticsEvent("ReportsDashboardAction", {
      action: "daily_insight_card_opened",
      route: "/reports",
      card,
    });
  };

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      {/* Trial/Payment Status Banner */}
      <TrialStatusBanner />

      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/30 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => router.push("/profile")}
              className="hover:opacity-80 transition-opacity"
            >
              <UserAvatar name={userName} email={userEmail} size="md" />
            </button>
            <h1 className="text-white text-xl font-semibold">Reports</h1>
            <div className="w-10" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-5 space-y-6 pb-24">
            {/* Chat with Elysia */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] p-5 cursor-pointer transition-all hover:border-[#38bdf8]/60 hover:bg-[#0d2a45] group"
              onClick={() => {
                trackAnalyticsEvent("ReportsDashboardAction", {
                  action: "chat_card_clicked",
                  route: "/reports",
                });
                pixelEvents.contact();
                router.push("/chat");
              }}
            >
              {/* Animated background effect */}
              <div className="absolute inset-0 bg-[#38bdf8]/5 opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* Sparkle decorations */}
              <div className="absolute top-3 right-3 text-yellow-400 animate-pulse">
                <Sparkles className="w-4 h-4" />
              </div>

              <div className="relative flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  {/* Pulsing ring */}
                  <div className="absolute inset-0 rounded-full bg-[#38bdf8] animate-ping opacity-10" />
                  <div className="relative w-16 h-16 rounded-full bg-[#082035] flex items-center justify-center shadow-lg shadow-[#38bdf8]/15 overflow-hidden border border-[#38bdf8]/30">
                    <Image
                      src="/elysia.png"
                      alt="Elysia"
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                      priority
                    />
                  </div>
                  {/* Online indicator */}
                  <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-[#0A0E1A]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-xl mb-1">
                    Chat with Elysia
                  </h3>
                  <p className="text-[#b8c7da] text-sm">
                    Your personal cosmic guide & advisor
                  </p>
                </div>
                <ChevronRight className="w-6 h-6 text-[#38bdf8] group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>

            {/* Today's Cosmic Insights - 3 Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2 className="text-white font-semibold text-lg mb-3">Today&apos;s Cosmic Insights</h2>

              {insightsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                </div>
              ) : dailyInsights ? (
                <div className="grid grid-cols-3 gap-3">
                  {/* Today's Luck Card */}
                  <div
                    onClick={() => handleInsightCardClick("luck")}
                    className="bg-[#0b2338] rounded-lg p-4 border border-[#173653] cursor-pointer hover:border-[#38bdf8]/50 transition-all aspect-square flex flex-col items-center justify-center text-center relative overflow-hidden group"
                  >
                    <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-40 transition-opacity">
                      <Star className="w-8 h-8 text-yellow-400" />
                    </div>
                    <span className="text-3xl mb-2">🍀</span>
                    <p className="text-[#b8c7da] font-bold text-xs">Today&apos;s Luck</p>
                    <p className="text-[#38bdf8] text-2xl font-bold mt-1">{dailyInsights.lucky_number}</p>
                  </div>

                  {/* Do's & Don'ts Card */}
                  <div
                    onClick={() => handleInsightCardClick("dosdonts")}
                    className="bg-[#0b2338] rounded-lg p-4 border border-[#173653] cursor-pointer hover:border-[#38bdf8]/50 transition-all aspect-square flex flex-col items-center justify-center text-center relative overflow-hidden group"
                  >
                    <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-40 transition-opacity">
                      <CheckCircle className="w-8 h-8 text-emerald-400" />
                    </div>
                    <span className="text-3xl mb-2">✅</span>
                    <p className="text-[#b8c7da] font-bold text-xs">Do&apos;s &amp;</p>
                    <p className="text-[#b8c7da] font-bold text-xs">Don&apos;ts</p>
                  </div>

                  {/* Daily Tip Card */}
                  <div
                    onClick={() => handleInsightCardClick("tip")}
                    className="bg-[#0b2338] rounded-lg p-4 border border-[#173653] cursor-pointer hover:border-[#38bdf8]/50 transition-all aspect-square flex flex-col items-center justify-center text-center relative overflow-hidden group"
                  >
                    <div className="absolute top-2 right-2 opacity-20 group-hover:opacity-40 transition-opacity">
                      <Lightbulb className="w-8 h-8 text-purple-400" />
                    </div>
                    <span className="text-3xl mb-2">💡</span>
                    <p className="text-[#b8c7da] font-bold text-xs">Daily</p>
                    <p className="text-[#b8c7da] font-bold text-xs">Tip</p>
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-white/35 text-sm">
                    {insightsError || "Insights unavailable right now."}
                  </p>
                  <button
                    type="button"
                    onClick={() => fetchDailyInsightsV2({ force: true })}
                    disabled={insightsLoading}
                    className="mt-2 text-sm font-semibold text-[#38bdf8] underline-offset-4 transition-colors hover:text-[#7dd3fc] hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Retry
                  </button>
                </div>
              )}
            </motion.div>

            {/* Expanded Card Modal */}
            {expandedCard && dailyInsights && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-[#020b15]/80 p-6 backdrop-blur-sm"
                onClick={() => setExpandedCard(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="w-full max-w-sm overflow-hidden rounded-lg border border-[#38bdf8]/25 bg-[#061525] shadow-2xl shadow-black/40"
                  onClick={(e) => e.stopPropagation()}
                >
                  {expandedCard === "luck" && (
                    <div className="bg-[#061525] p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] text-3xl">🍀</span>
                        <h3 className="text-white text-xl font-bold">Today&apos;s Luck</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] p-4 text-center shadow-inner shadow-[#38bdf8]/5">
                          <p className="text-[#8fa3b8] text-xs mb-1">Lucky Number</p>
                          <p className="bg-gradient-to-b from-[#e0f7ff] to-[#38bdf8] bg-clip-text text-4xl font-extrabold text-transparent drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]">{dailyInsights.lucky_number}</p>
                        </div>
                        <div className="rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] p-4 text-center shadow-inner shadow-[#38bdf8]/5">
                          <p className="text-[#8fa3b8] text-xs mb-1">Lucky Color</p>
                          <p className="bg-gradient-to-b from-[#f0fbff] to-[#7dd3fc] bg-clip-text text-lg font-extrabold text-transparent drop-shadow-[0_0_12px_rgba(125,211,252,0.25)]">{dailyInsights.lucky_color}</p>
                        </div>
                        <div className="rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] p-4 text-center shadow-inner shadow-[#38bdf8]/5">
                          <p className="text-[#8fa3b8] text-xs mb-1">Lucky Time</p>
                          <p className="text-base font-extrabold leading-snug text-[#38bdf8] drop-shadow-[0_0_10px_rgba(56,189,248,0.3)]">{dailyInsights.lucky_time}</p>
                        </div>
                        <div className="rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] p-4 text-center shadow-inner shadow-[#38bdf8]/5">
                          <p className="text-[#8fa3b8] text-xs mb-1">Mood</p>
                          <p className="bg-gradient-to-b from-[#f0fbff] to-[#7dd3fc] bg-clip-text text-lg font-extrabold text-transparent drop-shadow-[0_0_12px_rgba(125,211,252,0.25)]">{dailyInsights.mood}</p>
                        </div>
                      </div>
                      <button onClick={() => setExpandedCard(null)} className="w-full mt-5 rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] py-3 text-sm font-semibold text-[#b8c7da] transition-colors hover:border-[#38bdf8]/60 hover:text-white">Close</button>
                    </div>
                  )}

                  {expandedCard === "dosdonts" && (
                    <div className="bg-[#061525] p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] text-3xl">✅</span>
                        <h3 className="text-white text-xl font-bold">Do&apos;s &amp; Don&apos;ts</h3>
                      </div>
                      <div className="space-y-4">
                        <div className="rounded-lg border border-[#173653] bg-[#0b2338] p-4">
                          <h4 className="text-[#38bdf8] font-bold text-sm mb-3 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Do&apos;s
                          </h4>
                          <ul className="space-y-2">
                            {dailyInsights.dos.map((item, idx) => (
                              <li key={idx} className="text-[#dce8f5] text-sm flex items-start gap-2">
                                <span className="text-[#38bdf8] mt-0.5">&#10003;</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-lg border border-[#173653] bg-[#0b2338] p-4">
                          <h4 className="text-[#fca5a5] font-bold text-sm mb-3 flex items-center gap-2">
                            <XCircle className="w-4 h-4" /> Don&apos;ts
                          </h4>
                          <ul className="space-y-2">
                            {dailyInsights.donts.map((item, idx) => (
                              <li key={idx} className="text-[#dce8f5] text-sm flex items-start gap-2">
                                <span className="text-[#fca5a5] mt-0.5">&#10007;</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <button onClick={() => setExpandedCard(null)} className="w-full mt-5 rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] py-3 text-sm font-semibold text-[#b8c7da] transition-colors hover:border-[#38bdf8]/60 hover:text-white">Close</button>
                    </div>
                  )}

                  {expandedCard === "tip" && (
                    <div className="bg-[#061525] p-6">
                      <div className="flex items-center gap-3 mb-5">
                        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] text-3xl">💡</span>
                        <h3 className="text-white text-xl font-bold">Daily Tip</h3>
                      </div>
                      <div className="relative overflow-hidden rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] p-5 shadow-inner shadow-[#38bdf8]/5">
                        <div className="absolute left-0 top-0 h-full w-1 bg-[#38bdf8]" />
                        <div className="mb-3 inline-flex items-center rounded-full border border-[#38bdf8]/25 bg-[#38bdf8]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#7dd3fc]">
                          Focus
                        </div>
                        <p className="text-xl font-semibold leading-relaxed text-[#e8f6ff] drop-shadow-[0_0_12px_rgba(56,189,248,0.12)]">
                          {dailyInsights.daily_tip}
                        </p>
                      </div>
                      <p className="text-[#8fa3b8] text-xs mt-3 text-center">
                        Updated daily for {dailyInsights.sun_sign || userZodiac.sign}
                      </p>
                      <button onClick={() => setExpandedCard(null)} className="w-full mt-5 rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] py-3 text-sm font-semibold text-[#b8c7da] transition-colors hover:border-[#38bdf8]/60 hover:text-white">Close</button>
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {/* Daily Horoscope Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="relative rounded-lg overflow-hidden cursor-pointer group border border-[#173653]"
              onClick={() => {
                trackAnalyticsEvent("ReportsDashboardAction", {
                  action: "horoscope_card_clicked",
                  route: "/reports",
                  sign: userZodiac.sign,
                });
                router.push("/horoscope");
              }}
            >
              {/* Gradient background */}
              <div className="absolute inset-0 bg-[#0b2338]" />
              <div className={`absolute inset-0 bg-gradient-to-br ${userZodiac.color} opacity-50 group-hover:opacity-60 transition-opacity`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

              {/* Decorative stars */}
              <div className="absolute top-3 right-4 opacity-20">
                <Star className="w-16 h-16 text-white" />
              </div>
              <div className="absolute top-6 right-16 opacity-10">
                <Sparkles className="w-8 h-8 text-white" />
              </div>

              <div className="relative p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${userZodiac.color} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <span className="text-white text-2xl">{userZodiac.symbol}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-0.5">Your Horoscope</p>
                    <h3 className="text-white font-bold text-lg">{userZodiac.sign}</h3>
                    <p className="text-white/50 text-xs mt-1">
                      {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-white/10 rounded-full px-3 py-1.5 backdrop-blur-sm">
                    <span className="text-white/70 text-xs font-medium">Read</span>
                    <ChevronRight className="w-3.5 h-3.5 text-white/50" />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  {["Daily", "Weekly", "Monthly"].map((label) => (
                    <span key={label} className="bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 text-white/60 text-[11px] font-medium">
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Reports from Advisors */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h2 className="text-white font-semibold text-xl mb-4">Reports from Advisors</h2>

              <div className="space-y-3">
                {/* Palm Reading Report */}
                <div
                  onClick={() =>
                    openReportOrUpsell({
                      reportKey: "palm_reading",
                      feature: "palmReading",
                      reportName: "Palm Reading Report",
                      destination: "/palm-reading",
                      unlocked: unlockedFeatures.palmReading,
                    })
                  }
                  className="bg-[#0b2338] rounded-lg border border-[#173653] p-3 cursor-pointer hover:border-[#38bdf8]/60 transition-colors relative"
                >
                  {!unlockedFeatures.palmReading && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#061525] flex items-center justify-center">
                      <Lock className="w-3 h-3 text-[#8fa3b8]" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#082035] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#173653]">
                      <span className="text-3xl">🖐️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold">Palm Reading Report</h3>
                      <p className="text-[#8fa3b8] text-xs mt-0.5">Discover your life path & destiny</p>
                      {!unlockedFeatures.palmReading && (
                        <span className="mt-2 inline-flex px-3 py-1 bg-[#38bdf8]/12 text-[#38bdf8] text-xs rounded-full">
                          Get Report
                        </span>
                      )}
                    </div>
                    <ChevronRight className="w-6 h-6 text-[#8fa3b8]" />
                  </div>
                </div>

                {/* Birth Chart Report */}
                <div
                  className={`bg-[#0b2338] border border-[#173653] transition-colors ${
                    birthChartTimerActive && !birthChartTimerExpired
                      ? "rounded-lg"
                      : "rounded-lg"
                  }`}
                >
                  <div
                    onClick={async () => {
                      // Don't allow click if timer is active and not expired
                      if (birthChartTimerActive && !birthChartTimerExpired) {
                        return;
                      }
                      if (unlockedFeatures.birthChart) {
                        trackReportAction("report_card_clicked", {
                          reportKey: "birth_chart",
                          feature: "birthChart",
                          reportName: "Birth Chart Report",
                          destination: "/birth-chart",
                          unlocked: true,
                        });
                        if (!birthChartGenerating) {
                          pixelEvents.viewContent("Birth Chart Report", "report");
                          trackReportAction("report_opened", {
                            reportKey: "birth_chart",
                            feature: "birthChart",
                            reportName: "Birth Chart Report",
                            destination: "/birth-chart",
                            unlocked: true,
                          });
                          // Deactivate timer when user opens the report (with delay so user doesn't see it disappear)
                          if (birthChartTimerActive) {
                            // Update Supabase to deactivate timer after a delay
                            setTimeout(async () => {
                              setBirthChartTimerActive(false);
                              const userId = localStorage.getItem("astrorekha_user_id");
                              if (userId) {
                                try {
                                  await fetch("/api/user/birth-chart-timer", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ userId, active: false }),
                                  });
                                } catch (err) {
                                  console.error("Failed to deactivate timer:", err);
                                }
                              }
                            }, 2500);
                          }
                          router.push("/birth-chart");
                        }
                      } else {
                        trackReportAction("locked_report_selected", {
                          reportKey: "birth_chart",
                          feature: "birthChart",
                          reportName: "Birth Chart Report",
                          destination: "/birth-chart",
                          unlocked: false,
                        });
                        setUpsellPopup({ isOpen: true, feature: "birthChart" });
                      }
                    }}
                    className={`p-3 relative ${
                      birthChartTimerActive && !birthChartTimerExpired
                        ? "cursor-not-allowed opacity-70"
                        : "cursor-pointer hover:bg-[#0d2a45]"
                    }`}
                  >
                    {!unlockedFeatures.birthChart && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#061525] flex items-center justify-center">
                        <Lock className="w-3 h-3 text-[#8fa3b8]" />
                      </div>
                    )}
                    {birthChartGenerating && (
                      <div className="absolute top-2 right-2">
                        <Loader2 className="w-5 h-5 text-[#38bdf8] animate-spin" />
                      </div>
                    )}
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-lg bg-[#082035] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#173653]">
                        <span className="text-3xl">📊</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold">Birth Chart Report</h3>
                        <p className="text-[#8fa3b8] text-xs mt-0.5">Your complete astrological blueprint</p>
                        {!unlockedFeatures.birthChart && (
                          <button className="mt-1 px-3 py-1 bg-[#38bdf8]/12 text-[#38bdf8] text-xs rounded-full">
                            Get Report
                          </button>
                        )}
                        {birthChartGenerating && (
                          <p className="text-[#8fa3b8] text-xs mt-1">Generating your chart...</p>
                        )}
                      </div>
                      <ChevronRight className="w-6 h-6 text-[#8fa3b8]" />
                    </div>
                  </div>
                  {/* Timer Bar */}
                  {unlockedFeatures.birthChart && birthChartTimerActive && (
                    <div className="bg-[#082035] px-4 py-2.5 flex items-center justify-center gap-2 border-t border-[#173653]">
                      <BirthChartTimer
                        startedAt={birthChartTimerStartedAt}
                        isActive={birthChartTimerActive}
                        onExpire={() => setBirthChartTimerExpired(true)}
                      />
                      {!birthChartTimerExpired && (
                        <span className="text-amber-400/80 text-xs">until your report is ready</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Compatibility Test */}
                <div
                  onClick={() =>
                    openReportOrUpsell({
                      reportKey: "compatibility",
                      feature: "compatibilityTest",
                      reportName: "Compatibility Test",
                      destination: "/compatibility",
                      unlocked: unlockedFeatures.compatibilityTest,
                    })
                  }
                  className="bg-[#0b2338] rounded-lg border border-[#173653] p-3 cursor-pointer hover:border-[#38bdf8]/60 transition-colors relative"
                >
                  {!unlockedFeatures.compatibilityTest && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#061525] flex items-center justify-center">
                      <Lock className="w-3 h-3 text-[#8fa3b8]" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#082035] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#173653]">
                      <span className="text-3xl">💕</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold">Compatibility Test</h3>
                      <p className="text-[#8fa3b8] text-xs mt-0.5">Find your perfect cosmic match</p>
                      {!unlockedFeatures.compatibilityTest && (
                        <button className="mt-1 px-3 py-1 bg-[#38bdf8]/12 text-[#38bdf8] text-xs rounded-full">
                          Get Report
                        </button>
                      )}
                    </div>
                    <ChevronRight className="w-6 h-6 text-[#8fa3b8]" />
                  </div>
                </div>

                {/* Soulmate Sketch */}
                <div
                  onClick={() =>
                    openReportOrUpsell({
                      reportKey: "soulmate_sketch",
                      feature: "soulmateSketch",
                      reportName: "Soulmate Sketch",
                      destination: "/soulmate-sketch",
                      unlocked: unlockedFeatures.soulmateSketch,
                    })
                  }
                  className="bg-[#0b2338] rounded-lg border border-[#173653] p-3 cursor-pointer hover:border-[#38bdf8]/60 transition-colors relative"
                >
                  {!unlockedFeatures.soulmateSketch && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#061525] flex items-center justify-center">
                      <Lock className="w-3 h-3 text-[#8fa3b8]" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#082035] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#173653]">
                      <span className="text-3xl">🎨</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold">Soulmate Sketch</h3>
                      <p className="text-[#8fa3b8] text-xs mt-0.5">
                        {soulmateSketchStatus?.status === "generating" || soulmateSketchStatus?.status === "pending"
                          ? "Generating your portrait..."
                          : soulmateSketchStatus?.status === "complete" || soulmateSketchStatus?.sketch_image_url
                            ? "Your portrait is ready"
                            : "AI portrait + relationship timeline highlights"}
                      </p>
                      {!unlockedFeatures.soulmateSketch && (
                        <button className="mt-1 px-3 py-1 bg-[#38bdf8]/12 text-[#38bdf8] text-xs rounded-full">
                          Get Report
                        </button>
                      )}
                    </div>
                    {soulmateSketchStatus?.status === "generating" || soulmateSketchStatus?.status === "pending" ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#38bdf8]" />
                    ) : (
                      <ChevronRight className="w-6 h-6 text-[#8fa3b8]" />
                    )}
                  </div>
                </div>

                {/* Future Partner Report */}
                <div
                  onClick={() =>
                    openReportOrUpsell({
                      reportKey: "future_partner",
                      feature: "futurePartnerReport",
                      reportName: "Future Partner Report",
                      destination: "/future-partner",
                      unlocked: unlockedFeatures.futurePartnerReport,
                    })
                  }
                  className="bg-[#0b2338] rounded-lg border border-[#173653] p-3 cursor-pointer hover:border-[#38bdf8]/60 transition-colors relative"
                >
                  {!unlockedFeatures.futurePartnerReport && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#061525] flex items-center justify-center">
                      <Lock className="w-3 h-3 text-[#8fa3b8]" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#082035] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#173653]">
                      <span className="text-3xl">💍</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold">Future Partner Report</h3>
                      <p className="text-[#8fa3b8] text-xs mt-0.5">Name, marriage year, age and marriage compatibility</p>
                      {!unlockedFeatures.futurePartnerReport && (
                        <button className="mt-1 px-3 py-1 bg-[#38bdf8]/12 text-[#38bdf8] text-xs rounded-full">
                          Get Report
                        </button>
                      )}
                    </div>
                    <ChevronRight className="w-6 h-6 text-[#8fa3b8]" />
                  </div>
                </div>

                {/* Prediction 2026 Report */}
                <div
                  onClick={() =>
                    openReportOrUpsell({
                      reportKey: "prediction_2026",
                      feature: "prediction2026",
                      reportName: "Prediction 2026 Report",
                      destination: "/prediction-2026",
                      unlocked: unlockedFeatures.prediction2026,
                    })
                  }
                  className="bg-[#0b2338] rounded-lg border border-[#173653] p-3 cursor-pointer hover:border-[#38bdf8]/60 transition-colors relative"
                >
                  {!unlockedFeatures.prediction2026 && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#061525] flex items-center justify-center">
                      <Lock className="w-3 h-3 text-[#8fa3b8]" />
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg bg-[#082035] flex items-center justify-center flex-shrink-0 overflow-hidden border border-[#173653]">
                      <span className="text-3xl">🔮</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-white font-semibold">Prediction 2026 Report</h3>
                      <p className="text-[#8fa3b8] text-xs mt-0.5">What the stars hold for your future</p>
                      {!unlockedFeatures.prediction2026 && (
                        <button className="mt-1 px-3 py-1 bg-[#38bdf8]/12 text-[#38bdf8] text-xs rounded-full">
                          Get Report
                        </button>
                      )}
                    </div>
                    <ChevronRight className="w-6 h-6 text-[#8fa3b8]" />
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        </div>

        {/* Upsell Popup */}
        {upsellPopup.feature && (
          <UpsellPopup
            isOpen={upsellPopup.isOpen}
            onClose={() => {
              if (upsellPopup.feature) {
                trackAnalyticsEvent("ReportsDashboardAction", {
                  action: "upsell_modal_closed",
                  route: "/reports",
                  feature: upsellPopup.feature,
                });
              }
              setUpsellPopup({ isOpen: false, feature: null });
            }}
            feature={upsellPopup.feature}
            onPurchase={() => {
              trackAnalyticsEvent("ReportsDashboardAction", {
                action: "upsell_purchase_completed",
                route: "/reports",
                feature: upsellPopup.feature,
              });
              if (upsellPopup.feature === "soulmateSketch") {
                unlockFeature("soulmateSketch");
                router.push("/soulmate-sketch");
                return;
              }
              if (upsellPopup.feature === "futurePartnerReport") {
                unlockFeature("futurePartnerReport");
                router.push("/future-partner");
                return;
              }
              window.location.reload();
            }}
          />
        )}
      </div>
    </div>
  );
}
