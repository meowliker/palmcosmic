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

export async function GET(request: NextRequest) {
  const userId = getSessionUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: userProfile }, { data: user }] = await Promise.all([
    supabaseAdmin
      .from("user_profiles")
      .select("knows_birth_time, birth_hour, birth_minute")
      .eq("id", userId)
      .maybeSingle(),
    supabaseAdmin
      .from("users")
      .select("knows_birth_time, birth_hour, birth_minute")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (!hasKnownBirthTime(userProfile || null, user || null)) {
    return NextResponse.json({ status: "needs_birth_time", error: "birth_time_required" });
  }

  const { data: latestReport, error } = await supabaseAdmin
    .from("birth_chart_reports")
    .select("id, status, generated_at, created_at")
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
