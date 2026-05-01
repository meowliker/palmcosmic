import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type VercelAnalyticsEvent = Record<string, unknown>;

const MAX_EVENTS_PER_REQUEST = 1000;

function getDrainSecret(request: NextRequest): string | null {
  const auth = request.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return (
    request.headers.get("x-vercel-drain-secret") ||
    request.headers.get("x-analytics-drain-secret") ||
    request.nextUrl.searchParams.get("secret")
  );
}

function parseJsonLine(line: string): VercelAnalyticsEvent | null {
  try {
    const parsed = JSON.parse(line);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as VercelAnalyticsEvent)
      : null;
  } catch {
    return null;
  }
}

function parseVercelPayload(rawBody: string): VercelAnalyticsEvent[] {
  const trimmed = rawBody.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is VercelAnalyticsEvent => !!item && typeof item === "object" && !Array.isArray(item));
    }
    if (parsed && typeof parsed === "object") {
      return [parsed as VercelAnalyticsEvent];
    }
  } catch {
    // Vercel drains can send newline-delimited JSON.
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseJsonLine)
    .filter((event): event is VercelAnalyticsEvent => !!event);
}

function getString(event: VercelAnalyticsEvent, key: string): string | null {
  const value = event[key];
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 2000);
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function parseEventTimestamp(event: VercelAnalyticsEvent): string | null {
  const value = event.timestamp;
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}

function normalizePath(value: string | null): string | null {
  if (!value) return null;
  const withSlash = value.startsWith("/") ? value : `/${value}`;
  return withSlash.split("?")[0] || "/";
}

function parseEventData(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return { value };
    }
  }
  return {};
}

function toRow(event: VercelAnalyticsEvent) {
  const eventTimestamp = parseEventTimestamp(event);
  const eventType = getString(event, "eventType");
  const path = normalizePath(getString(event, "path"));

  if (!eventTimestamp || !eventType) return null;

  return {
    event_type: eventType,
    event_name: getString(event, "eventName"),
    event_timestamp: eventTimestamp,
    project_id: getString(event, "projectId"),
    owner_id: getString(event, "ownerId"),
    deployment: getString(event, "deployment"),
    session_id: getString(event, "sessionId"),
    device_id: getString(event, "deviceId"),
    origin: getString(event, "origin"),
    path,
    route: getString(event, "route"),
    referrer: getString(event, "referrer"),
    query_params: getString(event, "queryParams"),
    country: getString(event, "country"),
    region: getString(event, "region"),
    city: getString(event, "city"),
    os_name: getString(event, "osName"),
    client_name: getString(event, "clientName"),
    device_type: getString(event, "deviceType"),
    vercel_environment: getString(event, "vercelEnvironment"),
    vercel_url: getString(event, "vercelUrl"),
    event_data: parseEventData(event.eventData),
    raw_event: event,
  };
}

export async function POST(request: NextRequest) {
  const expectedSecret = process.env.VERCEL_ANALYTICS_DRAIN_SECRET;
  if (expectedSecret && getDrainSecret(request) !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text();
  const rows = parseVercelPayload(rawBody)
    .slice(0, MAX_EVENTS_PER_REQUEST)
    .map(toRow)
    .filter((row): row is NonNullable<ReturnType<typeof toRow>> => !!row);

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("vercel_analytics_events")
    .upsert(rows, { onConflict: "event_type,event_timestamp,session_id,device_id,path,event_name", ignoreDuplicates: true });

  if (error) {
    console.error("vercel_analytics_events insert error:", error);
    return NextResponse.json({ error: "Failed to ingest Vercel analytics" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
