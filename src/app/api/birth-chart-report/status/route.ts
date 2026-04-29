import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { linkReportToUser } from "@/lib/user-report-links";

function getSessionUserId(request: NextRequest, fallbackUserId?: string | null): string | null {
  const accessCookie = request.cookies.get("ar_access")?.value;
  if (accessCookie && accessCookie !== "1" && accessCookie.trim()) {
    return accessCookie.trim();
  }

  const headerUserId = request.headers.get("x-user-id")?.trim();
  if (headerUserId) return headerUserId;

  const queryUserId = request.nextUrl.searchParams.get("userId")?.trim();
  if (queryUserId) return queryUserId;

  return fallbackUserId?.trim() || null;
}

function hasKnownBirthTime(userProfile: Record<string, any> | null, user: Record<string, any> | null): boolean {
  if (userProfile && "knows_birth_time" in userProfile) {
    return userProfile.knows_birth_time === true;
  }
  if (user && "knows_birth_time" in user) {
    return user.knows_birth_time === true;
  }
  return !!(
    userProfile?.birth_hour ||
    userProfile?.birth_minute ||
    user?.birth_hour ||
    user?.birth_minute
  );
}

function getMonthNumber(month: string): number {
  const monthMap: Record<string, number> = {
    january: 1,
    february: 2,
    march: 3,
    april: 4,
    may: 5,
    june: 6,
    july: 7,
    august: 8,
    september: 9,
    october: 10,
    november: 11,
    december: 12,
  };
  const trimmed = String(month || "").trim().toLowerCase();
  if (monthMap[trimmed]) return monthMap[trimmed];
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) && numeric >= 1 && numeric <= 12 ? numeric : 1;
}

function to24HourTime(hour: string, minute: string, period: string): string {
  let h = parseInt(String(hour || "12"), 10);
  const m = String(minute || "00").padStart(2, "0");
  const p = String(period || "PM").toUpperCase();
  if (!Number.isFinite(h) || h < 1 || h > 12) h = 12;
  if (p === "PM" && h !== 12) h += 12;
  if (p === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

function makeBirthChartCacheKey(userProfile: Record<string, any> | null, user: Record<string, any> | null): string | null {
  const monthRaw = userProfile?.birth_month || user?.birth_month || "";
  const dayRaw = userProfile?.birth_day || user?.birth_day || "";
  const yearRaw = userProfile?.birth_year || user?.birth_year || "";
  if (!monthRaw || !dayRaw || !yearRaw) return null;

  const month = getMonthNumber(String(monthRaw));
  const day = parseInt(String(dayRaw), 10) || 1;
  const year = parseInt(String(yearRaw), 10) || 2000;
  const knowsBirthTime =
    userProfile?.knows_birth_time !== undefined
      ? !!userProfile.knows_birth_time
      : user?.knows_birth_time !== undefined
        ? !!user.knows_birth_time
        : true;
  const birthTime = knowsBirthTime
    ? to24HourTime(
        String(userProfile?.birth_hour || user?.birth_hour || "12"),
        String(userProfile?.birth_minute || user?.birth_minute || "00"),
        String(userProfile?.birth_period || user?.birth_period || "PM")
      )
    : "12:00";
  const birthDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const birthPlace = String(userProfile?.birth_place || user?.birth_place || "unknown");
  const base = `chart_${birthDate}_${birthTime}_${birthPlace}`.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${base}_vedic`;
}

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: userProfile }, { data: user }] = await Promise.all([
    supabaseAdmin
      .from("user_profiles")
      .select("knows_birth_time, birth_month, birth_day, birth_year, birth_hour, birth_minute, birth_period, birth_place")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("knows_birth_time, birth_month, birth_day, birth_year, birth_hour, birth_minute, birth_period, birth_place")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (!hasKnownBirthTime(userProfile || null, user || null)) {
    return NextResponse.json({ status: "needs_birth_time", error: "birth_time_required" });
  }

  const { data: latestReport, error } = await supabaseAdmin
    .from("birth_chart_reports")
    .select("id, birth_chart_id, status, generated_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[birth-chart-report/status] error", error);
    if (error.code === "PGRST205") {
      return NextResponse.json({
        status: "setup_required",
        error: "birth_chart_reports_missing",
      });
    }
    return NextResponse.json({ error: "status_fetch_failed" }, { status: 500 });
  }

  if (!latestReport) {
    return NextResponse.json({ status: "not_started" });
  }

  const currentBirthChartId = makeBirthChartCacheKey(userProfile || null, user || null);
  if (
    latestReport.status === "complete" &&
    currentBirthChartId &&
    latestReport.birth_chart_id !== currentBirthChartId
  ) {
    return NextResponse.json({
      status: "not_started",
      reason: "birth_details_changed",
      previous_report_id: latestReport.id,
    });
  }

  await linkReportToUser({
    supabase: supabaseAdmin,
    userId,
    reportKey: "birth_chart",
    reportId: String(latestReport.id),
  });

  return NextResponse.json({
    report_id: latestReport.id,
    status: latestReport.status,
    generated_at: latestReport.generated_at,
  });
}
