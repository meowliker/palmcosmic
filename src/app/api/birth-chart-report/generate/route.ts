import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { generateBirthChartReport } from "@/lib/birth-chart-report-generator";
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
  const monthRaw =
    userProfile?.birth_month ||
    user?.birth_month ||
    "";
  const dayRaw =
    userProfile?.birth_day ||
    user?.birth_day ||
    "";
  const yearRaw =
    userProfile?.birth_year ||
    user?.birth_year ||
    "";

  if (!monthRaw || !dayRaw || !yearRaw) {
    return null;
  }

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

function getBirthDateFromProfile(userProfile: AnyRecord | null, user: AnyRecord | null): string | null {
  const monthRaw = userProfile?.birth_month || user?.birth_month || "";
  const dayRaw = userProfile?.birth_day || user?.birth_day || "";
  const yearRaw = userProfile?.birth_year || user?.birth_year || "";
  if (!monthRaw || !dayRaw || !yearRaw) return null;

  const month = getMonthNumber(String(monthRaw));
  const day = parseInt(String(dayRaw), 10) || 1;
  const year = parseInt(String(yearRaw), 10) || 2000;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getBirthTimeFromProfile(userProfile: AnyRecord | null, user: AnyRecord | null): string {
  const knowsBirthTime =
    userProfile?.knows_birth_time !== undefined
      ? !!userProfile.knows_birth_time
      : user?.knows_birth_time !== undefined
        ? !!user.knows_birth_time
        : true;

  if (!knowsBirthTime) return "12:00";

  return to24HourTime(
    String(userProfile?.birth_hour || user?.birth_hour || "12"),
    String(userProfile?.birth_minute || user?.birth_minute || "00"),
    String(userProfile?.birth_period || user?.birth_period || "PM")
  );
}

async function upsertBirthChartUserLink(
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  birthChartId: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error } = await supabaseAdmin
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
    console.error("[birth-chart-report/generate] failed to upsert birth_chart_user_links", error);
  }
}

function getSessionUserId(request: NextRequest, fallbackUserId?: string | null): string | null {
  const accessCookie = request.cookies.get("ar_access")?.value;

  // Backward/forward compatible: if cookie ever stores user id, use it; otherwise use x-user-id.
  if (accessCookie && accessCookie !== "1" && accessCookie.trim()) {
    return accessCookie.trim();
  }

  const headerUserId = request.headers.get("x-user-id")?.trim();
  if (headerUserId) return headerUserId;

  const queryUserId = request.nextUrl.searchParams.get("userId")?.trim();
  if (queryUserId) return queryUserId;

  return fallbackUserId?.trim() || null;
}

function hasKnownBirthTime(userProfile: AnyRecord | null, user: AnyRecord | null): boolean {
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

function isSameUtcDay(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

async function hydrateBirthChartFromApi(
  request: NextRequest,
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  userProfile: AnyRecord | null,
  user: AnyRecord | null,
  cacheKey: string
): Promise<AnyRecord | null> {
  const birthDate = getBirthDateFromProfile(userProfile, user);
  if (!birthDate) return null;

  const birthTime = getBirthTimeFromProfile(userProfile, user);
  const birthPlace = String(userProfile?.birth_place || user?.birth_place || "").trim();

  let latitude = 28.6139;
  let longitude = 77.209;
  let timezone = 5.5;

  try {
    if (birthPlace) {
      const geoRes = await fetch(`${request.nextUrl.origin}/api/astrology/geo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ place_name: birthPlace }),
        cache: "no-store",
      });

      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (geo?.success && geo?.data) {
          latitude = Number(geo.data.latitude) || latitude;
          longitude = Number(geo.data.longitude) || longitude;
          timezone = Number(geo.data.timezone) || timezone;
        }
      }
    }

    const chartRes = await fetch(`${request.nextUrl.origin}/api/astrology/birth-chart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birthDate,
        birthTime,
        latitude,
        longitude,
        timezone,
        chartType: "vedic",
      }),
      cache: "no-store",
    });

    if (!chartRes.ok) return null;
    const chartJson = await chartRes.json();
    if (!chartJson?.success || !chartJson?.data) return null;

    const data = {
      ...chartJson.data,
      userBirthDetails: {
        date: birthDate,
        time: birthTime,
        place: birthPlace || "Unknown",
      },
      cachedAt: new Date().toISOString(),
    };

    await supabaseAdmin
      .from("birth_charts")
      .upsert(
        {
          id: cacheKey,
          data,
          cached_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    await upsertBirthChartUserLink(supabaseAdmin, userId, cacheKey);
    return { id: cacheKey, data };
  } catch (error) {
    console.error("[birth-chart-report/generate] chart hydration failed", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  const requestBody = await request
    .json()
    .catch(() => ({} as { force?: boolean; userId?: string }));
  const userId = getSessionUserId(request, requestBody?.userId);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  try {
    const force = !!requestBody?.force;

    const { data: userProfile } = await supabaseAdmin
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!hasKnownBirthTime(userProfile || null, user || null)) {
      return NextResponse.json({ error: "birth_time_required" }, { status: 400 });
    }

    const birthChartCacheKey = makeBirthChartCacheKey(userProfile || null, user || null);

    const { data: existingComplete } = await supabaseAdmin
      .from("birth_chart_reports")
      .select("id, birth_chart_id, status, sections, generated_at, created_at")
      .eq("user_id", userId)
      .eq("status", "complete")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingComplete && (!birthChartCacheKey || existingComplete.birth_chart_id === birthChartCacheKey)) {
      await linkReportToUser({
        supabase: supabaseAdmin,
        userId,
        reportKey: "birth_chart",
        reportId: String(existingComplete.id),
      });

      return NextResponse.json({
        report_id: existingComplete.id,
        status: existingComplete.status,
        sections: existingComplete.sections || {},
        generated_at: existingComplete.generated_at || new Date().toISOString(),
        reused: true,
      });
    }

    if (force && existingComplete?.created_at) {
      const generatedAt = new Date(existingComplete.generated_at || existingComplete.created_at);
      if (isSameUtcDay(generatedAt, new Date())) {
        return NextResponse.json(
          {
            error: "refresh_limit_reached",
            message: "You can refresh your birth chart report once per day.",
            nextAvailable: new Date(
              Date.UTC(
                generatedAt.getUTCFullYear(),
                generatedAt.getUTCMonth(),
                generatedAt.getUTCDate() + 1,
                0,
                0,
                0,
                0
              )
            ).toISOString(),
          },
          { status: 429 }
        );
      }
    }

    if (!force && existingComplete && existingComplete.birth_chart_id !== birthChartCacheKey) {
      // Birth details changed. Continue into generation so the report matches the latest profile.
    }

    if (!force && !existingComplete) {
      const { data: pendingOrComplete } = await supabaseAdmin
        .from("birth_chart_reports")
        .select("id, birth_chart_id, status, sections, generated_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingOrComplete?.status === "complete" && (!birthChartCacheKey || pendingOrComplete.birth_chart_id === birthChartCacheKey)) {
        await linkReportToUser({
          supabase: supabaseAdmin,
          userId,
          reportKey: "birth_chart",
          reportId: String(pendingOrComplete.id),
        });

        return NextResponse.json({
          report_id: pendingOrComplete.id,
          status: pendingOrComplete.status,
          sections: pendingOrComplete.sections || {},
          generated_at: pendingOrComplete.generated_at || new Date().toISOString(),
          reused: true,
        });
      }
    }

    let birthChart: AnyRecord | null = null;

    if (birthChartCacheKey) {
      const { data } = await supabaseAdmin
        .from("birth_charts")
        .select("*")
        .eq("id", birthChartCacheKey)
        .maybeSingle();
      birthChart = data;
    }

    if (!birthChart && birthChartCacheKey) {
      birthChart = await hydrateBirthChartFromApi(
        request,
        supabaseAdmin,
        userId,
        userProfile || null,
        user || null,
        birthChartCacheKey
      );
    }

    if (birthChart?.id) {
      await upsertBirthChartUserLink(supabaseAdmin, userId, String(birthChart.id));
    }

    const { data: natalChart } = await supabaseAdmin
      .from("natal_charts")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const chartData = {
      ...(natalChart || {}),
      ...(birthChart || {}),
    };

    if (!birthChart && !natalChart) {
      return NextResponse.json({ error: "no_birth_chart_found" }, { status: 404 });
    }

    let reportId: string | null = null;

    if (!force) {
      const { data: pendingReport } = await supabaseAdmin
        .from("birth_chart_reports")
        .select("id")
        .eq("user_id", userId)
        .neq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingReport?.id) {
        reportId = String(pendingReport.id);
        const { error: reuseError } = await supabaseAdmin
          .from("birth_chart_reports")
          .update({
            birth_chart_id: birthChart?.id || null,
            status: "generating",
          })
          .eq("id", reportId);

        if (reuseError) {
          console.error("[birth-chart-report/generate] failed to reuse pending report row", reuseError);
          return NextResponse.json({ error: "generation_failed" }, { status: 500 });
        }
      }
    }

    if (!reportId) {
      const { data: insertedReport, error: insertError } = await supabaseAdmin
        .from("birth_chart_reports")
        .insert({
          user_id: userId,
          birth_chart_id: birthChart?.id || null,
          status: "generating",
        })
        .select("id")
        .single();

      if (insertError || !insertedReport?.id) {
        console.error("[birth-chart-report/generate] failed to create report row", insertError);
        return NextResponse.json({ error: "generation_failed" }, { status: 500 });
      }

      reportId = String(insertedReport.id);
    }

    await linkReportToUser({
      supabase: supabaseAdmin,
      userId,
      reportKey: "birth_chart",
      reportId,
    });

    try {
      const generated = await generateBirthChartReport(chartData, userProfile || {}, user || {});

      const { error: updateError } = await supabaseAdmin
        .from("birth_chart_reports")
        .update({
          status: "complete",
          sections: generated.sections,
          generated_at: new Date().toISOString(),
        })
        .eq("id", reportId);

      if (updateError) {
        console.error("[birth-chart-report/generate] failed to update report row", updateError);
        return NextResponse.json({ error: "generation_failed" }, { status: 500 });
      }

      return NextResponse.json({
        report_id: reportId,
        status: "complete",
        sections: generated.sections,
        generated_at: new Date().toISOString(),
      });
    } catch (generationError) {
      console.error("[birth-chart-report/generate] generation failed", generationError);
      await supabaseAdmin
        .from("birth_chart_reports")
        .update({ status: "failed" })
        .eq("id", reportId);

      return NextResponse.json({ error: "generation_failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("[birth-chart-report/generate] error", error);
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }
}
