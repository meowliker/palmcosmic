"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Settings, ChevronRight } from "lucide-react";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useUserStore } from "@/lib/user-store";
import { getZodiacSign } from "@/lib/astrology-api";
import { supabase } from "@/lib/supabase";
import { UserAvatar, getUserDisplayName } from "@/components/UserAvatar";
import { extractStoredSignName } from "@/lib/zodiac-utils";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";

// Zodiac symbols mapping
const zodiacSymbols: Record<string, string> = {
  Aries: "♈", Taurus: "♉", Gemini: "♊", Cancer: "♋",
  Leo: "♌", Virgo: "♍", Libra: "♎", Scorpio: "♏",
  Sagittarius: "♐", Capricorn: "♑", Aquarius: "♒", Pisces: "♓"
};

// Element mapping
const zodiacElements: Record<string, string> = {
  Aries: "Fire", Taurus: "Earth", Gemini: "Air", Cancer: "Water",
  Leo: "Fire", Virgo: "Earth", Libra: "Air", Scorpio: "Water",
  Sagittarius: "Fire", Capricorn: "Earth", Aquarius: "Air", Pisces: "Water"
};

// Ruling planet mapping
const zodiacPlanets: Record<string, string> = {
  Aries: "Mars", Taurus: "Venus", Gemini: "Mercury", Cancer: "Moon",
  Leo: "Sun", Virgo: "Mercury", Libra: "Venus", Scorpio: "Pluto",
  Sagittarius: "Jupiter", Capricorn: "Saturn", Aquarius: "Uranus", Pisces: "Neptune"
};

// Polarity mapping
const zodiacPolarity: Record<string, string> = {
  Aries: "Masculine", Taurus: "Feminine", Gemini: "Masculine", Cancer: "Feminine",
  Leo: "Masculine", Virgo: "Feminine", Libra: "Masculine", Scorpio: "Feminine",
  Sagittarius: "Masculine", Capricorn: "Feminine", Aquarius: "Masculine", Pisces: "Feminine"
};

// Modality mapping
const zodiacModality: Record<string, string> = {
  Aries: "Cardinal", Taurus: "Fixed", Gemini: "Mutable", Cancer: "Cardinal",
  Leo: "Fixed", Virgo: "Mutable", Libra: "Cardinal", Scorpio: "Fixed",
  Sagittarius: "Mutable", Capricorn: "Cardinal", Aquarius: "Fixed", Pisces: "Mutable"
};

export default function ProfilePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<{
    birthMonth: string;
    birthDay: string;
    birthYear: string;
    birthHour: string;
    birthMinute: string;
    birthPeriod: string;
    sunSign: string;
    moonSign: string;
    ascendantSign: string;
    name?: string;
    email?: string;
  } | null>(null);
  
  const { 
    birthMonth: storeBirthMonth, birthDay: storeBirthDay, birthYear: storeBirthYear, 
    birthHour: storeBirthHour, birthMinute: storeBirthMinute, birthPeriod: storeBirthPeriod,
    ascendantSign: storeAscendantSign, moonSign: storeMoonSign
  } = useOnboardingStore();
  
  const { purchasedBundle } = useUserStore();

  useEffect(() => {
    setIsClient(true);
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
    pixelEvents.viewContent("Profile", "account");
    trackAnalyticsEvent("ProfileViewed", {
      route: "/profile",
      user_id: userId,
      email,
      has_bundle: Boolean(purchasedBundle),
    });
    
    loadUserData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem("astrorekha_user_id");

      if (userId) {
        const { data: dbUser } = await supabase.from("users").select("*").eq("id", userId).single();

        if (dbUser) {
          const data = dbUser;
          const month = data.birth_month ? String(data.birth_month) : storeBirthMonth;
          const day = data.birth_day ? String(data.birth_day) : storeBirthDay;
          const year = data.birth_year ? String(data.birth_year) : storeBirthYear;
          const hour = data.birth_hour || storeBirthHour || "12";
          const minute = data.birth_minute || storeBirthMinute || "00";
          const period = data.birth_period || storeBirthPeriod || "PM";
          const place = data.birth_place || "";
          
          let sunSignValue = extractStoredSignName(data.sun_sign);
          let moonSignValue = extractStoredSignName(data.moon_sign);
          let ascendantValue = extractStoredSignName(data.ascendant_sign);
          
          if (!sunSignValue || !moonSignValue || !ascendantValue) {
            try {
              const { data: profileData } = await supabase.from("user_profiles").select("*").eq("id", userId).single();
              if (profileData) {
                if (!sunSignValue) sunSignValue = extractStoredSignName(profileData.sun_sign);
                if (!moonSignValue) moonSignValue = extractStoredSignName(profileData.moon_sign);
                if (!ascendantValue) ascendantValue = extractStoredSignName(profileData.ascendant_sign);
                
                if (sunSignValue || moonSignValue || ascendantValue) {
                  await supabase.from("users").update({
                    ...(sunSignValue ? { sun_sign: sunSignValue } : {}),
                    ...(moonSignValue ? { moon_sign: moonSignValue } : {}),
                    ...(ascendantValue ? { ascendant_sign: ascendantValue } : {}),
                  }).eq("id", userId);
                }
              }
            } catch (profileError) {
              console.error("Error reading user_profiles:", profileError);
            }
          }
          
          if (!sunSignValue || !moonSignValue || !ascendantValue) {
            try {
              const response = await fetch("/api/astrology/signs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  birthMonth: month,
                  birthDay: day,
                  birthYear: year,
                  birthHour: hour,
                  birthMinute: minute,
                  birthPeriod: period,
                  birthPlace: place,
                }),
              });
              const signsData = await response.json();
              if (signsData.success) {
                if (!sunSignValue) sunSignValue = extractStoredSignName(signsData.sunSign);
                if (!moonSignValue) moonSignValue = extractStoredSignName(signsData.moonSign);
                if (!ascendantValue) ascendantValue = extractStoredSignName(signsData.ascendant);
                
                await supabase.from("users").update({
                  sun_sign: signsData.sunSign?.name || signsData.sunSign,
                  moon_sign: signsData.moonSign?.name || signsData.moonSign,
                  ascendant_sign: signsData.ascendant?.name || signsData.ascendant,
                }).eq("id", userId);
              }
            } catch (signsError) {
              console.error("Error fetching signs:", signsError);
              moonSignValue = moonSignValue || "Cancer";
              ascendantValue = ascendantValue || "Leo";
            }
          }

          const email = data.email || localStorage.getItem("astrorekha_email") || undefined;
          
          // Final fallback: use Western tropical calculation only if astro-engine signs unavailable
          const fallbackSunSign = month && day ? getZodiacSign(Number(month), Number(day)) : "Aries";

          setUserData({
            birthMonth: month,
            birthDay: day,
            birthYear: year,
            birthHour: hour,
            birthMinute: minute,
            birthPeriod: period,
            sunSign: sunSignValue || fallbackSunSign,
            moonSign: moonSignValue || "Cancer",
            ascendantSign: ascendantValue || "Leo",
            name: data.name || undefined,
            email: email,
          });
          setIsLoading(false);
          return;
        }
      }

      // Fallback to onboarding store
      if (storeBirthMonth && storeBirthDay) {
        const storedEmail = localStorage.getItem("astrorekha_email") || undefined;
        setUserData({
          birthMonth: storeBirthMonth,
          birthDay: storeBirthDay,
          birthYear: storeBirthYear,
          birthHour: storeBirthHour || "12",
          birthMinute: storeBirthMinute || "00",
          birthPeriod: storeBirthPeriod || "PM",
          sunSign: getZodiacSign(Number(storeBirthMonth), Number(storeBirthDay)),
          moonSign: storeMoonSign?.name || "Cancer",
          ascendantSign: storeAscendantSign?.name || "Leo",
          email: storedEmail,
        });
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sunSign = userData?.sunSign || (isLoading ? "Loading..." : "Aries");
  const userMoonSign = userData?.moonSign || (isLoading ? "Loading..." : "Cancer");
  const userAscendant = userData?.ascendantSign || (isLoading ? "Loading..." : "Leo");
  const birthMonth = userData?.birthMonth || storeBirthMonth;
  const birthDay = userData?.birthDay || storeBirthDay;
  const birthYear = userData?.birthYear || storeBirthYear;
  const birthHour = userData?.birthHour || storeBirthHour || "12";
  const birthMinute = userData?.birthMinute || storeBirthMinute || "00";
  const birthPeriod = userData?.birthPeriod || storeBirthPeriod || "PM";

  // Format birth date and time
  const formatBirthDateTime = () => {
    if (!birthMonth || !birthDay || !birthYear) return "Not set";
    const months = ["January", "February", "March", "April", "May", "June", 
                    "July", "August", "September", "October", "November", "December"];
    const hour = birthHour || 12;
    const minute = birthMinute || 0;
    const period = birthPeriod || "PM";
    // Handle month as number or name
    const monthIndex = isNaN(Number(birthMonth)) 
      ? months.findIndex(m => m.toLowerCase() === String(birthMonth).toLowerCase())
      : Number(birthMonth) - 1;
    const monthName = monthIndex >= 0 && monthIndex < 12 ? months[monthIndex] : birthMonth;
    return `${monthName} ${birthDay}, ${birthYear}•${hour}:${String(minute).padStart(2, '0')} ${period}`;
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#061525] flex items-center justify-center">
        <div className="w-full max-w-md h-screen bg-[#061525]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/30 flex flex-col relative">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => {
                trackAnalyticsEvent("ProfileAction", {
                  route: "/profile",
                  action: "back_clicked",
                  destination: "/dashboard",
                });
                router.push("/dashboard");
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#b8c7da] transition-colors hover:bg-[#0b2338] hover:text-white"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white text-xl font-semibold">Profile</h1>
            <button
              onClick={() => {
                trackAnalyticsEvent("ProfileAction", {
                  route: "/profile",
                  action: "settings_clicked",
                  destination: "/settings",
                });
                router.push("/settings");
              }}
              className="w-10 h-10 flex items-center justify-center rounded-lg text-[#b8c7da] transition-colors hover:bg-[#0b2338] hover:text-white"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="px-4 py-5 space-y-6 pb-10">
            {/* User Info Row */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between rounded-lg border border-[#173653] bg-[#0b2338] p-4"
            >
              <div className="flex items-center gap-3">
                <UserAvatar name={userData?.name} email={userData?.email} size="lg" className="w-14 h-14 text-xl" />
                <div>
                  <h2 className="text-white text-lg font-semibold">{getUserDisplayName(userData?.name, userData?.email)}</h2>
                  <p className="text-[#8fa3b8] text-sm">{formatBirthDateTime()}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  trackAnalyticsEvent("ProfileAction", {
                    route: "/profile",
                    action: "edit_profile_clicked",
                    destination: "/profile/edit",
                  });
                  router.push("/profile/edit");
                }}
                className="flex items-center gap-1 text-[#38bdf8] hover:text-white transition-colors"
              >
                <span className="text-sm font-medium">Edit</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Sun Sign Display */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex flex-col items-center py-6 rounded-lg border border-[#173653] bg-[#082035]"
            >
              <div className="relative">
                {/* Outer ring */}
                <div className="w-40 h-40 rounded-full border border-[#38bdf8]/35 flex items-center justify-center">
                  {/* Inner decorative circles */}
                  <div className="w-32 h-32 rounded-full border border-[#38bdf8]/20 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-[#0b2338] flex items-center justify-center border border-[#173653]">
                      <span className="text-5xl text-[#38bdf8]">{zodiacSymbols[sunSign] || "♈"}</span>
                    </div>
                  </div>
                </div>
                {/* Decorative dots */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full bg-[#38bdf8]/60"
                    style={{
                      top: `${50 - 45 * Math.cos((angle * Math.PI) / 180)}%`,
                      left: `${50 + 45 * Math.sin((angle * Math.PI) / 180)}%`,
                      transform: "translate(-50%, -50%)",
                    }}
                  />
                ))}
              </div>
              <p className="text-white text-lg font-medium mt-4">Sun sign - {sunSign}</p>
              <p className="text-[#8fa3b8] text-sm mt-1">Your core profile signature</p>
            </motion.div>

            {/* Zodiac Info Grid - Row 1 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="grid grid-cols-3 gap-3"
            >
              {/* Moon Sign */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-lg bg-[#0b2338] flex items-center justify-center border border-[#173653]">
                  <span className="text-2xl text-[#38bdf8]">☽</span>
                </div>
                <p className="text-[#8fa3b8] text-xs mt-2">Moon Sign</p>
                <p className="text-white font-medium text-sm">{userMoonSign}</p>
              </div>

              {/* Element */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-lg bg-[#0b2338] flex items-center justify-center border border-[#173653]">
                  <span className="text-2xl text-[#38bdf8]">
                    {zodiacElements[sunSign] === "Fire" && "🔥"}
                    {zodiacElements[sunSign] === "Water" && "💧"}
                    {zodiacElements[sunSign] === "Earth" && "🌍"}
                    {zodiacElements[sunSign] === "Air" && "💨"}
                  </span>
                </div>
                <p className="text-[#8fa3b8] text-xs mt-2">Element</p>
                <p className="text-white font-medium text-sm">{zodiacElements[sunSign] || "Fire"}</p>
              </div>

              {/* Ascendant */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-lg bg-[#0b2338] flex items-center justify-center border border-[#173653]">
                  <span className="text-2xl text-[#38bdf8]">{zodiacSymbols[userAscendant] || "♌"}</span>
                </div>
                <p className="text-[#8fa3b8] text-xs mt-2">Ascendant</p>
                <p className="text-white font-medium text-sm">{userAscendant}</p>
              </div>
            </motion.div>

            {/* Zodiac Info Grid - Row 2 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="grid grid-cols-3 gap-3"
            >
              {/* Planet */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-lg bg-[#0b2338] flex items-center justify-center border border-[#173653]">
                  <span className="text-2xl text-[#38bdf8]">♃</span>
                </div>
                <p className="text-[#8fa3b8] text-xs mt-2">Planet</p>
                <p className="text-white font-medium text-sm">{zodiacPlanets[sunSign] || "Jupiter"}</p>
              </div>

              {/* Polarity */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-lg bg-[#0b2338] flex items-center justify-center border border-[#173653]">
                  <span className="text-2xl text-[#38bdf8]">♂</span>
                </div>
                <p className="text-[#8fa3b8] text-xs mt-2">Polarity</p>
                <p className="text-white font-medium text-sm">{zodiacPolarity[sunSign] || "Masculine"}</p>
              </div>

              {/* Modality */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-lg bg-[#0b2338] flex items-center justify-center border border-[#173653]">
                  <span className="text-2xl text-[#38bdf8]">☍</span>
                </div>
                <p className="text-[#8fa3b8] text-xs mt-2">Modality</p>
                <p className="text-white font-medium text-sm">{zodiacModality[sunSign] || "Mutable"}</p>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
