"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Sun, Moon, RefreshCw, Star, AlertTriangle, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReportCTA from "@/components/ReportCTA";
import { LocationInput } from "@/components/onboarding/LocationInput";
import { useOnboardingStore } from "@/lib/onboarding-store";

const MONTH_MAP: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
};
const MONTH_NAMES = Object.keys(MONTH_MAP);
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));
const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function getMonthNumber(month: string): number {
  const trimmed = String(month || "").trim();
  const direct = MONTH_MAP[trimmed];
  if (direct) return direct;

  const numeric = Number(trimmed);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric;
  }

  return 1;
}

function getDisplayMonth(month: string): string {
  const monthNumber = getMonthNumber(month);
  return MONTH_NAMES[monthNumber - 1] || String(month || "January");
}

function hasRenderableChartData(data: any): boolean {
  if (!data) return false;

  const hasMainChart = typeof data.chart?.output === "string" && data.chart.output.trim().length > 0;
  const hasNavamsa = typeof data.navamsaChart?.output === "string" && data.navamsaChart.output.trim().length > 0;
  const hasKundli = !!data.kundli;

  return hasMainChart || hasNavamsa || hasKundli;
}

function getAscendantLagna(data: any): string {
  if (!data) return "";
  const fromPlanetPosition = Array.isArray(data?.planet_positions)
    ? data.planet_positions.find((p: any) => String(p?.name || "").toLowerCase() === "ascendant")?.rasi?.name
    : "";
  return (
    fromPlanetPosition ||
    data?.planets?.Ascendant?.zodiac_sign ||
    data?.kundli?.nakshatra_details?.zodiac?.name ||
    ""
  );
}

export default function BirthChartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any>(null);
  const chartType = "vedic"; // Only Vedic charts supported
  const [error, setError] = useState<string | null>(null);
  const [showMissingDataForm, setShowMissingDataForm] = useState(false);
  const [userDataLoaded, setUserDataLoaded] = useState(false);
  
  // Local state for birth data (loaded from Supabase or onboarding store)
  const [birthMonth, setBirthMonthState] = useState<string>("");
  const [birthDay, setBirthDayState] = useState<string>("");
  const [birthYear, setBirthYearState] = useState<string>("");
  const [birthHour, setBirthHourState] = useState<string>("12");
  const [birthMinute, setBirthMinuteState] = useState<string>("00");
  const [birthPeriod, setBirthPeriodState] = useState<string>("PM");
  const [birthPlace, setBirthPlaceState] = useState<string>("");
  const [knowsBirthTime, setKnowsBirthTimeState] = useState<boolean>(true);
  const [refreshAvailableAt, setRefreshAvailableAt] = useState<number | null>(null);
  const [refreshNow, setRefreshNow] = useState(() => Date.now());
  
  const { 
    birthMonth: storeBirthMonth, birthDay: storeBirthDay, birthYear: storeBirthYear, 
    birthHour: storeBirthHour, birthMinute: storeBirthMinute, birthPeriod: storeBirthPeriod, 
    birthPlace: storeBirthPlace, knowsBirthTime: storeKnowsBirthTime,
    setBirthDate, setBirthTime, setBirthPlace, setKnowsBirthTime
  } = useOnboardingStore();
  
  const isMissingRequiredData = !birthMonth || !birthDay || !birthYear;
  const needsBirthTime = !knowsBirthTime;
  const ascendantLagna = getAscendantLagna(chartData);

  const getBirthDate = () => {
    const month = getMonthNumber(birthMonth);
    const day = parseInt(birthDay) || 1;
    const year = parseInt(birthYear) || 2000;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const getBirthTime = () => {
    if (!knowsBirthTime) return "12:00";
    let hour = parseInt(birthHour) || 12;
    const minute = birthMinute || "00";
    if (birthPeriod === "PM" && hour !== 12) hour += 12;
    if (birthPeriod === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  };

  const getUserChartId = () => {
    const birthDate = getBirthDate();
    const birthTime = getBirthTime();
    return `chart_${birthDate}_${birthTime}_${birthPlace || 'unknown'}`.replace(/[^a-zA-Z0-9_]/g, '_');
  };

  const getStoredUserId = () =>
    localStorage.getItem("astrorekha_user_id")?.trim() ||
    localStorage.getItem("palmcosmic_user_id")?.trim() ||
    localStorage.getItem("astrorekha_anon_id")?.trim() ||
    localStorage.getItem("palmcosmic_anon_id")?.trim() ||
    "";

  const getRefreshCooldownKey = () => {
    const userId = getStoredUserId() || "anonymous";
    return `palmcosmic_birth_chart_refresh_available_at_${userId}`;
  };

  const refreshRemainingMs = Math.max(0, (refreshAvailableAt || 0) - refreshNow);
  const canRefreshChart = refreshRemainingMs === 0 && !loading;

  const formatRefreshWait = (milliseconds: number) => {
    const totalMinutes = Math.ceil(milliseconds / (60 * 1000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours <= 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  const linkBirthChartToCurrentUser = async (birthChartId: string) => {
    const userId = getStoredUserId();
    if (!userId || !birthChartId) return;

    try {
      await fetch("/api/birth-chart/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "link", userId, cacheKey: birthChartId }),
      });
    } catch (error) {
      console.error("Failed to link birth chart to user:", error);
    }
  };

  // Load user data from Supabase first, then fallback to onboarding store
  useEffect(() => {
    loadUserBirthData();
  }, []);

  const loadUserBirthData = async () => {
    try {
      const userId = getStoredUserId();
      if (userId) {
        const response = await fetch(`/api/birth-chart/cache?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const result = await response.json().catch(() => null);
        const profileData = response.ok && result?.success ? result.profile || result.user : null;

        if (profileData && profileData.birth_month && profileData.birth_day && profileData.birth_year) {
          setBirthMonthState(String(profileData.birth_month));
          setBirthDayState(String(profileData.birth_day));
          setBirthYearState(String(profileData.birth_year));
          setBirthHourState(profileData.birth_hour || "12");
          setBirthMinuteState(profileData.birth_minute || "00");
          setBirthPeriodState(profileData.birth_period || "PM");
          setBirthPlaceState(profileData.birth_place || "");
          setKnowsBirthTimeState(profileData.knows_birth_time ?? true);
          setUserDataLoaded(true);
          return;
        }

        // Legacy fallback for environments where birth fields still exist in users
        const dbUser = response.ok && result?.success ? result.user : null;

        if (dbUser && dbUser.birth_month && dbUser.birth_day && dbUser.birth_year) {
          setBirthMonthState(String(dbUser.birth_month));
          setBirthDayState(String(dbUser.birth_day));
          setBirthYearState(String(dbUser.birth_year));
          setBirthHourState(dbUser.birth_hour || "12");
          setBirthMinuteState(dbUser.birth_minute || "00");
          setBirthPeriodState(dbUser.birth_period || "PM");
          setBirthPlaceState(dbUser.birth_place || "");
          setKnowsBirthTimeState(true);
          setUserDataLoaded(true);
          return;
        }
      }
      // Fallback to onboarding store
      setBirthMonthState(storeBirthMonth);
      setBirthDayState(storeBirthDay);
      setBirthYearState(storeBirthYear);
      setBirthHourState(storeBirthHour || "12");
      setBirthMinuteState(storeBirthMinute || "00");
      setBirthPeriodState(storeBirthPeriod || "PM");
      setBirthPlaceState(storeBirthPlace || "");
      setKnowsBirthTimeState(storeKnowsBirthTime);
      setUserDataLoaded(true);
    } catch (err) {
      console.error("Failed to load birth data:", err);
      // Fallback to onboarding store
      setBirthMonthState(storeBirthMonth);
      setBirthDayState(storeBirthDay);
      setBirthYearState(storeBirthYear);
      setUserDataLoaded(true);
    }
  };

  useEffect(() => {
    if (!userDataLoaded) return;
    if (isMissingRequiredData || needsBirthTime) {
      setShowMissingDataForm(true);
      setLoading(false);
      return;
    }
    loadOrGenerateChart();
  }, [userDataLoaded, isMissingRequiredData, needsBirthTime]);

  useEffect(() => {
    if (!userDataLoaded) return;

    const storedAvailableAt = Number(localStorage.getItem(getRefreshCooldownKey()) || 0);
    if (Number.isFinite(storedAvailableAt) && storedAvailableAt > Date.now()) {
      setRefreshAvailableAt(storedAvailableAt);
    }

    const interval = window.setInterval(() => setRefreshNow(Date.now()), 30 * 1000);
    return () => window.clearInterval(interval);
  }, [userDataLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveBirthTimeAndContinue = async () => {
    setBirthTime(birthHour, birthMinute, birthPeriod as "AM" | "PM");
    setKnowsBirthTime(true);
    setKnowsBirthTimeState(true);

    const userId = getStoredUserId();
    if (userId) {
      await fetch("/api/birth-chart/cache", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "birth_profile",
          userId,
          birthMonth,
          birthDay,
          birthYear,
          birthHour,
          birthMinute,
          birthPeriod,
          birthPlace,
          knowsBirthTime: true,
        }),
      });
    }

    setShowMissingDataForm(false);
    setLoading(true);
  };

  const handleBirthPlaceChange = (value: string) => {
    setBirthPlaceState(value);
    setBirthPlace(value);
  };

  const loadOrGenerateChart = async () => {
    setLoading(true);
    setError(null);
    const cacheKey = `${getUserChartId()}_${chartType}`;
    const userId = getStoredUserId();

    try {
      if (userId) {
        const stateResponse = await fetch(`/api/birth-chart/cache?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const state = await stateResponse.json().catch(() => null);
        const linkedCached = stateResponse.ok && state?.success ? state.linkedChart : null;

        if (linkedCached?.id) {
          const linkedData = linkedCached.data;
          const linkedHasAscendantPlanetSource =
            Array.isArray(linkedData?.planet_positions) &&
            linkedData.planet_positions.some((p: any) => String(p?.name || "").toLowerCase() === "ascendant");

          if (linkedData && hasRenderableChartData(linkedData) && linkedHasAscendantPlanetSource) {
            setChartData(linkedData);
            await linkBirthChartToCurrentUser(linkedCached.id);
            setLoading(false);
            return;
          }
        }
      }

      const cachedResponse = await fetch(`/api/birth-chart/cache?cacheKey=${encodeURIComponent(cacheKey)}`, { cache: "no-store" });
      const cachedResult = await cachedResponse.json().catch(() => null);
      const cached = cachedResponse.ok && cachedResult?.success ? cachedResult.chart : null;
      const cachedData = cached?.data;
      const hasAscendantPlanetSource =
        Array.isArray(cachedData?.planet_positions) &&
        cachedData.planet_positions.some((p: any) => String(p?.name || "").toLowerCase() === "ascendant");

      if (cachedData && hasRenderableChartData(cachedData) && hasAscendantPlanetSource) {
        setChartData(cached.data);
        await linkBirthChartToCurrentUser(cacheKey);
        setLoading(false);
        return;
      }
      await generateChart(cacheKey);
    } catch (err) {
      console.error("Failed to load chart:", err);
      await generateChart(cacheKey);
    }
  };

  const refreshChart = async () => {
    if (!canRefreshChart) return;

    setLoading(true);
    setError(null);
    setChartData(null);
    const refreshed = await generateChart(`${getUserChartId()}_${chartType}`);

    if (refreshed) {
      const nextAvailableAt = Date.now() + REFRESH_COOLDOWN_MS;
      localStorage.setItem(getRefreshCooldownKey(), String(nextAvailableAt));
      setRefreshAvailableAt(nextAvailableAt);
      setRefreshNow(Date.now());
    }
  };

  const generateChart = async (cacheKey: string): Promise<boolean> => {
    const birthDate = getBirthDate();
    const birthTime = getBirthTime();
    let latitude = 28.6139, longitude = 77.209, timezone = 5.5;

    if (birthPlace) {
      try {
        const geoResponse = await fetch("/api/astrology/geo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ place_name: birthPlace }),
        });
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          if (geoData.success && geoData.data) {
            latitude = geoData.data.latitude;
            longitude = geoData.data.longitude;
            timezone = geoData.data.timezone;
          }
        }
      } catch (err) {
        console.error("Geo lookup failed:", err);
      }
    }

    try {
      const response = await fetch("/api/astrology/birth-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ birthDate, birthTime, latitude, longitude, timezone, chartType }),
      });

      const result = await response.json();
      
      if (!result.success) {
        setError(result.error || "Failed to generate chart. Please try again.");
        setLoading(false);
        return false;
      }
      
      if (result.success && result.data) {
        if (!hasRenderableChartData(result.data)) {
          setError("Birth chart data is currently unavailable. Please try again in a few minutes.");
          setLoading(false);
          return false;
        }

        const chartDataWithDetails = {
          ...result.data,
          userBirthDetails: { date: birthDate, time: birthTime, place: birthPlace || "Unknown", knowsTime: knowsBirthTime },
          cachedAt: new Date().toISOString(),
        };
        setChartData(chartDataWithDetails);
        try {
          await fetch("/api/birth-chart/cache", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: getStoredUserId(), cacheKey, data: chartDataWithDetails }),
          });
        } catch (cacheErr) {
          console.error("Failed to cache chart:", cacheErr);
        }
        return true;
      }
    } catch (err) {
      console.error("Failed to generate chart:", err);
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
    return false;
  };

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/50 flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
          <div className="flex items-center gap-4 px-4 py-3">
            <button onClick={() => router.push("/reports")} className="w-10 h-10 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white text-xl font-semibold flex-1 text-center pr-10">Your Birth Chart</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-6 space-y-4">
            {/* Missing Data Form */}
            {showMissingDataForm && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-[#0b2338] border border-[#173653] rounded-2xl p-6 text-center">
                  <h2 className="text-white font-semibold text-lg mb-2">
                    {needsBirthTime ? "Birth Time Required" : "Birth Details Required"}
                  </h2>
                  <p className="text-white/60 text-sm">
                    {needsBirthTime
                      ? "A detailed birth chart needs your birth time. Enter it below to generate the report."
                      : "To generate your personalized birth chart, we need your birth details."}
                  </p>
                </div>
                <div className="bg-[#0b2338] rounded-2xl p-4 border border-[#173653] space-y-4">
                  {isMissingRequiredData ? (
                    <div>
                      <label className="text-white/60 text-sm block mb-2">Birth Date</label>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={birthMonth}
                          onChange={(e) => {
                            setBirthMonthState(e.target.value);
                            setBirthDate(e.target.value, birthDay, birthYear);
                          }}
                          className="bg-[#061525] border border-[#173653] rounded-lg px-3 py-2 text-white text-sm"
                        >
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select
                          value={birthDay}
                          onChange={(e) => {
                            setBirthDayState(e.target.value);
                            setBirthDate(birthMonth, e.target.value, birthYear);
                          }}
                          className="bg-[#061525] border border-[#173653] rounded-lg px-3 py-2 text-white text-sm"
                        >
                          {Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={String(d)}>{d}</option>)}
                        </select>
                        <select
                          value={birthYear}
                          onChange={(e) => {
                            setBirthYearState(e.target.value);
                            setBirthDate(birthMonth, birthDay, e.target.value);
                          }}
                          className="bg-[#061525] border border-[#173653] rounded-lg px-3 py-2 text-white text-sm"
                        >
                          {Array.from({length: 100}, (_, i) => 2024 - i).map(y => <option key={y} value={String(y)}>{y}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-[#173653] bg-[#061525] p-3">
                      <p className="text-white/60 text-xs">Birth Date</p>
                      <p className="text-white font-medium">{getDisplayMonth(birthMonth)} {birthDay}, {birthYear}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-white/60 text-sm block mb-2">Birth Time</label>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={birthHour}
                        onChange={(e) => {
                          setBirthHourState(e.target.value);
                          setBirthTime(e.target.value, birthMinute, birthPeriod as "AM" | "PM");
                        }}
                        className="bg-[#061525] border border-[#173653] rounded-lg px-3 py-2 text-white text-sm"
                      >
                        {Array.from({length: 12}, (_, i) => i + 1).map(h => <option key={h} value={String(h)}>{h}</option>)}
                      </select>
                      <select
                        value={birthMinute}
                        onChange={(e) => {
                          setBirthMinuteState(e.target.value);
                          setBirthTime(birthHour, e.target.value, birthPeriod as "AM" | "PM");
                        }}
                        className="bg-[#061525] border border-[#173653] rounded-lg px-3 py-2 text-white text-sm"
                      >
                        {MINUTE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select
                        value={birthPeriod}
                        onChange={(e) => {
                          setBirthPeriodState(e.target.value);
                          setBirthTime(birthHour, birthMinute, e.target.value as "AM" | "PM");
                        }}
                        className="bg-[#061525] border border-[#173653] rounded-lg px-3 py-2 text-white text-sm"
                      >
                        <option value="AM">AM</option>
                        <option value="PM">PM</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-white/60 text-sm block mb-2">Birth Place</label>
                    <LocationInput
                      value={birthPlace}
                      onChange={handleBirthPlaceChange}
                      placeholder="City, Country"
                      className="w-full bg-[#061525] border border-[#173653] rounded-lg px-3 py-2 text-white text-sm placeholder:text-[#6f8196]"
                    />
                  </div>
                  <Button onClick={() => void saveBirthTimeAndContinue()} className="w-full bg-[#38bdf8] hover:bg-[#7dd3fc] text-black [&_svg]:text-black">
                    {needsBirthTime ? "Generate Chart" : "Generate My Birth Chart"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Loading State */}
            {loading && !showMissingDataForm && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 text-[#38bdf8] animate-spin mb-4" />
                <p className="text-white/60 text-center">Calculating your birth chart...</p>
              </motion.div>
            )}

            {/* Error State */}
            {!loading && error && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
                  <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                  <p className="text-red-400 mb-4">{error}</p>
                  <Button onClick={() => loadOrGenerateChart()} className="bg-[#38bdf8] hover:bg-[#7dd3fc] text-black [&_svg]:text-black">
                    <RefreshCw className="w-4 h-4 mr-2" /> Try Again
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Chart Display - Only API-derived content */}
            {!loading && !error && !showMissingDataForm && chartData && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Birth Details */}
                <div className="bg-[#0b2338] rounded-2xl p-4 border border-[#173653]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Birth Date:</span>
                    <span className="text-white">{getDisplayMonth(birthMonth)} {birthDay}, {birthYear}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-white/60">Birth Time:</span>
                    <span className="text-white">{`${birthHour}:${birthMinute} ${birthPeriod}`}</span>
                  </div>
                  {birthPlace && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-white/60">Birth Place:</span>
                      <span className="text-white">{birthPlace}</span>
                    </div>
                  )}
                  <Button
                    onClick={() => void refreshChart()}
                    disabled={!canRefreshChart}
                    className="mt-4 h-10 w-full bg-[#38bdf8] text-sm font-semibold text-black hover:bg-[#7dd3fc] disabled:bg-[#173653] disabled:text-[#8fa3b8] [&_svg]:text-black disabled:[&_svg]:text-[#8fa3b8]"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {refreshRemainingMs > 0 ? `Refresh in ${formatRefreshWait(refreshRemainingMs)}` : "Refresh Chart"}
                  </Button>
                </div>

                {!hasRenderableChartData(chartData) && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-center">
                    <p className="text-amber-200 text-sm mb-3">
                      Birth chart details are not available yet for these birth inputs.
                    </p>
                    <Button onClick={() => loadOrGenerateChart()} className="bg-[#38bdf8] hover:bg-[#7dd3fc] text-black [&_svg]:text-black">
                      <RefreshCw className="w-4 h-4 mr-2" /> Regenerate Chart
                    </Button>
                  </div>
                )}

                {/* Rashi Chart (from API) */}
                {chartData.chart?.output && (
                  <div className="bg-[#0b2338] rounded-2xl p-4 border border-[#173653]">
                    {chartData.chart?.output ? (
                      <div className="w-full aspect-square bg-white rounded-xl overflow-hidden flex items-center justify-center [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: chartData.chart.output }} />
                    ) : (
                      <div className="w-full aspect-square bg-[#061525] rounded-xl flex items-center justify-center border border-[#173653]">
                        <p className="text-white/40 text-sm">Chart not available</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Navamsa Chart (from API - Vedic only) */}
                {chartData.chartType === "vedic" && chartData.navamsaChart?.output && (
                  <div className="bg-[#0b2338] rounded-2xl p-4 border border-[#173653]">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Moon className="w-5 h-5 text-[#7dd3fc]" />
                      Navamsa Chart (D9)
                    </h3>
                    <div className="w-full aspect-square bg-white rounded-xl overflow-hidden flex items-center justify-center [&_svg]:w-full [&_svg]:h-full" dangerouslySetInnerHTML={{ __html: chartData.navamsaChart.output }} />
                  </div>
                )}

                {/* Nakshatra Details (from API) */}
                {chartData.kundli?.nakshatra_details && (
                  <div className="bg-[#0b2338] rounded-2xl p-4 border border-[#173653]">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-400" />
                      Nakshatra Details
                    </h3>
                    <div className="space-y-3">
                      {chartData.kundli.nakshatra_details.nakshatra && (
                        <div className="bg-[#061525] rounded-xl p-3 border border-[#173653]">
                          <p className="text-white/60 text-xs">Nakshatra</p>
                          <p className="text-white font-medium">{chartData.kundli.nakshatra_details.nakshatra.name}</p>
                          <p className="text-white/50 text-sm">Pada {chartData.kundli.nakshatra_details.nakshatra.pada} • Lord: {chartData.kundli.nakshatra_details.nakshatra.lord?.name}</p>
                        </div>
                      )}
                      {chartData.kundli.nakshatra_details.chandra_rasi && (
                        <div className="bg-[#061525] rounded-xl p-3 border border-[#173653]">
                          <p className="text-white/60 text-xs">Moon Sign (Chandra Rasi)</p>
                          <p className="text-white font-medium">{chartData.kundli.nakshatra_details.chandra_rasi.name}</p>
                          <p className="text-white/50 text-sm">Lord: {chartData.kundli.nakshatra_details.chandra_rasi.lord?.name}</p>
                        </div>
                      )}
                      {chartData.kundli.nakshatra_details.soorya_rasi && (
                        <div className="bg-[#061525] rounded-xl p-3 border border-[#173653]">
                          <p className="text-white/60 text-xs">Sun Sign (Soorya Rasi)</p>
                          <p className="text-white font-medium">{chartData.kundli.nakshatra_details.soorya_rasi.name}</p>
                          <p className="text-white/50 text-sm">Lord: {chartData.kundli.nakshatra_details.soorya_rasi.lord?.name}</p>
                        </div>
                      )}
                      {ascendantLagna && (
                        <div className="bg-[#061525] rounded-xl p-3 border border-[#173653]">
                          <p className="text-white/60 text-xs">Ascendant (Lagna)</p>
                          <p className="text-white font-medium">{ascendantLagna}</p>
                        </div>
                      )}
                      {chartData.kundli.nakshatra_details.additional_info && (
                        <div className="bg-[#061525] rounded-xl p-3 border border-[#173653]">
                          <p className="text-white/60 text-xs mb-2">Additional Info</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="text-white/50">Deity:</span> <span className="text-white">{chartData.kundli.nakshatra_details.additional_info.deity}</span></div>
                            <div><span className="text-white/50">Ganam:</span> <span className="text-white">{chartData.kundli.nakshatra_details.additional_info.ganam}</span></div>
                            <div><span className="text-white/50">Nadi:</span> <span className="text-white">{chartData.kundli.nakshatra_details.additional_info.nadi}</span></div>
                            <div><span className="text-white/50">Animal:</span> <span className="text-white">{chartData.kundli.nakshatra_details.additional_info.animal_sign}</span></div>
                            <div><span className="text-white/50">Color:</span> <span className="text-white">{chartData.kundli.nakshatra_details.additional_info.color}</span></div>
                            <div><span className="text-white/50">Stone:</span> <span className="text-white">{chartData.kundli.nakshatra_details.additional_info.birth_stone}</span></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Mangal Dosha (from API) */}
                {chartData.kundli?.mangal_dosha && (
                  <div className={`rounded-2xl p-4 border ${chartData.kundli.mangal_dosha.has_dosha ? 'bg-red-500/10 border-red-500/30' : 'bg-green-500/10 border-green-500/30'}`}>
                    <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                      <Heart className={`w-5 h-5 ${chartData.kundli.mangal_dosha.has_dosha ? 'text-red-400' : 'text-green-400'}`} />
                      Mangal Dosha
                    </h3>
                    <p className={`text-sm ${chartData.kundli.mangal_dosha.has_dosha ? 'text-red-300' : 'text-green-300'}`}>
                      {chartData.kundli.mangal_dosha.has_dosha ? 'Manglik' : 'Not Manglik'}
                    </p>
                    {chartData.kundli.mangal_dosha.description && (
                      <p className="text-white/60 text-sm mt-2">{chartData.kundli.mangal_dosha.description}</p>
                    )}
                  </div>
                )}

                {/* Yoga Details (from API) */}
                {chartData.kundli?.yoga_details && chartData.kundli.yoga_details.length > 0 && (
                  <div className="bg-[#0b2338] rounded-2xl p-4 border border-[#173653]">
                    <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                      <Star className="w-5 h-5 text-[#38bdf8]" />
                      Yogas in Your Chart
                    </h3>
                    <div className="space-y-2">
                      {chartData.kundli.yoga_details.map((yoga: any, idx: number) => (
                        <div key={idx} className="bg-[#061525] rounded-xl p-3 border border-[#173653]">
                          <p className="text-white font-medium">{yoga.name}</p>
                          <p className="text-white/50 text-sm">{yoga.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <ReportCTA />
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
