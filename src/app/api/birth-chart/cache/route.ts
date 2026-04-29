import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = clean(request.nextUrl.searchParams.get("userId"));
    const cacheKey = clean(request.nextUrl.searchParams.get("cacheKey"));
    const supabase = getSupabaseAdmin();

    if (userId) {
      const { data: user } = await supabase
        .from("users")
        .select("birth_month,birth_day,birth_year,birth_hour,birth_minute,birth_period,birth_place,knows_birth_time")
        .eq("id", userId)
        .maybeSingle();
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("birth_month,birth_day,birth_year,birth_hour,birth_minute,birth_period,birth_place,knows_birth_time")
        .eq("id", userId)
        .maybeSingle();
      const { data: link } = await supabase
        .from("birth_chart_user_links")
        .select("birth_chart_id")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      let linkedChart = null;
      if (link?.birth_chart_id) {
        const { data } = await supabase
          .from("birth_charts")
          .select("id,data")
          .eq("id", link.birth_chart_id)
          .maybeSingle();
        linkedChart = data || null;
      }

      return NextResponse.json({ success: true, user, profile, linkedChart });
    }

    if (cacheKey) {
      const { data, error } = await supabase
        .from("birth_charts")
        .select("id,data")
        .eq("id", cacheKey)
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ success: true, chart: data || null });
    }

    return NextResponse.json({ success: false, error: "userId or cacheKey is required" }, { status: 400 });
  } catch (error: any) {
    console.error("[birth-chart/cache] GET error:", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to load birth chart cache" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = clean(body.userId);
    const cacheKey = clean(body.cacheKey);
    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    if (body.action === "link" && userId && cacheKey) {
      const { error } = await supabase
        .from("birth_chart_user_links")
        .upsert(
          { user_id: userId, birth_chart_id: cacheKey, updated_at: nowIso, last_accessed_at: nowIso },
          { onConflict: "user_id,birth_chart_id" }
        );
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (body.action === "birth_profile" && userId) {
      const patch = {
        birth_month: body.birthMonth || null,
        birth_day: body.birthDay || null,
        birth_year: body.birthYear || null,
        birth_hour: body.birthHour || null,
        birth_minute: body.birthMinute || null,
        birth_period: body.birthPeriod || null,
        birth_place: body.birthPlace || null,
        knows_birth_time: body.knowsBirthTime ?? true,
        updated_at: nowIso,
      };
      const [profileResult, userResult] = await Promise.all([
        supabase.from("user_profiles").upsert({ id: userId, ...patch }, { onConflict: "id" }),
        supabase.from("users").upsert({ id: userId, ...patch }, { onConflict: "id" }),
      ]);
      const error = profileResult.error || userResult.error;
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (cacheKey && body.data) {
      const { error } = await supabase
        .from("birth_charts")
        .upsert({ id: cacheKey, data: body.data, cached_at: nowIso }, { onConflict: "id" });
      if (error) throw error;
      if (userId) {
        await supabase
          .from("birth_chart_user_links")
          .upsert(
            { user_id: userId, birth_chart_id: cacheKey, updated_at: nowIso, last_accessed_at: nowIso },
            { onConflict: "user_id,birth_chart_id" }
          );
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  } catch (error: any) {
    console.error("[birth-chart/cache] POST error:", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to save birth chart cache" }, { status: 500 });
  }
}
