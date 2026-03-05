import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Horoscope API - ohmanda.com (free, reliable)
const OHMANDA_API_URL = "https://ohmanda.com/api/horoscope";

const ZODIAC_SIGNS = [
  "aries", "taurus", "gemini", "cancer", "leo", "virgo",
  "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"
];

// Get the current date in YYYY-MM-DD format (UTC to ensure consistency)
function getDateKey(offset: number = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Get the current week number (UTC)
function getWeekKey(): string {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const diff = now.getTime() - start.getTime();
  const oneWeek = 1000 * 60 * 60 * 24 * 7;
  const weekNum = Math.floor(diff / oneWeek);
  return `${now.getUTCFullYear()}-W${weekNum}`;
}

// Get the current month key (UTC)
function getMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Fetch horoscope from ohmanda.com API (free, reliable)
// Note: This API only provides daily horoscope, same content used for all periods
async function fetchHoroscopeFromAPI(sign: string, period: string, day: string = "TODAY") {
  // ohmanda.com API - simple GET request, returns { sign, date, horoscope }
  const response = await fetch(`${OHMANDA_API_URL}/${sign.toLowerCase()}/`, {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Horoscope API request failed: ${response.status}`);
  }

  const data = await response.json();
  
  // ohmanda.com response format: { sign, date, horoscope }
  return {
    data: {
      horoscope_data: data.horoscope || "",
      horoscope_sections: undefined,
      date: data.date || new Date().toISOString().split("T")[0],
      lucky_number: null,
      lucky_color: null,
      mood: null,
      compatibility: null,
    }
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sign = searchParams.get("sign")?.toLowerCase();
  const period = searchParams.get("period") || "daily";
  const day = searchParams.get("day") || "TODAY"; // TODAY or TOMORROW

  if (!sign || !ZODIAC_SIGNS.includes(sign)) {
    return NextResponse.json(
      { success: false, error: "Valid sign is required" },
      { status: 400 }
    );
  }

  try {
    // Determine the cache key based on period
    let cacheKey = "";
    let cacheDocId = "";
    let apiDay = "TODAY";
    
    switch (period) {
      case "weekly":
        cacheKey = getWeekKey();
        cacheDocId = `horoscope_weekly_${sign}_${cacheKey}`;
        break;
      case "monthly":
        cacheKey = getMonthKey();
        cacheDocId = `horoscope_monthly_${sign}_${cacheKey}`;
        break;
      case "daily":
      default:
        // For daily, use different cache keys for TODAY vs TOMORROW
        if (day === "TOMORROW") {
          cacheKey = getDateKey(1); // Tomorrow's date
          apiDay = "TOMORROW";
        } else {
          cacheKey = getDateKey(0); // Today's date
          apiDay = "TODAY";
        }
        cacheDocId = `horoscope_daily_${sign}_${cacheKey}`;
        break;
    }

    // Try to get cached horoscope from Supabase
    const { data: cachedRow } = await supabase.from("horoscope_cache").select("*").eq("id", cacheDocId).single();
    
    if (cachedRow) {
      return NextResponse.json({
        success: true,
        data: cachedRow.horoscope,
        period,
        sign,
        day: apiDay,
        cached: true,
        cacheKey,
      });
    }

    // No cache found - fetch from API
    const apiResponse = await fetchHoroscopeFromAPI(sign, period, apiDay);
    const horoscopeData = apiResponse.data;
    
    // Ensure horoscope_data exists
    const normalizedData = {
      horoscope_data: horoscopeData?.horoscope_data || "",
      horoscope_sections: horoscopeData?.horoscope_sections || undefined,
      lucky_number: horoscopeData?.lucky_number || null,
      lucky_color: horoscopeData?.lucky_color || null,
      mood: horoscopeData?.mood || null,
      compatibility: horoscopeData?.compatibility || null,
    };

    // Save to Supabase cache (non-blocking to speed up response)
    (async () => {
      try {
        await supabase.from("horoscope_cache").upsert({
          id: cacheDocId,
          horoscope: normalizedData,
          sign,
          period,
          cache_key: cacheKey,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "id" });
      } catch (e) {
        // Ignore cache errors
      }
    })();

    return NextResponse.json({
      success: true,
      data: normalizedData,
      period,
      sign,
      cached: false,
      cacheKey,
    });
  } catch (error) {
    console.error("Horoscope API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch horoscope data" },
      { status: 500 }
    );
  }
}

// POST endpoint to pre-fetch horoscopes for all signs (can be called by a cron job)
export async function POST(request: NextRequest) {
  try {
    const { period = "daily", prefetchTomorrow = false } = await request.json();
    
    const results: Record<string, boolean> = {};
    
    for (const sign of ZODIAC_SIGNS) {
      try {
        // Determine cache key
        let cacheKey = "";
        let cacheDocId = "";
        let day = "TODAY";
        
        switch (period) {
          case "weekly":
            cacheKey = getWeekKey();
            cacheDocId = `horoscope_weekly_${sign}_${cacheKey}`;
            break;
          case "monthly":
            cacheKey = getMonthKey();
            cacheDocId = `horoscope_monthly_${sign}_${cacheKey}`;
            break;
          case "daily":
          default:
            if (prefetchTomorrow) {
              cacheKey = getDateKey(1); // Tomorrow
              day = "TOMORROW";
            } else {
              cacheKey = getDateKey();
            }
            cacheDocId = `horoscope_daily_${sign}_${cacheKey}`;
            break;
        }

        // Check if already cached
        const { data: existing } = await supabase.from("horoscope_cache").select("id").eq("id", cacheDocId).single();
        if (existing) {
          results[sign] = true; // Already cached
          continue;
        }

        // Fetch and cache
        const apiResponse = await fetchHoroscopeFromAPI(sign, period, day);
        await supabase.from("horoscope_cache").upsert({
          id: cacheDocId,
          horoscope: apiResponse.data,
          sign,
          period,
          cache_key: cacheKey,
          fetched_at: new Date().toISOString(),
        }, { onConflict: "id" });
        
        results[sign] = true;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Failed to fetch horoscope for ${sign}:`, err);
        results[sign] = false;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Pre-fetched ${period} horoscopes`,
      results,
    });
  } catch (error) {
    console.error("Horoscope prefetch error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to prefetch horoscopes" },
      { status: 500 }
    );
  }
}
