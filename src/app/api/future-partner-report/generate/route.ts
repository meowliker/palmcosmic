import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateFuturePartnerReport } from "@/lib/future-partner-report";
import { normalizeUnlockedFeatures } from "@/lib/unlocked-features";
import { linkReportToUser } from "@/lib/user-report-links";

export const maxDuration = 60;

type AnyRecord = Record<string, any>;

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
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
    return numeric;
  }

  return 1;
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

function makeBirthChartCacheKey(userProfile: AnyRecord | null, user: AnyRecord | null): string | null {
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

async function upsertBirthChartUserLink(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  birthChartId: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("birth_chart_user_links")
    .upsert(
      {
        user_id: userId,
        birth_chart_id: birthChartId,
        updated_at: nowIso,
        last_accessed_at: nowIso,
      },
      { onConflict: "user_id,birth_chart_id" }
    );

  if (error) {
    console.error("[future-partner/generate] failed to upsert birth_chart_user_links", error);
  }
}

function getPublicErrorMessage(raw: unknown): string {
  const message = String((raw as any)?.message || "").toLowerCase();
  if (
    message.includes("overloaded_error") ||
    message.includes("overloaded") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("529")
  ) {
    return "Prediction service is busy right now. Please try again in 30-60 seconds.";
  }
  return "Failed to generate report. Please try again.";
}

function getSessionUserId(request: NextRequest): string | null {
  const accessCookie = request.cookies.get("ar_access")?.value;
  if (!accessCookie) return null;

  if (accessCookie !== "1" && accessCookie.trim()) {
    return accessCookie.trim();
  }

  const headerUserId = request.headers.get("x-user-id")?.trim();
  if (headerUserId) return headerUserId;

  const queryUserId = request.nextUrl.searchParams.get("userId")?.trim();
  if (queryUserId) return queryUserId;

  return null;
}

export async function POST(request: NextRequest) {
  const userId = getSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  const unlocked = normalizeUnlockedFeatures(user.unlocked_features);
  if (!unlocked.futurePartnerReport) {
    return NextResponse.json({ error: "feature_locked" }, { status: 403 });
  }

  const { data: existingRow, error: existingError } = await supabase
    .from("future_partner_reports")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    console.error("[future-partner/generate] existing row error", existingError);
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }

  if (existingRow?.status === "complete" && existingRow?.report_data) {
    if (existingRow.id) {
      await linkReportToUser({
        supabase,
        userId,
        reportKey: "future_partner",
        reportId: String(existingRow.id),
        email: user.email,
      });
    }

    return NextResponse.json({
      success: true,
      cached: true,
      report: existingRow.report_data,
      generated_at: existingRow.generated_at,
      status: "complete",
    });
  }

  const nowIso = new Date().toISOString();

  const { data: userProfileById } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  let userProfile = userProfileById;
  if (!userProfile) {
    const { data: userProfileByUserId } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    userProfile = userProfileByUserId;
  }

  const birthChartCacheKey = makeBirthChartCacheKey(userProfile || null, user || null);

  let birthChart: AnyRecord | null = null;
  const { data: linkedBirthChart } = await supabase
    .from("birth_chart_user_links")
    .select("birth_chart_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (linkedBirthChart?.birth_chart_id) {
    const { data } = await supabase
      .from("birth_charts")
      .select("*")
      .eq("id", linkedBirthChart.birth_chart_id)
      .maybeSingle();
    birthChart = data;
  }

  if (!birthChart && birthChartCacheKey) {
    const { data } = await supabase
      .from("birth_charts")
      .select("*")
      .eq("id", birthChartCacheKey)
      .maybeSingle();
    birthChart = data;
  }

  if (birthChart?.id) {
    await upsertBirthChartUserLink(supabase, userId, String(birthChart.id));
  }

  const { data: natalChart } = await supabase
    .from("natal_charts")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const chartData = {
    ...(natalChart || {}),
    ...(birthChart || {}),
  };

  const { error: upsertError } = await supabase
    .from("future_partner_reports")
    .upsert(
      {
        user_id: userId,
        status: "generating",
        report_data: existingRow?.report_data || {},
        created_at: existingRow?.created_at || nowIso,
        updated_at: nowIso,
      },
      { onConflict: "user_id" }
    );

  if (upsertError) {
    console.error("[future-partner/generate] upsert error", upsertError);
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }

  try {
    const report = await generateFuturePartnerReport({
      user,
      userProfile,
      chartData,
    });

    const generatedAt = new Date().toISOString();

    const { data: completed, error: completeError } = await supabase
      .from("future_partner_reports")
      .update({
        status: "complete",
        report_data: report,
        generated_at: generatedAt,
        updated_at: generatedAt,
      })
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (completeError || !completed) {
      console.error("[future-partner/generate] complete update error", completeError);
      return NextResponse.json({ error: "generation_failed" }, { status: 500 });
    }

    await linkReportToUser({
      supabase,
      userId,
      reportKey: "future_partner",
      reportId: String(completed.id),
      email: user.email,
    });

    return NextResponse.json({
      success: true,
      status: "complete",
      report: completed.report_data,
      generated_at: completed.generated_at,
    });
  } catch (error: any) {
    console.error("[future-partner/generate] provider error", error);

    await supabase
      .from("future_partner_reports")
      .update({
        status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return NextResponse.json(
      {
        error: "generation_failed",
        message: getPublicErrorMessage(error),
      },
      { status: 500 }
    );
  }
}
