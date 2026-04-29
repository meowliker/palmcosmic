"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronDown, Loader2, Sparkles, Star } from "lucide-react";
import { getZodiacSign, getZodiacSymbol } from "@/lib/astrology-api";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { extractStoredSignName } from "@/lib/zodiac-utils";

const ZODIAC_SIGNS = [
  { sign: "Aries", symbol: "♈", gradient: "from-red-500 to-orange-500", element: "Fire" },
  { sign: "Taurus", symbol: "♉", gradient: "from-green-500 to-emerald-600", element: "Earth" },
  { sign: "Gemini", symbol: "♊", gradient: "from-yellow-400 to-amber-500", element: "Air" },
  { sign: "Cancer", symbol: "♋", gradient: "from-blue-400 to-cyan-500", element: "Water" },
  { sign: "Leo", symbol: "♌", gradient: "from-orange-400 to-yellow-500", element: "Fire" },
  { sign: "Virgo", symbol: "♍", gradient: "from-emerald-400 to-teal-500", element: "Earth" },
  { sign: "Libra", symbol: "♎", gradient: "from-pink-400 to-rose-500", element: "Air" },
  { sign: "Scorpio", symbol: "♏", gradient: "from-purple-500 to-indigo-600", element: "Water" },
  { sign: "Sagittarius", symbol: "♐", gradient: "from-violet-500 to-purple-600", element: "Fire" },
  { sign: "Capricorn", symbol: "♑", gradient: "from-slate-400 to-zinc-600", element: "Earth" },
  { sign: "Aquarius", symbol: "♒", gradient: "from-cyan-400 to-blue-500", element: "Air" },
  { sign: "Pisces", symbol: "♓", gradient: "from-indigo-400 to-violet-500", element: "Water" },
];

const PERIODS = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
];

interface HoroscopeSection {
  title: string;
  icon: string;
  content: string;
}

interface SignHoroscopeData {
  horoscope: string;
  date?: string;
  horoscope_sections?: HoroscopeSection[];
  focus_areas?: string[];
  challenges?: string[];
  sign?: string;
  period?: string;
}

export default function HoroscopePage() {
  const router = useRouter();
  const [selectedSign, setSelectedSign] = useState("Aries");
  const [selectedPeriod, setSelectedPeriod] = useState("today");
  const [showSignPicker, setShowSignPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [horoscopeData, setHoroscopeData] = useState<SignHoroscopeData | null>(null);
  const [userSign, setUserSign] = useState<string | null>(null);
  const [signLoaded, setSignLoaded] = useState(false);

  const { birthMonth: storeBirthMonth, birthDay: storeBirthDay } = useOnboardingStore();

  const currentSignData = ZODIAC_SIGNS.find((z) => z.sign === selectedSign) || ZODIAC_SIGNS[0];

  useEffect(() => {
    loadUserSign().finally(() => setSignLoaded(true));
  }, []);

  const loadUserSign = async () => {
    try {
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id");

      if (userId) {
        const response = await fetch(`/api/user/hydrate?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
        const result = await response.json().catch(() => null);
        const userData = response.ok && result?.success ? result.user : null;

        if (userData) {
          const storedSunSign = extractStoredSignName(userData.sunSign);
          if (storedSunSign) {
            setSelectedSign(storedSunSign);
            setUserSign(storedSunSign);
            return;
          }

          if (userData.birthMonth && userData.birthDay) {
            const sign = getZodiacSign(Number(userData.birthMonth), Number(userData.birthDay));
            setSelectedSign(sign);
            setUserSign(sign);
            return;
          }
        }
      }

      const onboardingSunSign = useOnboardingStore.getState().sunSign;
      if (onboardingSunSign?.name) {
        setSelectedSign(onboardingSunSign.name);
        setUserSign(onboardingSunSign.name);
      } else if (storeBirthMonth && storeBirthDay) {
        const sign = getZodiacSign(Number(storeBirthMonth), Number(storeBirthDay));
        setSelectedSign(sign);
        setUserSign(sign);
      }
    } catch (error) {
      console.error("Error loading user sign:", error);
    }
  };

  useEffect(() => {
    if (signLoaded) {
      fetchHoroscope();
    }
  }, [selectedSign, selectedPeriod, signLoaded]);

  const fetchHoroscope = async () => {
    setLoading(true);
    setHoroscopeData(null);
    
    try {
      // Fetch horoscope (cached by sign+date, different API for today vs tomorrow)
      const day = selectedPeriod === "tomorrow" ? "tomorrow" : "today";
      const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
      const params = new URLSearchParams({
        sign: selectedSign,
        day,
      });
      if (userId) params.set("userId", userId);
      const res = await fetch(`/api/horoscope/user-daily?${params.toString()}`);
      
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.horoscope) {
          setHoroscopeData({
            horoscope: result.horoscope,
            date: result.date,
          });
          return;
        }
      }
    } catch (error) {
      console.error("Failed to fetch horoscope:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateKey = (dateKey?: string) => {
    if (!dateKey) return null;
    const [year, month, day] = dateKey.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const fallbackDisplayDate = new Date();
  if (selectedPeriod === "tomorrow") {
    fallbackDisplayDate.setDate(fallbackDisplayDate.getDate() + 1);
  }
  const currentDate = formatDateKey(horoscopeData?.date) || fallbackDisplayDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const periodTitle = selectedPeriod === "tomorrow" ? "Tomorrow's" : "Daily";

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md min-h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/30 flex flex-col">
        {/* Hero Header with Gradient */}
        <div className={`relative bg-gradient-to-br ${currentSignData.gradient} overflow-hidden`}>
          {/* Decorative stars */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-4 left-8 w-1 h-1 bg-white rounded-full" />
            <div className="absolute top-8 right-12 w-1.5 h-1.5 bg-white rounded-full" />
            <div className="absolute top-16 left-20 w-1 h-1 bg-white rounded-full" />
            <div className="absolute bottom-8 right-8 w-1 h-1 bg-white rounded-full" />
            <div className="absolute bottom-12 left-12 w-1.5 h-1.5 bg-white rounded-full" />
            <div className="absolute top-12 right-24 w-0.5 h-0.5 bg-white rounded-full" />
          </div>

          {/* Back button */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 relative z-10">
            <button
              onClick={() => router.push("/reports")}
              className="w-9 h-9 rounded-lg bg-black/20 backdrop-blur-sm flex items-center justify-center hover:bg-black/30 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <Sparkles className="w-5 h-5 text-white/60" />
          </div>

          {/* Sign info */}
          <div className="px-6 pb-6 pt-2 relative z-10">
            <button
              onClick={() => setShowSignPicker(true)}
              className="flex items-center gap-2 mb-3 group"
            >
              <span className="text-5xl">{currentSignData.symbol}</span>
              <ChevronDown className="w-4 h-4 text-white/60 group-hover:text-white transition-colors" />
            </button>
            <h1 className="text-3xl font-bold text-white mb-1">
              {selectedSign}
            </h1>
            <p className="text-white/70 text-sm">
              {currentSignData.element} Sign {userSign === selectedSign && <span className="text-white/90">&#183; Your Sign</span>}
            </p>
            <p className="text-white/50 text-xs mt-1">{currentDate}</p>
          </div>
        </div>

        {/* Period Tabs */}
        <div className="flex gap-2 px-4 py-3 bg-[#061525] border-b border-[#173653]">
          {PERIODS.map((period) => (
            <button
              key={period.id}
              onClick={() => setSelectedPeriod(period.id)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                selectedPeriod === period.id
                  ? `bg-gradient-to-r ${currentSignData.gradient} text-white shadow-lg shadow-black/20`
                  : "border border-[#173653] bg-[#0b2338] text-[#8fa3b8] hover:border-[#38bdf8]/60 hover:text-white"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${currentSignData.gradient} flex items-center justify-center animate-pulse shadow-lg shadow-black/20`}>
                <Star className="w-6 h-6 text-white" />
              </div>
              <p className="text-[#8fa3b8] text-sm">Reading the stars...</p>
            </div>
          ) : horoscopeData ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={`${selectedSign}-${selectedPeriod}`}
              className="px-5 py-6"
            >
              {/* Period Title */}
              <h2 className="text-xl font-bold text-white mb-5">
                {periodTitle} Horoscope
              </h2>

              {/* Focus & Challenges (if available from pre-generated data) */}
              {horoscopeData.focus_areas && horoscopeData.challenges && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <div className="rounded-lg border border-[#38bdf8]/25 bg-[#0b2338] p-4">
                    <h3 className="text-[#38bdf8] font-semibold text-xs uppercase tracking-wider mb-2">Focus</h3>
                    <ul className="space-y-1.5">
                      {horoscopeData.focus_areas.map((item, idx) => (
                        <li key={idx} className="text-[#dce8f5] text-sm flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${currentSignData.gradient}`} />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-[#173653] bg-[#0b2338] p-4">
                    <h3 className="text-[#7dd3fc] font-semibold text-xs uppercase tracking-wider mb-2">Watch Out</h3>
                    <ul className="space-y-1.5">
                      {horoscopeData.challenges.map((item, idx) => (
                        <li key={idx} className="text-[#dce8f5] text-sm flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#7dd3fc]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Horoscope Text - Organized by Sections */}
              <div className="space-y-4 mb-6">
                {(() => {
                  const sectionIcons: Record<string, string> = {
                    "overview": "✨",
                    "love & relationships": "💕",
                    "love": "💕",
                    "relationships": "💕",
                    "career & finance": "💼",
                    "career": "💼",
                    "finance": "💰",
                    "health & wellness": "🌿",
                    "health": "🌿",
                    "wellness": "🧘",
                    "travel & adventure": "✈️",
                    "travel": "✈️",
                  };

                  // Use structured sections if available (from Divine API)
                  if (horoscopeData.horoscope_sections && horoscopeData.horoscope_sections.length > 0) {
                    return horoscopeData.horoscope_sections.map((section, idx) => (
                      <div key={idx} className="bg-[#0b2338] rounded-lg p-4 border border-[#173653]">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">
                            {sectionIcons[section.title.toLowerCase()] || "🔮"}
                          </span>
                          <h3 className="text-white font-semibold text-sm">{section.title}</h3>
                        </div>
                        <p className="text-[#b8c7da] leading-relaxed text-[14px]">
                          {section.content}
                        </p>
                      </div>
                    ));
                  }

                  // Fallback: try to parse **Section** markdown headers
                  const text = horoscopeData.horoscope;
                  const sectionRegex = /\*\*(.+?)\*\*/g;
                  const parts = text.split(sectionRegex);

                  if (parts.length > 1) {
                    const sections: { title: string; content: string }[] = [];
                    for (let i = 1; i < parts.length; i += 2) {
                      const title = parts[i]?.trim();
                      const content = parts[i + 1]?.trim();
                      if (title && content) {
                        sections.push({ title, content });
                      }
                    }
                    if (parts[0]?.trim()) {
                      sections.unshift({ title: "", content: parts[0].trim() });
                    }

                    return sections.map((section, idx) => (
                      <div key={idx} className="bg-[#0b2338] rounded-lg p-4 border border-[#173653]">
                        {section.title && (
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-lg">
                              {sectionIcons[section.title.toLowerCase()] || "🔮"}
                            </span>
                            <h3 className="text-white font-semibold text-sm">{section.title}</h3>
                          </div>
                        )}
                        {section.content
                          .split(/\n\n|\n/)
                          .filter((p: string) => p.trim())
                          .map((paragraph: string, pIdx: number) => (
                            <p key={pIdx} className="text-[#b8c7da] leading-relaxed text-[14px] mb-2 last:mb-0">
                              {paragraph.trim()}
                            </p>
                          ))}
                      </div>
                    ));
                  }

                  // Last fallback: split paragraph text into the same four logical cards.
                  const sentences = text.split(/(?<=\.)\s+/).filter((s: string) => s.trim());
                  if (sentences.length >= 4) {
                    const sectionCount = 4;
                    const chunkSize = Math.ceil(sentences.length / sectionCount);
                    const autoSections = [
                      { title: "Overview", icon: "✨", sentences: sentences.slice(0, chunkSize) },
                      { title: "Love & Relationships", icon: "💕", sentences: sentences.slice(chunkSize, chunkSize * 2) },
                      { title: "Health & Wellness", icon: "🌿", sentences: sentences.slice(chunkSize * 2, chunkSize * 3) },
                      { title: "Career & Finance", icon: "💼", sentences: sentences.slice(chunkSize * 3) },
                    ].filter(s => s.sentences.length > 0);

                    return autoSections.map((section, idx) => (
                      <div key={idx} className="bg-[#0b2338] rounded-lg p-4 border border-[#173653]">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">{section.icon}</span>
                          <h3 className="text-white font-semibold text-sm">{section.title}</h3>
                        </div>
                        <p className="text-[#b8c7da] leading-relaxed text-[14px]">
                          {section.sentences.join(" ")}
                        </p>
                      </div>
                    ));
                  }

                  // Absolute fallback: just render the text
                  return (
                    <div className="bg-[#0b2338] rounded-lg p-4 border border-[#173653]">
                      <p className="text-[#b8c7da] leading-relaxed text-[15px]">{text}</p>
                    </div>
                  );
                })()}
              </div>

              {/* Decorative divider */}
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-[#173653]" />
                <Sparkles className="w-4 h-4 text-[#38bdf8]/45" />
                <div className="flex-1 h-px bg-[#173653]" />
              </div>

              {/* Source badge */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${currentSignData.gradient}`} />
                <span className="text-[#8fa3b8] text-xs">Powered by Swiss Ephemeris + AI</span>
              </div>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <p className="text-[#b8c7da] text-sm">Horoscope not available yet</p>
              <p className="text-[#8fa3b8] text-xs">Check back soon</p>
            </div>
          )}
        </div>

        {/* Sign Picker Modal */}
        <AnimatePresence>
          {showSignPicker && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#020b15]/85 backdrop-blur-sm z-50 flex items-end justify-center"
              onClick={() => setShowSignPicker(false)}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="w-full max-w-md bg-[#061525] border-t border-[#38bdf8]/25 rounded-t-2xl p-6 shadow-2xl shadow-black/40"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-12 h-1 bg-[#38bdf8]/35 rounded-full mx-auto mb-6" />
                <h2 className="text-white text-xl font-bold mb-4 text-center">Select Sign</h2>
                <div className="grid grid-cols-3 gap-3">
                  {ZODIAC_SIGNS.map((zodiac) => (
                    <button
                      key={zodiac.sign}
                      onClick={() => {
                        setSelectedSign(zodiac.sign);
                        setShowSignPicker(false);
                      }}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all ${
                        selectedSign === zodiac.sign
                          ? `bg-gradient-to-br ${zodiac.gradient} border border-white/30 shadow-lg shadow-black/20`
                          : "bg-[#0b2338] hover:border-[#38bdf8]/60 border border-[#173653]"
                      }`}
                    >
                      <span className="text-2xl">{zodiac.symbol}</span>
                      <span className="text-white text-xs font-medium">{zodiac.sign}</span>
                      {userSign === zodiac.sign && (
                        <span className="text-[10px] text-[#b8c7da]">You</span>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
