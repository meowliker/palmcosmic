"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { supabase } from "@/lib/supabase";
import { getZodiacSign } from "@/lib/astrology-api";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const genderOptions = ["Male", "Female", "Non-binary", "Prefer not to say"];

export default function EditProfilePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit modal states
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState("");
  
  // Location search states
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  
  const {
    gender, setGender,
    birthMonth, birthDay, birthYear,
    setBirthDate,
    birthPlace, setBirthPlace,
    birthHour, birthMinute, birthPeriod,
    setBirthTime,
    setSigns,
    setModality,
    setPolarity,
  } = useOnboardingStore();

  const [localName, setLocalName] = useState("You");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsClient(true);
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
    pixelEvents.viewContent("Edit Profile", "account");
    trackAnalyticsEvent("EditProfileViewed", {
      route: "/profile/edit",
      user_id: userId,
      email,
    });
    loadUserProfile();
  }, []);

  const openEditField = (field: string, value?: string) => {
    setEditingField(field);
    if (value !== undefined) setTempValue(value);
    trackAnalyticsEvent("EditProfileAction", {
      route: "/profile/edit",
      action: "field_edit_opened",
      field,
    });
  };

  const loadUserProfile = async () => {
    setIsLoading(true);
    try {
      const storedId = localStorage.getItem("astrorekha_user_id");
      const userId = storedId;

      if (!userId) {
        setIsLoading(false);
        return;
      }

      // Load from Supabase
        const { data: userData } = await supabase.from("users").select("*").eq("id", userId).single();

      if (userData) {
        if (userData.name) setLocalName(userData.name);
        if (userData.gender) setGender(userData.gender);
        if (userData.birth_month && userData.birth_day && userData.birth_year) {
          setBirthDate(String(userData.birth_month), String(userData.birth_day), String(userData.birth_year));
        }
        if (userData.birth_place) setBirthPlace(userData.birth_place);
        if (userData.birth_hour) {
          setBirthTime(
            String(userData.birth_hour),
            String(userData.birth_minute || 0),
            userData.birth_period || "AM"
          );
        }
      } else {
        const savedName = localStorage.getItem("astrorekha_name");
        if (savedName) setLocalName(savedName);
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatBirthDate = () => {
    if (!birthMonth || !birthDay || !birthYear) return "Not set";
    // birthMonth could be a month name or number
    const monthIndex = isNaN(Number(birthMonth)) 
      ? months.findIndex(m => m.toLowerCase() === birthMonth.toLowerCase())
      : Number(birthMonth) - 1;
    const monthName = monthIndex >= 0 && monthIndex < 12 ? months[monthIndex] : birthMonth;
    return `${monthName} ${birthDay}, ${birthYear}`;
  };

  const formatBirthTime = () => {
    if (!birthHour) return "Not set";
    const hour = birthHour || 12;
    const minute = birthMinute || 0;
    const period = birthPeriod || "PM";
    return `${hour}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const handleSaveField = async (field: string, value: any) => {
    setIsSaving(true);
    try {
      // Update local store based on field
      switch (field) {
        case "name":
          setLocalName(value);
          localStorage.setItem("astrorekha_name", value);
          break;
        case "gender":
          setGender(value);
          break;
        case "birthDate":
          // value is { month, day, year }
          setBirthDate(String(value.month), String(value.day), String(value.year));
          break;
        case "birthPlace":
          setBirthPlace(value);
          break;
        case "birthTime":
          // value is { hour, minute, period }
          setBirthTime(String(value.hour), String(value.minute), value.period);
          break;
      }

      // Save to Supabase
      const userId = localStorage.getItem("astrorekha_user_id");
      if (userId) {
        
        // Determine the new birth details
        const newBirthMonth = field === "birthDate" ? value.month : birthMonth;
        const newBirthDay = field === "birthDate" ? value.day : birthDay;
        const newBirthYear = field === "birthDate" ? value.year : birthYear;
        const newBirthHour = field === "birthTime" ? value.hour : birthHour;
        const newBirthMinute = field === "birthTime" ? value.minute : birthMinute;
        const newBirthPeriod = field === "birthTime" ? value.period : birthPeriod;
        const newBirthPlace = field === "birthPlace" ? value : birthPlace;
        
        // Calculate sun sign from birth date
        const sunSign = newBirthMonth && newBirthDay 
          ? getZodiacSign(Number(newBirthMonth), Number(newBirthDay))
          : null;
        
        // Base update data (snake_case for Supabase)
        const updateData: any = {
          name: field === "name" ? value : localName,
          gender: field === "gender" ? value : gender,
          birth_month: newBirthMonth,
          birth_day: newBirthDay,
          birth_year: newBirthYear,
          birth_place: newBirthPlace,
          birth_hour: newBirthHour,
          birth_minute: newBirthMinute,
          birth_period: newBirthPeriod,
          updated_at: new Date().toISOString(),
        };
        
        // If birth details changed, recalculate signs
        if (field === "birthDate" || field === "birthTime" || field === "birthPlace") {
          // Update sun sign immediately (calculated locally)
          if (sunSign) {
            updateData.sun_sign = sunSign;
          }
          
          // Recalculate moon and ascendant signs via API
          try {
            const response = await fetch("/api/astrology/signs", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": userId,
              },
              body: JSON.stringify({
                birthMonth: newBirthMonth,
                birthDay: newBirthDay,
                birthYear: newBirthYear,
                birthHour: newBirthHour,
                birthMinute: newBirthMinute,
                birthPeriod: newBirthPeriod,
                birthPlace: newBirthPlace,
                forceRefresh: true,
              }),
            });
            const signsData = await response.json();
            if (signsData.success) {
              updateData.sun_sign = signsData.sunSign;
              updateData.moon_sign = signsData.moonSign;
              updateData.ascendant_sign = signsData.ascendant;
              setSigns(signsData.sunSign, signsData.moonSign, signsData.ascendant, true);
              if (signsData.modality) setModality(signsData.modality);
              if (signsData.polarity) setPolarity(signsData.polarity);
            }
          } catch (signsError) {
            console.error("Error recalculating signs:", signsError);
            // Still save the sun sign we calculated locally
          }
        }
        
        await supabase.from("users").update(updateData).eq("id", userId);
        await supabase
          .from("user_profiles")
          .upsert(
            {
              id: userId,
              ...updateData,
            },
            { onConflict: "id" }
          );
      }
      trackAnalyticsEvent("EditProfileAction", {
        route: "/profile/edit",
        action: "field_saved",
        field,
        signs_recalculated: field === "birthDate" || field === "birthTime" || field === "birthPlace",
      });
    } catch (error) {
      console.error("Error saving:", error);
      trackAnalyticsEvent("EditProfileAction", {
        route: "/profile/edit",
        action: "field_save_failed",
        field,
      });
    } finally {
      setIsSaving(false);
      setEditingField(null);
    }
  };

  // Search for location suggestions using OpenStreetMap Nominatim API
  const searchLocation = async (query: string) => {
    if (query.length < 3) {
      setLocationSuggestions([]);
      return;
    }
    
    setIsSearchingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
      );
      const data = await response.json();
      const suggestions = data.map((item: any) => item.display_name);
      setLocationSuggestions(suggestions);
    } catch (error) {
      console.error("Location search error:", error);
      setLocationSuggestions([]);
    } finally {
      setIsSearchingLocation(false);
    }
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
          <div className="flex items-center justify-center px-4 py-3">
            <button
              onClick={() => {
                trackAnalyticsEvent("EditProfileAction", {
                  route: "/profile/edit",
                  action: "back_clicked",
                  destination: "/profile",
                });
                router.push("/profile");
              }}
              className="absolute left-4 w-10 h-10 flex items-center justify-center rounded-lg text-[#b8c7da] transition-colors hover:bg-[#0b2338] hover:text-white"
              aria-label="Back to profile"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-white text-xl font-semibold">Edit Profile</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto relative z-10">
          <div className="px-4 py-6 space-y-3 pb-10">
            {/* Name */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => {
                openEditField("name", localName);
              }}
              className="w-full bg-[#0b2338] rounded-lg p-4 border border-[#173653] text-left transition-colors hover:border-[#38bdf8]/50"
            >
              <p className="text-[#8fa3b8] text-xs mb-1">Name</p>
              <div className="flex items-center justify-between">
                <p className="text-white text-lg font-medium">{localName}</p>
                <ChevronRight className="w-5 h-5 text-[#38bdf8]" />
              </div>
            </motion.button>

            {/* Gender */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              onClick={() => {
                openEditField("gender", gender || "Male");
              }}
              className="w-full bg-[#0b2338] rounded-lg p-4 border border-[#173653] text-left transition-colors hover:border-[#38bdf8]/50"
            >
              <p className="text-[#8fa3b8] text-xs mb-1">Gender</p>
              <div className="flex items-center justify-between">
                <p className="text-white text-lg font-medium">{gender || "Not set"}</p>
                <ChevronRight className="w-5 h-5 text-[#38bdf8]" />
              </div>
            </motion.button>

            {/* Date of Birth */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              onClick={() => openEditField("birthDate")}
              className="w-full bg-[#0b2338] rounded-lg p-4 border border-[#173653] text-left transition-colors hover:border-[#38bdf8]/50"
            >
              <p className="text-[#8fa3b8] text-xs mb-1">Date of birth</p>
              <div className="flex items-center justify-between">
                <p className="text-white text-lg font-medium">{formatBirthDate()}</p>
                <ChevronRight className="w-5 h-5 text-[#38bdf8]" />
              </div>
            </motion.button>

            {/* Place of Birth */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onClick={() => {
                openEditField("birthPlace", birthPlace || "");
              }}
              className="w-full bg-[#0b2338] rounded-lg p-4 border border-[#173653] text-left transition-colors hover:border-[#38bdf8]/50"
            >
              <p className="text-[#8fa3b8] text-xs mb-1">Place of birth</p>
              <div className="flex items-center justify-between">
                <p className="text-white text-lg font-medium line-clamp-1">{birthPlace || "Not set"}</p>
                <ChevronRight className="w-5 h-5 text-[#38bdf8] flex-shrink-0" />
              </div>
            </motion.button>

            {/* Time of Birth */}
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              onClick={() => openEditField("birthTime")}
              className="w-full bg-[#0b2338] rounded-lg p-4 border border-[#173653] text-left transition-colors hover:border-[#38bdf8]/50"
            >
              <p className="text-[#8fa3b8] text-xs mb-1">Time of birth</p>
              <div className="flex items-center justify-between">
                <p className="text-white text-lg font-medium">{formatBirthTime()}</p>
                <ChevronRight className="w-5 h-5 text-[#38bdf8]" />
              </div>
            </motion.button>
          </div>
        </div>

        {/* Edit Modals */}
        <AnimatePresence>
          {editingField === "name" && (
            <EditTextModal
              title="Name"
              value={tempValue}
              onChange={setTempValue}
              onSave={() => handleSaveField("name", tempValue)}
              onClose={() => setEditingField(null)}
              isSaving={isSaving}
            />
          )}
          {editingField === "birthPlace" && (
            <LocationSearchModal
              value={tempValue}
              onChange={setTempValue}
              onSave={() => handleSaveField("birthPlace", tempValue)}
              onClose={() => setEditingField(null)}
              isSaving={isSaving}
              onSearch={searchLocation}
              suggestions={locationSuggestions}
              isSearching={isSearchingLocation}
            />
          )}
          {editingField === "gender" && (
            <SelectModal
              title="Gender"
              options={genderOptions}
              selected={tempValue}
              onSelect={(val) => {
                setTempValue(val);
                handleSaveField("gender", val);
              }}
              onClose={() => setEditingField(null)}
            />
          )}
          {editingField === "birthDate" && (
            <DatePickerModal
              month={birthMonth}
              day={birthDay}
              year={birthYear}
              onSave={(m, d, y) => handleSaveField("birthDate", { month: m, day: d, year: y })}
              onClose={() => setEditingField(null)}
              isSaving={isSaving}
            />
          )}
          {editingField === "birthTime" && (
            <TimePickerModal
              hour={Number(birthHour) || 12}
              minute={Number(birthMinute) || 0}
              period={birthPeriod}
              onSave={(h, m, p) => handleSaveField("birthTime", { hour: h, minute: m, period: p })}
              onClose={() => setEditingField(null)}
              isSaving={isSaving}
            />
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}

// Edit Text Modal Component
function EditTextModal({ title, value, onChange, onSave, onClose, isSaving }: {
  title: string;
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  return (
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
        className="bg-[#0b2338] rounded-lg w-full max-w-sm p-6 border border-[#173653]"
      >
        <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-[#061525] border border-[#173653] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#38bdf8]"
          autoFocus
        />
        <div className="flex gap-3 mt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-[#173653] text-white hover:bg-[#082035]"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 bg-[#38bdf8] hover:bg-[#0284c7] text-black"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Location Search Modal Component
function LocationSearchModal({ value, onChange, onSave, onClose, isSaving, onSearch, suggestions, isSearching }: {
  value: string;
  onChange: (val: string) => void;
  onSave: () => void;
  onClose: () => void;
  isSaving: boolean;
  onSearch: (query: string) => void;
  suggestions: string[];
  isSearching: boolean;
}) {
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const handleInputChange = (val: string) => {
    onChange(val);
    
    // Debounce search
    if (searchTimeout) clearTimeout(searchTimeout);
    const timeout = setTimeout(() => {
      onSearch(val);
    }, 300);
    setSearchTimeout(timeout);
  };

  return (
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
        className="bg-[#0b2338] rounded-lg w-full max-w-sm p-6 border border-[#173653]"
      >
        <h2 className="text-white text-xl font-bold mb-4">Place of Birth</h2>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#8fa3b8]" />
          <input
            type="text"
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search for a location..."
            className="w-full bg-[#061525] border border-[#173653] rounded-lg pl-10 pr-10 py-3 text-white focus:outline-none focus:border-[#38bdf8]"
            autoFocus
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#38bdf8] animate-spin" />
          )}
        </div>
        
        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  onChange(suggestion);
                  onSearch(""); // Clear suggestions
                }}
                className="w-full p-3 bg-[#061525] rounded-lg text-left text-white/80 text-sm hover:bg-[#082035] transition-colors"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-[#38bdf8] mt-0.5 flex-shrink-0" />
                  <span className="line-clamp-2">{suggestion}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        
        <div className="flex gap-3 mt-4">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-[#173653] text-white hover:bg-[#082035]"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 bg-[#38bdf8] hover:bg-[#0284c7] text-black"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Select Modal Component
function SelectModal({ title, options, selected, onSelect, onClose }: {
  title: string;
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
  onClose: () => void;
}) {
  return (
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
        className="bg-[#0b2338] rounded-lg w-full max-w-sm p-6 border border-[#173653]"
      >
        <h2 className="text-white text-xl font-bold mb-4">{title}</h2>
        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={option}
              onClick={() => onSelect(option)}
              className={`w-full p-3 rounded-lg text-left transition-colors ${
                selected === option
                  ? "bg-[#38bdf8] text-black"
                  : "bg-[#061525] text-white hover:bg-[#082035]"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// Date Picker Modal
function DatePickerModal({ month, day, year, onSave, onClose, isSaving }: {
  month: string | number | null;
  day: string | number | null;
  year: string | number | null;
  onSave: (m: string | number, d: string | number, y: string | number) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [m, setM] = useState(Number(month) || 1);
  const [d, setD] = useState(Number(day) || 1);
  const [y, setY] = useState(Number(year) || 1990);

  const months = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];

  return (
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
        className="bg-[#0b2338] rounded-lg w-full max-w-sm p-6 border border-[#173653]"
      >
        <h2 className="text-white text-xl font-bold mb-4">Date of Birth</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <select
            value={m}
            onChange={(e) => setM(Number(e.target.value))}
            className="bg-[#061525] border border-[#173653] rounded-lg px-2 py-3 text-white text-sm"
          >
            {months.map((month, i) => (
              <option key={month} value={i + 1}>{month}</option>
            ))}
          </select>
          <select
            value={d}
            onChange={(e) => setD(Number(e.target.value))}
            className="bg-[#061525] border border-[#173653] rounded-lg px-2 py-3 text-white text-sm"
          >
            {Array.from({ length: 31 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
          <select
            value={y}
            onChange={(e) => setY(Number(e.target.value))}
            className="bg-[#061525] border border-[#173653] rounded-lg px-2 py-3 text-white text-sm"
          >
            {Array.from({ length: 100 }, (_, i) => (
              <option key={2024 - i} value={2024 - i}>{2024 - i}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-[#173653] text-white hover:bg-[#082035]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave(m, d, y)}
            disabled={isSaving}
            className="flex-1 bg-[#38bdf8] hover:bg-[#0284c7] text-black"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Time Picker Modal
function TimePickerModal({ hour, minute, period, onSave, onClose, isSaving }: {
  hour: number | null;
  minute: number | null;
  period: string | null;
  onSave: (h: number, m: number, p: string) => void;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [h, setH] = useState(hour || 12);
  const [m, setM] = useState(minute || 0);
  const [p, setP] = useState(period || "PM");

  return (
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
        className="bg-[#0b2338] rounded-lg w-full max-w-sm p-6 border border-[#173653]"
      >
        <h2 className="text-white text-xl font-bold mb-4">Time of Birth</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <select
            value={h}
            onChange={(e) => setH(Number(e.target.value))}
            className="bg-[#061525] border border-[#173653] rounded-lg px-2 py-3 text-white text-sm"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}</option>
            ))}
          </select>
          <select
            value={m}
            onChange={(e) => setM(Number(e.target.value))}
            className="bg-[#061525] border border-[#173653] rounded-lg px-2 py-3 text-white text-sm"
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i} value={i}>{String(i).padStart(2, '0')}</option>
            ))}
          </select>
          <select
            value={p}
            onChange={(e) => setP(e.target.value)}
            className="bg-[#061525] border border-[#173653] rounded-lg px-2 py-3 text-white text-sm"
          >
            <option value="AM">AM</option>
            <option value="PM">PM</option>
          </select>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-[#173653] text-white hover:bg-[#082035]"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave(h, m, p)}
            disabled={isSaving}
            className="flex-1 bg-[#38bdf8] hover:bg-[#0284c7] text-black"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
