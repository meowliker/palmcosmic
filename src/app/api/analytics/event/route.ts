import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_METADATA_KEYS = 40;

function cleanMetadata(value: unknown): Record<string, string | number | boolean> {
  if (!value || typeof value !== "object") return {};

  const cleaned: Record<string, string | number | boolean> = {};
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>).slice(0, MAX_METADATA_KEYS)) {
    if (rawValue === null || rawValue === undefined || rawValue === "") continue;
    if (["string", "number", "boolean"].includes(typeof rawValue)) {
      cleaned[key] = rawValue as string | number | boolean;
    }
  }
  return cleaned;
}

function normalizeRoute(route: unknown): string | null {
  if (typeof route !== "string") return null;
  const trimmed = route.trim();
  if (!trimmed) return null;
  const path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return path.split("?")[0];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventName = typeof body?.eventName === "string" ? body.eventName.trim() : "";

    if (!eventName) {
      return NextResponse.json({ error: "Missing eventName" }, { status: 400 });
    }

    const params = cleanMetadata(body?.params);
    const route = normalizeRoute(body?.route || params.route);
    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("analytics_events").insert({
      event_name: eventName,
      route,
      session_id: typeof body?.sessionId === "string" ? body.sessionId.slice(0, 128) : null,
      user_id: typeof body?.userId === "string" ? body.userId.slice(0, 128) : null,
      email: typeof body?.email === "string" ? body.email.slice(0, 320) : null,
      funnel: typeof params.funnel === "string" ? params.funnel : null,
      step_id: typeof params.step_id === "string" ? params.step_id : null,
      action: typeof params.action === "string" ? params.action : null,
      metadata: params,
      user_agent: request.headers.get("user-agent"),
      referrer: request.headers.get("referer"),
    });

    if (error) {
      console.error("analytics_events insert error:", error);
      return NextResponse.json({ ok: false }, { status: 200 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Analytics event API error:", error);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
