import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type FuturePartnerAnswers = Record<string, string>;

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeAnswers(raw: unknown): FuturePartnerAnswers {
  if (!raw || typeof raw !== "object") return {};

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, value]) => typeof value === "string" && value.trim())
      .map(([key, value]) => [key, String(value).trim()])
  );
}

function resolveUserId(request: NextRequest, body: any): string | null {
  const cookieValue = request.cookies.get("ar_access")?.value?.trim();
  if (cookieValue && cookieValue !== "1") return cookieValue;

  const headerUserId = request.headers.get("x-user-id")?.trim();
  if (headerUserId) return headerUserId;

  const queryUserId = request.nextUrl.searchParams.get("userId")?.trim();
  if (queryUserId) return queryUserId;

  return cleanString(body?.userId);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = resolveUserId(request, body);

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const incomingAnswers = normalizeAnswers(body?.answers);
    if (Object.keys(incomingAnswers).length === 0) {
      return NextResponse.json({ success: true, saved: false });
    }

    const supabase = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    await supabase
      .from("users")
      .upsert(
        {
          id: userId,
          email: cleanString(body?.email)?.toLowerCase() || undefined,
          onboarding_flow: "flow-b",
          primary_flow: "future_partner",
          primary_report: "future_partner",
          updated_at: nowIso,
        },
        { onConflict: "id" }
      );

    const sessionId = `session_${userId}`;
    const { data: existingSession, error: sessionReadError } = await supabase
      .from("onboarding_sessions")
      .select("answers,onboarding_data,email,current_route,current_step,priority_area,source,status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionReadError) throw sessionReadError;

    const existingAnswers = normalizeAnswers(existingSession?.answers || {});
    const mergedAnswers = { ...existingAnswers, ...incomingAnswers };
    const email = cleanString(body?.email)?.toLowerCase() || existingSession?.email || null;

    const { data: savedSession, error: saveError } = await supabase
      .from("onboarding_sessions")
      .upsert(
        {
          id: sessionId,
          user_id: userId,
          email,
          current_route: cleanString(body?.currentRoute) || existingSession?.current_route || "/onboarding/future-partner",
          current_step: cleanString(body?.currentStep) || existingSession?.current_step || "future-partner",
          priority_area: "future_partner",
          answers: mergedAnswers,
          onboarding_data: existingSession?.onboarding_data || {},
          source: existingSession?.source || "future_partner_answers",
          status: existingSession?.status || "in_progress",
          last_saved_at: nowIso,
          updated_at: nowIso,
        },
        { onConflict: "id" }
      )
      .select("answers,last_saved_at")
      .maybeSingle();

    if (saveError) throw saveError;

    return NextResponse.json({
      success: true,
      saved: true,
      answers: savedSession?.answers || mergedAnswers,
    });
  } catch (error: any) {
    console.error("[future-partner/answers] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save future partner answers" },
      { status: 500 }
    );
  }
}
