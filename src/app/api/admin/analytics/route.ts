import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { classifyStoredPaymentEvent } from "@/lib/finance-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_ANALYTICS_START_DATE = "2026-04-30";

interface PeakSalesMetric {
  label: string;
  count: number;
  revenueInr: number;
}

interface PeakTrafficMetric {
  label: string;
  sessions: number;
}

interface TrafficSeriesPoint {
  label: string;
  sessions: number;
}

interface SalesSeriesPoint {
  label: string;
  count: number;
  revenueInr: number;
}

interface HourlyProfitabilityPoint {
  date: string;
  weekday: string;
  hour: number;
  label: string;
  orderCount: number;
  revenueInr: number;
  profitInr: number;
  roas: number;
}
type MatrixDayMode = "calendar_ist" | "business_1130_ist";

interface RouteMetric {
  route: string;
  viewers: number;
  pageViews: number;
  bounceRate: number;
  avgSessionDurationSec: number;
  checkouts: number;
  bounces: number;
  source: "ga" | "internal" | "vercel";
}

type RouteMetricAccumulator = RouteMetric & { sessions: Set<string>; durationSamples: number[] };

interface SourceStatus {
  configured: boolean;
  connected: boolean;
  message: string;
}

const WORKFLOW_ROUTES = [
  "/",
  "/welcome",
  "/onboarding",
  "/onboarding/insights-history",
  "/onboarding/why-astrorekha",
  "/onboarding/birth-details-intro",
  "/onboarding/gender",
  "/onboarding/birthday",
  "/onboarding/birth-time",
  "/onboarding/birthplace",
  "/onboarding/step-5",
  "/onboarding/step-6",
  "/onboarding/step-7",
  "/onboarding/future-prediction/intro",
  "/onboarding/future-prediction/focus",
  "/onboarding/future-prediction/relationships",
  "/onboarding/future-prediction/decision-style",
  "/onboarding/future-prediction/horizon",
  "/onboarding/future-prediction/confidence",
  "/onboarding/future-prediction/change",
  "/onboarding/future-prediction/life-path",
  "/onboarding/future-prediction/ready",
  "/onboarding/future-prediction/email",
  "/onboarding/future-prediction/paywall",
  "/onboarding/soulmate-sketch/intro",
  "/onboarding/soulmate-sketch/partner-gender",
  "/onboarding/soulmate-sketch/age-range",
  "/onboarding/soulmate-sketch/visual-style",
  "/onboarding/soulmate-sketch/core-quality",
  "/onboarding/soulmate-sketch/email",
  "/onboarding/soulmate-sketch/paywall",
  "/onboarding/palm-reading/intro",
  "/onboarding/palm-reading/line-focus",
  "/onboarding/palm-reading/life-area",
  "/onboarding/palm-reading/clarity",
  "/onboarding/palm-reading/hand-map",
  "/onboarding/palm-reading/personality",
  "/onboarding/palm-reading/timing",
  "/onboarding/palm-reading/ready",
  "/onboarding/palm-reading/email",
  "/onboarding/palm-reading/paywall",
  "/onboarding/future-partner/intro",
  "/onboarding/future-partner/partner-type",
  "/onboarding/future-partner/love-language",
  "/onboarding/future-partner/relationship-values",
  "/onboarding/future-partner/ideal-date",
  "/onboarding/future-partner/cosmic-timing",
  "/onboarding/future-partner/email",
  "/onboarding/future-partner/paywall",
  "/onboarding/compatibility/intro",
  "/onboarding/compatibility/partner-gender",
  "/onboarding/compatibility/partner-birthday",
  "/onboarding/compatibility/partner-birthplace",
  "/onboarding/compatibility/partner-birth-time",
  "/onboarding/compatibility/ready",
  "/onboarding/compatibility/email",
  "/onboarding/compatibility/paywall",
  "/onboarding/create-password",
  "/registration",
  "/login",
  "/reports",
  "/prediction-2026",
  "/palm-reading",
  "/birth-chart",
  "/birth-chart/report",
  "/soulmate-sketch",
  "/future-partner",
  "/compatibility",
  "/horoscope",
  "/chat",
  "/profile",
  "/profile/edit",
  "/settings",
  "/manage-subscription",
];

const CONTINUATION_ACTION_KEYWORDS = [
  "continue",
  "email_submit",
  "lead",
  "paywall_cta",
  "checkout",
  "subscription_checkout",
  "demo_payment",
  "coupon",
  "promo",
  "create_password_completed",
  "registration",
];

function isPageViewEvent(eventName: unknown): boolean {
  return eventName === "PageView";
}

function isContinuationEvent(event: { event_name?: unknown; action?: unknown; metadata?: unknown }): boolean {
  const eventName = String(event.event_name || "").toLowerCase();
  const action = String(event.action || "").toLowerCase();
  const metadataAction =
    event.metadata && typeof event.metadata === "object"
      ? String((event.metadata as Record<string, unknown>).action || "").toLowerCase()
      : "";
  const haystack = `${eventName} ${action} ${metadataAction}`;
  return CONTINUATION_ACTION_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function ensureRouteMetric(
  map: Map<string, RouteMetricAccumulator>,
  route: string,
  source: RouteMetric["source"] = "internal"
) {
  if (!map.has(route)) {
    map.set(route, {
      route,
      viewers: 0,
      pageViews: 0,
      bounceRate: 0,
      avgSessionDurationSec: 0,
      checkouts: 0,
      bounces: 0,
      source,
      sessions: new Set<string>(),
      durationSamples: [],
    });
  }
  return map.get(route)!;
}

function countSessionIntersection(left: Set<string>, right: Set<string>): number {
  let count = 0;
  left.forEach((value) => {
    if (right.has(value)) count += 1;
  });
  return count;
}

function getWorkflowContinuationRoutes(route: string): string[] {
  const normalized = route.trim();
  if (normalized === "/") return ["/welcome", "/onboarding"];
  if (normalized === "/welcome") return ["/onboarding"];
  if (normalized === "/onboarding/step-7") {
    return [
      "/onboarding/future-prediction/intro",
      "/onboarding/soulmate-sketch/intro",
      "/onboarding/palm-reading/intro",
      "/onboarding/future-partner/intro",
      "/onboarding/compatibility/intro",
    ];
  }

  const index = WORKFLOW_ROUTES.indexOf(normalized);
  if (index < 0 || index >= WORKFLOW_ROUTES.length - 1) return [];
  return [WORKFLOW_ROUTES[index + 1]];
}

function applyWorkflowDropOffBounces(routeMap: Map<string, RouteMetricAccumulator>) {
  for (const route of WORKFLOW_ROUTES) {
    const current = routeMap.get(route);
    if (!current || current.sessions.size === 0) continue;

    const continuationSessions = new Set<string>();
    for (const nextRoute of getWorkflowContinuationRoutes(route)) {
      const next = routeMap.get(nextRoute);
      if (!next) continue;
      next.sessions.forEach((sessionId) => continuationSessions.add(sessionId));
    }

    if (continuationSessions.size === 0) continue;

    const continued = countSessionIntersection(current.sessions, continuationSessions);
    current.bounces = Math.max(current.sessions.size - continued, 0);
  }
}

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function normalizeStatus(status: unknown): string {
  return String(status || "").trim().toLowerCase();
}

function normalizeBounceRate(rawValue: number): number {
  if (!Number.isFinite(rawValue) || rawValue < 0) return 0;
  return rawValue <= 1 ? rawValue * 100 : rawValue;
}

function getModeShortLabel(mode: MatrixDayMode): "IST" | "Stripe TZ" {
  return mode === "business_1130_ist" ? "Stripe TZ" : "IST";
}

function formatHourLabel(hour: number, mode: MatrixDayMode): string {
  const start = String(hour).padStart(2, "0");
  const end = String((hour + 1) % 24).padStart(2, "0");
  return `${start}:00-${end}:00 ${getModeShortLabel(mode)}`;
}

function getIstDateTimeParts(date: Date): { dayKey: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const dayKey = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    dayKey,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function shiftIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function getUtcWindowForMode(
  startDate: string,
  endDate: string,
  mode: MatrixDayMode
): { startIso: string; endIso: string } {
  const boundaryMinutesInIst = mode === "business_1130_ist" ? (11 * 60 + 30) : 0;
  const istOffsetMinutes = 5 * 60 + 30;
  const utcOffsetFromDateStart = boundaryMinutesInIst - istOffsetMinutes;

  const start = new Date(`${startDate}T00:00:00.000Z`);
  start.setUTCMinutes(start.getUTCMinutes() + utcOffsetFromDateStart);

  const end = new Date(`${endDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  end.setUTCMinutes(end.getUTCMinutes() + utcOffsetFromDateStart);
  end.setUTCMilliseconds(end.getUTCMilliseconds() - 1);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getMatrixDateGroup(date: Date, mode: MatrixDayMode): { dayKey: string; hour: number; weekday: string } {
  const { dayKey: calendarDay, hour, minute } = getIstDateTimeParts(date);

  if (mode === "calendar_ist") {
    return { dayKey: calendarDay, hour, weekday: getWeekdayFromIsoDate(calendarDay) };
  }

  const isBeforeBoundary = hour < 11 || (hour === 11 && minute < 30);
  const businessDay = isBeforeBoundary ? shiftIsoDate(calendarDay, -1) : calendarDay;
  // Stripe day mode starts at 11:30 IST, so 11:30 IST maps to 00:00.
  const totalMinutes = hour * 60 + minute;
  const shiftedMinutes = (totalMinutes - (11 * 60 + 30) + 24 * 60) % (24 * 60);
  const cstHour = Math.floor(shiftedMinutes / 60);
  return {
    dayKey: businessDay,
    hour: Number.isFinite(cstHour) ? cstHour : 0,
    weekday: getWeekdayFromIsoDate(businessDay),
  };
}

function getWeekdayFromIsoDate(isoDate: string): string {
  if (!isoDate) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
  }).format(new Date(`${isoDate}T12:00:00.000Z`));
}

function buildWeekdaySalesSeries(
  map: Map<string, { count: number; revenueInr: number }>
): SalesSeriesPoint[] {
  const weekOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return weekOrder.map((day) => {
    const entry = map.get(day) || { count: 0, revenueInr: 0 };
    return {
      label: day,
      count: entry.count,
      revenueInr: Number(entry.revenueInr.toFixed(2)),
    };
  });
}

function normalizeAdAccountId(value: string): string {
  return value.replace(/^act_/i, "").trim();
}

function encodeMetaTimeRange(startDate: string, endDate: string): string {
  return `time_range=${encodeURIComponent(JSON.stringify({ since: startDate, until: endDate }))}`;
}

async function fetchMetaAdsDailySpend(startDate: string, endDate: string): Promise<Map<string, number>> {
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!metaAccessToken || !adAccountId) {
    return new Map();
  }

  try {
    const normalizedAdAccountId = normalizeAdAccountId(adAccountId);
    const dateParams = encodeMetaTimeRange(startDate, endDate);
    const dailyUrl = `https://graph.facebook.com/v21.0/act_${normalizedAdAccountId}/insights?fields=spend&time_increment=1&${dateParams}&limit=90&access_token=${metaAccessToken}`;
    const response = await fetch(dailyUrl);
    const data = await response.json();

    const spendMap = new Map<string, number>();
    if (Array.isArray(data?.data)) {
      for (const day of data.data) {
        const date = String(day?.date_start || "");
        const spend = Number(day?.spend || 0);
        if (date) {
          spendMap.set(date, Number.isFinite(spend) ? spend : 0);
        }
      }
    }
    return spendMap;
  } catch {
    return new Map();
  }
}

function parseMetaHourlyBreakdownHour(value: unknown): number | null {
  const text = String(value || "");
  const match = text.match(/(\d{1,2}):\d{2}/);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isFinite(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function getDateFromStripeDayHour(dayKey: string, hour: number, mode: MatrixDayMode): Date {
  if (mode === "business_1130_ist") {
    return new Date(`${dayKey}T${String(hour).padStart(2, "0")}:00:00-06:00`);
  }

  const date = new Date(`${dayKey}T00:00:00.000Z`);
  date.setUTCMinutes(date.getUTCMinutes() + 6 * 60 + hour * 60);
  return date;
}

async function fetchMetaAdsHourlySpend(
  startDate: string,
  endDate: string,
  mode: MatrixDayMode
): Promise<Map<string, number>> {
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!metaAccessToken || !adAccountId) {
    return new Map();
  }

  try {
    const fetchStart = mode === "business_1130_ist" ? startDate : shiftIsoDate(startDate, -1);
    const fetchEnd = mode === "business_1130_ist" ? endDate : shiftIsoDate(endDate, 1);
    const normalizedAdAccountId = normalizeAdAccountId(adAccountId);
    const dateParams = encodeMetaTimeRange(fetchStart, fetchEnd);
    let url =
      `https://graph.facebook.com/v21.0/act_${normalizedAdAccountId}/insights` +
      `?fields=spend` +
      `&breakdowns=hourly_stats_aggregated_by_advertiser_time_zone` +
      `&time_increment=1&${dateParams}&limit=500&access_token=${metaAccessToken}`;

    const spendMap = new Map<string, number>();
    let pageCount = 0;

    while (url && pageCount < 10) {
      pageCount += 1;
      const response = await fetch(url);
      const data = await response.json();

      if (Array.isArray(data?.data)) {
        for (const row of data.data) {
          const advertiserDay = String(row?.date_start || "");
          const advertiserHour = parseMetaHourlyBreakdownHour(row?.hourly_stats_aggregated_by_advertiser_time_zone);
          const spend = Number(row?.spend || 0);
          if (!advertiserDay || advertiserHour === null || !Number.isFinite(spend)) continue;

          const grouped = getMatrixDateGroup(getDateFromStripeDayHour(advertiserDay, advertiserHour, mode), mode);
          if (grouped.dayKey < startDate || grouped.dayKey > endDate) continue;

          const key = `${grouped.dayKey}|${grouped.hour}`;
          spendMap.set(key, (spendMap.get(key) || 0) + spend);
        }
      }

      url = typeof data?.paging?.next === "string" ? data.paging.next : "";
    }

    return spendMap;
  } catch (error) {
    console.warn("Failed to fetch Meta hourly spend:", error);
    return new Map();
  }
}

function getRouteFromMetadata(metadata: unknown, fallback: string): string {
  if (!metadata || typeof metadata !== "object") return fallback;
  const obj = metadata as Record<string, unknown>;
  const candidate =
    obj.route || obj.pathname || obj.path || obj.page || obj.urlPath || obj.screen || obj.step;

  if (typeof candidate !== "string") return fallback;
  const normalized = candidate.trim();
  if (!normalized) return fallback;
  return normalized.startsWith("/") ? normalized.split("?")[0] : `/${normalized.split("?")[0]}`;
}

function isUsableAnalyticsId(value: unknown): boolean {
  const text = String(value ?? "").trim();
  return Boolean(text && text !== "0" && text.toLowerCase() !== "null" && text.toLowerCase() !== "undefined");
}

function getVercelVisitorKey(row: {
  session_id?: unknown;
  device_id?: unknown;
  path?: unknown;
  event_timestamp?: unknown;
}): string {
  if (isUsableAnalyticsId(row.session_id)) return `session:${String(row.session_id).trim()}`;
  if (isUsableAnalyticsId(row.device_id)) return `device:${String(row.device_id).trim()}`;
  return `pageview:${String(row.path || "/")}:${String(row.event_timestamp || "")}`;
}

function shouldExcludeAnalyticsRoute(route: string): boolean {
  const normalized = route.trim().toLowerCase();
  return (
    normalized === "/test-page" ||
    normalized === "/api" ||
    normalized.startsWith("/api/") ||
    normalized === "/admin" ||
    normalized.startsWith("/admin/")
  );
}

function inferPaywallVisitors(routeMetrics: RouteMetric[]): { visitors: number; matchedRoute: string | null } {
  if (!routeMetrics?.length) return { visitors: 0, matchedRoute: null };

  const normalizedRows = routeMetrics.map((row) => ({
    ...row,
    normalized: row.route.trim().toLowerCase(),
  }));

  const preferredPaywallRoutes = ["/onboarding/bundle-pricing", "/paywall"];
  const exactMatches = normalizedRows.filter((row) =>
    preferredPaywallRoutes.some((target) => row.normalized === target || row.normalized.startsWith(`${target}/`))
  );

  if (exactMatches.length > 0) {
    const best = exactMatches.reduce((max, row) => (row.viewers > max.viewers ? row : max), exactMatches[0]);
    return { visitors: best.viewers, matchedRoute: best.route };
  }

  const fuzzyMatches = normalizedRows.filter(
    (row) =>
      row.normalized.includes("paywall") ||
      row.normalized.includes("bundle-pricing") ||
      row.normalized.includes("onboarding/step-20")
  );

  if (fuzzyMatches.length > 0) {
    const best = fuzzyMatches.reduce((max, row) => (row.viewers > max.viewers ? row : max), fuzzyMatches[0]);
    return { visitors: best.viewers, matchedRoute: best.route };
  }

  return { visitors: 0, matchedRoute: null };
}

function pickTopSalesMetric(map: Map<string, { count: number; revenueInr: number }>, fallbackLabel: string): PeakSalesMetric {
  let bestLabel = fallbackLabel;
  let bestCount = 0;
  let bestRevenue = 0;

  for (const [label, value] of map.entries()) {
    if (value.count > bestCount || (value.count === bestCount && value.revenueInr > bestRevenue)) {
      bestLabel = label;
      bestCount = value.count;
      bestRevenue = value.revenueInr;
    }
  }

  return {
    label: bestLabel,
    count: bestCount,
    revenueInr: Number(bestRevenue.toFixed(2)),
  };
}

function pickTopTrafficMetric(map: Map<string, number>, fallbackLabel: string): PeakTrafficMetric {
  let bestLabel = fallbackLabel;
  let bestSessions = 0;

  for (const [label, sessions] of map.entries()) {
    if (sessions > bestSessions) {
      bestLabel = label;
      bestSessions = sessions;
    }
  }

  return {
    label: bestLabel,
    sessions: bestSessions,
  };
}

function buildHourlyTrafficSeriesByMode(map: Map<string, number>, mode: MatrixDayMode): TrafficSeriesPoint[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const label = formatHourLabel(hour, mode);
    return {
      label,
      sessions: map.get(label) || 0,
    };
  });
}

function buildHourlySalesSeriesByMode(
  map: Map<string, { count: number; revenueInr: number }>,
  mode: MatrixDayMode
): SalesSeriesPoint[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const label = formatHourLabel(hour, mode);
    const entry = map.get(label) || { count: 0, revenueInr: 0 };
    return {
      label,
      count: entry.count,
      revenueInr: Number(entry.revenueInr.toFixed(2)),
    };
  });
}

function buildWeekdayTrafficSeries(map: Map<string, number>): TrafficSeriesPoint[] {
  const weekOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return weekOrder.map((day) => ({
    label: day,
    sessions: map.get(day) || 0,
  }));
}

function buildDailyTrafficSeries(
  map: Map<string, number>,
  startDate: string,
  endDate: string
): TrafficSeriesPoint[] {
  const rows: TrafficSeriesPoint[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    const key = cursor.toISOString().split("T")[0];
    rows.push({
      label: key,
      sessions: map.get(key) || 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return rows;
}

function buildDailySalesSeries(
  map: Map<string, { count: number; revenueInr: number }>,
  startDate: string,
  endDate: string
): SalesSeriesPoint[] {
  const rows: SalesSeriesPoint[] = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (cursor <= end) {
    const key = cursor.toISOString().split("T")[0];
    const entry = map.get(key) || { count: 0, revenueInr: 0 };
    rows.push({
      label: key,
      count: entry.count,
      revenueInr: Number(entry.revenueInr.toFixed(2)),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return rows;
}

async function fetchGoogleAnalyticsData(
  startDate: string,
  endDate: string,
  dayMode: MatrixDayMode
): Promise<{
  routeMetrics: RouteMetric[];
  peakTrafficHour: PeakTrafficMetric;
  peakTrafficDay: PeakTrafficMetric;
  hourlySeries: TrafficSeriesPoint[];
  dailySeries: TrafficSeriesPoint[];
  weekdaySeries: TrafficSeriesPoint[];
  totalSessions: number;
  totalPageViews: number;
  overallBounceRate: number;
  avgSessionDurationSec: number;
  sourceStatus: SourceStatus;
}> {
  const propertyId = process.env.GA4_PROPERTY_ID || process.env.GOOGLE_ANALYTICS_PROPERTY_ID;
  const oauthClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const oauthRefreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const hasOauthCreds = Boolean(oauthClientId && oauthClientSecret && oauthRefreshToken);
  const hasServiceAccountCreds = Boolean(clientEmail && privateKey);

  if (!propertyId || (!hasOauthCreds && !hasServiceAccountCreds)) {
    return {
      routeMetrics: [],
      peakTrafficHour: { label: "N/A", sessions: 0 },
      peakTrafficDay: { label: "N/A", sessions: 0 },
      hourlySeries: [],
      dailySeries: [],
      weekdaySeries: [],
      totalSessions: 0,
      totalPageViews: 0,
      overallBounceRate: 0,
      avgSessionDurationSec: 0,
      sourceStatus: {
        configured: false,
        connected: false,
        message: "GA server API not configured. Add GA4_PROPERTY_ID plus OAuth refresh-token or service-account credentials.",
      },
    };
  }

  try {
    const auth = hasOauthCreds
      ? new google.auth.OAuth2(oauthClientId, oauthClientSecret)
      : new google.auth.GoogleAuth({
          credentials: {
            client_email: clientEmail,
            private_key: privateKey,
          },
          scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
        });

    if (hasOauthCreds && "setCredentials" in auth) {
      auth.setCredentials({ refresh_token: oauthRefreshToken });
    }

    const analyticsData = google.analyticsdata({ version: "v1beta", auth });

    const trafficStartDate = shiftIsoDate(startDate, -1);
    const trafficEndDate = shiftIsoDate(endDate, 1);
    const trafficRange = [{ startDate: trafficStartDate, endDate: trafficEndDate }];
    const routeRange = [{ startDate, endDate }];

    const [hourResp, routeResp] = await Promise.all([
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: trafficRange,
          dimensions: [{ name: "dateHour" }],
          metrics: [{ name: "sessions" }],
          limit: "10000",
        },
      }),
      analyticsData.properties.runReport({
        property: `properties/${propertyId}`,
        requestBody: {
          dateRanges: routeRange,
          dimensions: [{ name: "pagePath" }],
          metrics: [
            { name: "sessions" },
            { name: "screenPageViews" },
            { name: "bounceRate" },
            { name: "averageSessionDuration" },
          ],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "100",
        },
      }),
    ]);

    const hourlyMap = new Map<string, number>();
    for (const row of hourResp.data.rows || []) {
      const dateHourRaw = row.dimensionValues?.[0]?.value || "";
      // GA dateHour format: YYYYMMDDHH
      if (!/^\d{10}$/.test(dateHourRaw)) continue;
      const parsed = new Date(
        `${dateHourRaw.slice(0, 4)}-${dateHourRaw.slice(4, 6)}-${dateHourRaw.slice(6, 8)}T${dateHourRaw.slice(8, 10)}:00:00+05:30`
      );
      if (Number.isNaN(parsed.getTime())) continue;
      const grouped = getMatrixDateGroup(parsed, dayMode);
      if (grouped.dayKey < startDate || grouped.dayKey > endDate) continue;
      const sessions = toNumber(row.metricValues?.[0]?.value);
      const label = formatHourLabel(grouped.hour, dayMode);
      hourlyMap.set(label, (hourlyMap.get(label) || 0) + sessions);
    }

    const dailyMap = new Map<string, number>();
    const weekdayMap = new Map<string, number>();
    for (const row of hourResp.data.rows || []) {
      const dateHourRaw = row.dimensionValues?.[0]?.value || "";
      if (!/^\d{10}$/.test(dateHourRaw)) continue;
      const parsed = new Date(
        `${dateHourRaw.slice(0, 4)}-${dateHourRaw.slice(4, 6)}-${dateHourRaw.slice(6, 8)}T${dateHourRaw.slice(8, 10)}:00:00+05:30`
      );
      if (Number.isNaN(parsed.getTime())) continue;
      const grouped = getMatrixDateGroup(parsed, dayMode);
      if (grouped.dayKey < startDate || grouped.dayKey > endDate) continue;
      const sessions = toNumber(row.metricValues?.[0]?.value);
      dailyMap.set(grouped.dayKey, (dailyMap.get(grouped.dayKey) || 0) + sessions);
      const weekday = grouped.weekday;
      weekdayMap.set(weekday, (weekdayMap.get(weekday) || 0) + sessions);
    }

    const routeMetrics: RouteMetric[] = (routeResp.data.rows || [])
      .map((row) => {
        const route = row.dimensionValues?.[0]?.value || "/";
        const sessions = toNumber(row.metricValues?.[0]?.value);
        const pageViews = toNumber(row.metricValues?.[1]?.value);
        const bounceRate = normalizeBounceRate(toNumber(row.metricValues?.[2]?.value));
        const avgSessionDurationSec = toNumber(row.metricValues?.[3]?.value);
        const bounces = Math.round((sessions * bounceRate) / 100);

        return {
          route,
          viewers: sessions,
          pageViews,
          bounceRate,
          avgSessionDurationSec,
          checkouts: 0,
          bounces,
          source: "ga" as const,
        };
      })
      .filter((row) => row.viewers > 0)
      .sort((a, b) => b.viewers - a.viewers)
      .slice(0, 50);

    const totalSessions = Array.from(dailyMap.values()).reduce((sum, val) => sum + val, 0);
    const totalPageViews = routeMetrics.reduce((sum, row) => sum + row.pageViews, 0);
    const totalWeightedBounce = routeMetrics.reduce((sum, row) => sum + row.bounceRate * row.viewers, 0);
    const totalWeightedDuration = routeMetrics.reduce((sum, row) => sum + row.avgSessionDurationSec * row.viewers, 0);

    return {
      routeMetrics,
      peakTrafficHour: pickTopTrafficMetric(hourlyMap, "N/A"),
      peakTrafficDay: pickTopTrafficMetric(weekdayMap, "N/A"),
      hourlySeries: buildHourlyTrafficSeriesByMode(hourlyMap, dayMode),
      dailySeries: buildDailyTrafficSeries(dailyMap, startDate, endDate),
      weekdaySeries: buildWeekdayTrafficSeries(weekdayMap),
      totalSessions,
      totalPageViews,
      overallBounceRate: totalSessions > 0 ? totalWeightedBounce / totalSessions : 0,
      avgSessionDurationSec: totalSessions > 0 ? totalWeightedDuration / totalSessions : 0,
      sourceStatus: {
        configured: true,
        connected: true,
        message: dayMode === "business_1130_ist"
          ? `Connected to GA4 Data API via ${hasOauthCreds ? "OAuth" : "service account"} (Stripe day mode uses shifted hour/day aggregation).`
          : `Connected to GA4 Data API via ${hasOauthCreds ? "OAuth" : "service account"}.`,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown error";
    return {
      routeMetrics: [],
      peakTrafficHour: { label: "N/A", sessions: 0 },
      peakTrafficDay: { label: "N/A", sessions: 0 },
      hourlySeries: [],
      dailySeries: [],
      weekdaySeries: [],
      totalSessions: 0,
      totalPageViews: 0,
      overallBounceRate: 0,
      avgSessionDurationSec: 0,
      sourceStatus: {
        configured: true,
        connected: false,
        message: `GA connection failed: ${message}`,
      },
    };
  }
}

async function fetchVercelAnalyticsData(
  startIso: string,
  endIso: string,
  dayMode: MatrixDayMode,
  startDate: string,
  endDate: string
): Promise<{
  routeMetrics: RouteMetric[];
  peakTrafficHour: PeakTrafficMetric;
  peakTrafficDay: PeakTrafficMetric;
  hourlySeries: TrafficSeriesPoint[];
  dailySeries: TrafficSeriesPoint[];
  weekdaySeries: TrafficSeriesPoint[];
  totalSessions: number;
  totalPageViews: number;
  overallBounceRate: number;
  avgSessionDurationSec: number;
  sourceStatus: SourceStatus;
}> {
  const supabase = getSupabaseAdmin();

  const { data: rows, error } = await supabase
    .from("vercel_analytics_events")
    .select("event_type, event_timestamp, path, route, session_id, device_id")
    .eq("event_type", "pageview")
    .gte("event_timestamp", startIso)
    .lte("event_timestamp", endIso)
    .order("event_timestamp", { ascending: true })
    .limit(50000);

  if (error) {
    return {
      routeMetrics: [],
      peakTrafficHour: { label: "N/A", sessions: 0 },
      peakTrafficDay: { label: "N/A", sessions: 0 },
      hourlySeries: [],
      dailySeries: [],
      weekdaySeries: [],
      totalSessions: 0,
      totalPageViews: 0,
      overallBounceRate: 0,
      avgSessionDurationSec: 0,
      sourceStatus: {
        configured: true,
        connected: false,
        message: `Vercel Analytics Drain table unavailable: ${error.message}`,
      },
    };
  }

  if (!rows || rows.length === 0) {
    return {
      routeMetrics: [],
      peakTrafficHour: { label: "N/A", sessions: 0 },
      peakTrafficDay: { label: "N/A", sessions: 0 },
      hourlySeries: [],
      dailySeries: [],
      weekdaySeries: [],
      totalSessions: 0,
      totalPageViews: 0,
      overallBounceRate: 0,
      avgSessionDurationSec: 0,
      sourceStatus: {
        configured: true,
        connected: false,
        message: "Vercel Analytics Drain is configured in code, but no drained pageviews were found for this range.",
      },
    };
  }

  const routeMap = new Map<string, RouteMetricAccumulator>();
  const hourlySessions = new Map<string, Set<string>>();
  const dailySessions = new Map<string, Set<string>>();
  const weekdaySessions = new Map<string, Set<string>>();
  const allSessions = new Set<string>();
  const sessionPageViews = new Map<
    string,
    Array<{
      route: string;
      timestamp: number;
    }>
  >();

  for (const route of WORKFLOW_ROUTES) {
    ensureRouteMetric(routeMap, route, "vercel");
  }

  for (const row of rows) {
    const createdAt = new Date(String(row.event_timestamp || ""));
    if (Number.isNaN(createdAt.getTime())) continue;

    const grouped = getMatrixDateGroup(createdAt, dayMode);
    if (grouped.dayKey < startDate || grouped.dayKey > endDate) continue;

    const route = getRouteFromMetadata({ route: row.path || row.route }, "/unknown");
    if (shouldExcludeAnalyticsRoute(route)) continue;
    const visitorKey = getVercelVisitorKey(row);
    allSessions.add(visitorKey);

    const item = ensureRouteMetric(routeMap, route, "vercel");
    item.sessions.add(visitorKey);
    item.pageViews += 1;

    if (!sessionPageViews.has(visitorKey)) {
      sessionPageViews.set(visitorKey, []);
    }
    sessionPageViews.get(visitorKey)!.push({
      route,
      timestamp: createdAt.getTime(),
    });

    const hourLabel = formatHourLabel(grouped.hour, dayMode);
    if (!hourlySessions.has(hourLabel)) hourlySessions.set(hourLabel, new Set());
    if (!dailySessions.has(grouped.dayKey)) dailySessions.set(grouped.dayKey, new Set());
    if (!weekdaySessions.has(grouped.weekday)) weekdaySessions.set(grouped.weekday, new Set());
    hourlySessions.get(hourLabel)!.add(visitorKey);
    dailySessions.get(grouped.dayKey)!.add(visitorKey);
    weekdaySessions.get(grouped.weekday)!.add(visitorKey);
  }

  for (const pageViews of sessionPageViews.values()) {
    const sorted = [...pageViews].sort((a, b) => a.timestamp - b.timestamp);

    for (let idx = 0; idx < sorted.length; idx++) {
      const current = sorted[idx];
      const next = sorted[idx + 1];
      if (!next) continue;
      const durationSec = Math.max(0, Math.min((next.timestamp - current.timestamp) / 1000, 30 * 60));
      ensureRouteMetric(routeMap, current.route, "vercel").durationSamples.push(durationSec);
    }

    const routeVisits = new Map<string, { first: number; last: number }>();
    for (const pageView of sorted) {
      const visit = routeVisits.get(pageView.route) || { first: pageView.timestamp, last: pageView.timestamp };
      visit.first = Math.min(visit.first, pageView.timestamp);
      visit.last = Math.max(visit.last, pageView.timestamp);
      routeVisits.set(pageView.route, visit);
    }

    for (const [route, visit] of routeVisits.entries()) {
      const hasLaterPageView = sorted.some((pageView) => pageView.timestamp > visit.last && pageView.route !== route);
      if (!hasLaterPageView) {
        ensureRouteMetric(routeMap, route, "vercel").bounces += 1;
      }
    }
  }

  applyWorkflowDropOffBounces(routeMap);

  const hourlyMap = new Map<string, number>();
  const dailyMap = new Map<string, number>();
  const weekdayMap = new Map<string, number>();
  hourlySessions.forEach((set, key) => hourlyMap.set(key, set.size));
  dailySessions.forEach((set, key) => dailyMap.set(key, set.size));
  weekdaySessions.forEach((set, key) => weekdayMap.set(key, set.size));

  const routeMetrics = Array.from(routeMap.values())
    .map(({ sessions, durationSamples, ...row }) => ({
      ...row,
      viewers: sessions.size,
      bounceRate: sessions.size > 0 ? (row.bounces / sessions.size) * 100 : 0,
      avgSessionDurationSec:
        durationSamples.length > 0
          ? durationSamples.reduce((sum, value) => sum + value, 0) / durationSamples.length
          : 0,
    }))
    .sort((a, b) => {
      const aIdx = WORKFLOW_ROUTES.indexOf(a.route);
      const bIdx = WORKFLOW_ROUTES.indexOf(b.route);
      if (aIdx !== -1 || bIdx !== -1) {
        if (aIdx === -1) return 1;
        if (bIdx === -1) return -1;
        return aIdx - bIdx;
      }
      return b.viewers - a.viewers;
    });

  const totalViewers = routeMetrics.reduce((sum, row) => sum + row.viewers, 0);
  const totalBounces = routeMetrics.reduce((sum, row) => sum + row.bounces, 0);
  const totalPageViews = routeMetrics.reduce((sum, row) => sum + row.pageViews, 0);
  const totalWeightedDuration = routeMetrics.reduce((sum, row) => sum + row.avgSessionDurationSec * row.pageViews, 0);

  return {
    routeMetrics,
    peakTrafficHour: pickTopTrafficMetric(hourlyMap, "N/A"),
    peakTrafficDay: pickTopTrafficMetric(weekdayMap, "N/A"),
    hourlySeries: buildHourlyTrafficSeriesByMode(hourlyMap, dayMode),
    dailySeries: buildDailyTrafficSeries(dailyMap, startDate, endDate),
    weekdaySeries: buildWeekdayTrafficSeries(weekdayMap),
    totalSessions: allSessions.size,
    totalPageViews,
    overallBounceRate: totalViewers > 0 ? (totalBounces / totalViewers) * 100 : 0,
    avgSessionDurationSec: totalPageViews > 0 ? totalWeightedDuration / totalPageViews : 0,
    sourceStatus: {
      configured: true,
      connected: true,
      message: "Using Vercel Analytics Drain pageviews for route traffic.",
    },
  };
}

async function fetchInternalRouteAnalytics(
  startIso: string,
  endIso: string,
  dayMode: MatrixDayMode,
  startDate: string,
  endDate: string
): Promise<{
  routeMetrics: RouteMetric[];
  peakTrafficHour: PeakTrafficMetric;
  peakTrafficDay: PeakTrafficMetric;
  hourlySeries: TrafficSeriesPoint[];
  dailySeries: TrafficSeriesPoint[];
  weekdaySeries: TrafficSeriesPoint[];
  totalSessions: number;
  totalPageViews: number;
  overallBounceRate: number;
  avgSessionDurationSec: number;
}> {
  const supabase = getSupabaseAdmin();

  const { data: firstPartyEvents, error: firstPartyError } = await supabase
    .from("analytics_events")
    .select("event_name, route, session_id, user_id, created_at, action, metadata")
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: true })
    .limit(30000);

  if (!firstPartyError && firstPartyEvents && firstPartyEvents.length > 0) {
    const routeMap = new Map<string, RouteMetricAccumulator>();
    const hourlySessions = new Map<string, Set<string>>();
    const dailySessions = new Map<string, Set<string>>();
    const weekdaySessions = new Map<string, Set<string>>();
    const seenPageViews = new Set<string>();
    const sessionEvents = new Map<
      string,
      Array<{
        eventName: string;
        route: string;
        createdAt: string;
        timestamp: number;
        isPageView: boolean;
        isContinuation: boolean;
      }>
    >();

    for (const route of WORKFLOW_ROUTES) {
      ensureRouteMetric(routeMap, route);
    }

    for (const evt of firstPartyEvents) {
      if (!evt?.created_at) continue;
      const grouped = getMatrixDateGroup(new Date(evt.created_at), dayMode);
      if (grouped.dayKey < startDate || grouped.dayKey > endDate) continue;

      const route = getRouteFromMetadata({ route: evt.route }, "/unknown");
      if (shouldExcludeAnalyticsRoute(route)) continue;
      const sessionKey = String(evt.session_id || evt.user_id || `${route}_${evt.created_at}`);
      const eventName = String(evt.event_name || "");
      const eventTimestamp = new Date(evt.created_at).getTime();
      const isPageView = isPageViewEvent(eventName);
      const isContinuation = isContinuationEvent(evt);

      if (!sessionEvents.has(sessionKey)) {
        sessionEvents.set(sessionKey, []);
      }
      sessionEvents.get(sessionKey)!.push({
        eventName,
        route,
        createdAt: evt.created_at,
        timestamp: eventTimestamp,
        isPageView,
        isContinuation,
      });

      if (!isPageView) continue;

      const pageViewKey = `${sessionKey}|${route}|${evt.created_at}`;
      const item = ensureRouteMetric(routeMap, route);
      item.sessions.add(sessionKey);
      if (!seenPageViews.has(pageViewKey)) {
        seenPageViews.add(pageViewKey);
        item.pageViews += 1;
      }

      const hourLabel = formatHourLabel(grouped.hour, dayMode);
      if (!hourlySessions.has(hourLabel)) hourlySessions.set(hourLabel, new Set());
      if (!dailySessions.has(grouped.dayKey)) dailySessions.set(grouped.dayKey, new Set());
      if (!weekdaySessions.has(grouped.weekday)) weekdaySessions.set(grouped.weekday, new Set());
      hourlySessions.get(hourLabel)!.add(sessionKey);
      dailySessions.get(grouped.dayKey)!.add(sessionKey);
      weekdaySessions.get(grouped.weekday)!.add(sessionKey);
    }

    for (const events of sessionEvents.values()) {
      const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);
      const pageEvents = sortedEvents.filter((event) => event.isPageView);
      if (pageEvents.length === 0) continue;

      for (let idx = 0; idx < pageEvents.length; idx++) {
        const current = pageEvents[idx];
        const nextPage = pageEvents[idx + 1];
        if (!nextPage) continue;
        const durationSec = Math.max(0, Math.min((nextPage.timestamp - current.timestamp) / 1000, 30 * 60));
        ensureRouteMetric(routeMap, current.route).durationSamples.push(durationSec);
      }

      const routeVisits = new Map<string, { first: number; last: number }>();
      for (const pageEvent of pageEvents) {
        const visit = routeVisits.get(pageEvent.route) || { first: pageEvent.timestamp, last: pageEvent.timestamp };
        visit.first = Math.min(visit.first, pageEvent.timestamp);
        visit.last = Math.max(visit.last, pageEvent.timestamp);
        routeVisits.set(pageEvent.route, visit);
      }

      for (const [route, visit] of routeVisits.entries()) {
        const hasLaterPageView = pageEvents.some((event) => event.timestamp > visit.last && event.route !== route);
        const hasLaterContinuation = sortedEvents.some(
          (event) => event.timestamp > visit.last && event.isContinuation
        );

        if (!hasLaterPageView && !hasLaterContinuation) {
          ensureRouteMetric(routeMap, route).bounces += 1;
        }
      }
    }

    applyWorkflowDropOffBounces(routeMap);

    const hourlyMap = new Map<string, number>();
    const dailyMap = new Map<string, number>();
    const weekdayMap = new Map<string, number>();
    hourlySessions.forEach((set, key) => hourlyMap.set(key, set.size));
    dailySessions.forEach((set, key) => dailyMap.set(key, set.size));
    weekdaySessions.forEach((set, key) => weekdayMap.set(key, set.size));

    const routeMetrics = Array.from(routeMap.values())
      .map(({ sessions, durationSamples, ...row }) => ({
        ...row,
        viewers: sessions.size,
        bounceRate: sessions.size > 0 ? (row.bounces / sessions.size) * 100 : 0,
        avgSessionDurationSec:
          durationSamples.length > 0
            ? durationSamples.reduce((sum, value) => sum + value, 0) / durationSamples.length
            : 0,
      }))
      .sort((a, b) => {
        const aIdx = WORKFLOW_ROUTES.indexOf(a.route);
        const bIdx = WORKFLOW_ROUTES.indexOf(b.route);
        if (aIdx !== -1 || bIdx !== -1) {
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        }
        return a.route.localeCompare(b.route);
      });

    const totalSessions = new Set(firstPartyEvents.map((evt) => evt.session_id || evt.user_id).filter(Boolean)).size;
    const totalViewers = routeMetrics.reduce((sum, row) => sum + row.viewers, 0);
    const totalBounces = routeMetrics.reduce((sum, row) => sum + row.bounces, 0);
    const totalWeightedDuration = routeMetrics.reduce((sum, row) => sum + row.avgSessionDurationSec * row.pageViews, 0);
    const totalPageViews = routeMetrics.reduce((sum, row) => sum + row.pageViews, 0);

    return {
      routeMetrics,
      peakTrafficHour: pickTopTrafficMetric(hourlyMap, "N/A"),
      peakTrafficDay: pickTopTrafficMetric(weekdayMap, "N/A"),
      hourlySeries: buildHourlyTrafficSeriesByMode(hourlyMap, dayMode),
      dailySeries: buildDailyTrafficSeries(dailyMap, startDate, endDate),
      weekdaySeries: buildWeekdayTrafficSeries(weekdayMap),
      totalSessions: totalSessions || routeMetrics.reduce((sum, row) => sum + row.viewers, 0),
      totalPageViews,
      overallBounceRate: totalViewers > 0 ? (totalBounces / totalViewers) * 100 : 0,
      avgSessionDurationSec: totalPageViews > 0 ? totalWeightedDuration / totalPageViews : 0,
    };
  }

  const { data: events } = await supabase
    .from("ab_test_events")
    .select("event_type, created_at, metadata, test_id, variant")
    .gte("created_at", startIso)
    .lte("created_at", endIso)
    .order("created_at", { ascending: false })
    .limit(10000);

  const routeMap = new Map<string, RouteMetric>();
  const hourlyMap = new Map<string, number>();
  const dailyMap = new Map<string, number>();
  const weekdayMap = new Map<string, number>();

  for (const evt of events || []) {
    const fallbackRoute = evt?.test_id
      ? `/ab/${evt.test_id}/${evt.variant || "unknown"}`
      : "/unknown";
    const route = getRouteFromMetadata(evt?.metadata, fallbackRoute);

    if (!routeMap.has(route)) {
      routeMap.set(route, {
        route,
        viewers: 0,
        pageViews: 0,
        bounceRate: 0,
        avgSessionDurationSec: 0,
        checkouts: 0,
        bounces: 0,
        source: "internal",
      });
    }

    const item = routeMap.get(route)!;
    const eventType = String(evt?.event_type || "");

    if (eventType === "impression") {
      item.viewers += 1;
      item.pageViews += 1;

      if (evt?.created_at) {
        const grouped = getMatrixDateGroup(new Date(evt.created_at), dayMode);
        const { dayKey, hour, weekday } = grouped;
        if (dayKey < startDate || dayKey > endDate) continue;
        const hourLabel = formatHourLabel(hour, dayMode);
        hourlyMap.set(hourLabel, (hourlyMap.get(hourLabel) || 0) + 1);
        dailyMap.set(dayKey, (dailyMap.get(dayKey) || 0) + 1);
        weekdayMap.set(weekday, (weekdayMap.get(weekday) || 0) + 1);
      }
    } else if (eventType === "bounce") {
      item.bounces += 1;
    } else if (eventType === "checkout_started") {
      item.checkouts += 1;
    }
  }

  const routeMetrics = Array.from(routeMap.values())
    .map((row) => ({
      ...row,
      bounceRate: row.viewers > 0 ? (row.bounces / row.viewers) * 100 : 0,
    }))
    .sort((a, b) => b.viewers - a.viewers)
    .slice(0, 50);

  const totalSessions = routeMetrics.reduce((sum, row) => sum + row.viewers, 0);
  const totalBounces = routeMetrics.reduce((sum, row) => sum + row.bounces, 0);

  return {
    routeMetrics,
    peakTrafficHour: pickTopTrafficMetric(hourlyMap, "N/A"),
    peakTrafficDay: pickTopTrafficMetric(weekdayMap, "N/A"),
    hourlySeries: buildHourlyTrafficSeriesByMode(hourlyMap, dayMode),
    dailySeries: buildDailyTrafficSeries(dailyMap, startDate, endDate),
    weekdaySeries: buildWeekdayTrafficSeries(weekdayMap),
    totalSessions,
    totalPageViews: totalSessions,
    overallBounceRate: totalSessions > 0 ? (totalBounces / totalSessions) * 100 : 0,
    avgSessionDurationSec: 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const today = new Date();

    const startDate = searchParams.get("startDate") || DEFAULT_ANALYTICS_START_DATE;
    const endDate = searchParams.get("endDate") || today.toISOString().split("T")[0];
    const dayModeParam = searchParams.get("dayMode");
    const matrixDayModeParam = searchParams.get("matrixDayMode");
    const dayMode: MatrixDayMode = dayModeParam === "business_1130_ist" ? "business_1130_ist" : "calendar_ist";
    const matrixDayMode: MatrixDayMode = matrixDayModeParam === "business_1130_ist"
      ? "business_1130_ist"
      : dayMode;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized - No token provided" }, { status: 401 });
    }

    const { data: sessionData } = await supabase
      .from("admin_sessions")
      .select("id, expires_at")
      .eq("id", token)
      .single();

    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized - Invalid session" }, { status: 401 });
    }

    if (new Date(sessionData.expires_at) < new Date()) {
      await supabase.from("admin_sessions").delete().eq("id", token);
      return NextResponse.json({ error: "Session expired - Please login again" }, { status: 401 });
    }

    const { startIso, endIso } = getUtcWindowForMode(startDate, endDate, dayMode);
    const matrixWindow = getUtcWindowForMode(startDate, endDate, matrixDayMode);
    const paymentFetchStartIso = startIso < matrixWindow.startIso ? startIso : matrixWindow.startIso;
    const paymentFetchEndIso = endIso > matrixWindow.endIso ? endIso : matrixWindow.endIso;

    const { data: paymentRows } = await supabase
      .from("payments")
      .select("id, amount, payment_status, created_at, fulfilled_at, type, bundle_id, currency, user_id")
      .order("created_at", { ascending: false })
      .limit(10000);

    const selectedPaymentRows = (paymentRows || []).filter((payment) => {
      const eventTime = String(payment.fulfilled_at || payment.created_at || "");
      return eventTime >= paymentFetchStartIso && eventTime <= paymentFetchEndIso;
    });

    const pendingRows = selectedPaymentRows.filter((row) => {
      const status = normalizeStatus(row.payment_status);
      return status === "created" || status === "pending";
    });
    const failedRows = selectedPaymentRows.filter((row) => normalizeStatus(row.payment_status) === "failed");

    const inRange = (dayKey: string) => dayKey >= startDate && dayKey <= endDate;

    type AggregatedSalesRow = {
      dayKey: string;
      hour: number;
      weekday: string;
      kind: "sale" | "refund";
      signedAmount: number;
    };

    type PaymentFinancialRow = {
      created: Date;
      kind: "sale" | "refund";
      signedAmount: number;
    };

    const paymentFinancialRows: PaymentFinancialRow[] = selectedPaymentRows
      .map((payment) => {
        const financial = classifyStoredPaymentEvent(payment.payment_status, payment.amount);
        if (financial.kind === "ignore") return null;
        const created = new Date(String(payment.fulfilled_at || payment.created_at));
        if (Number.isNaN(created.getTime())) return null;
        return {
          created,
          kind: financial.kind,
          signedAmount: financial.signedAmount,
        } as PaymentFinancialRow;
      })
      .filter((row): row is PaymentFinancialRow => !!row);

    const salesRows: AggregatedSalesRow[] = paymentFinancialRows
      .map((row) => {
        const grouped = getMatrixDateGroup(row.created, dayMode);
        if (!inRange(grouped.dayKey)) return null;
        return {
          dayKey: grouped.dayKey,
          hour: grouped.hour,
          weekday: grouped.weekday,
          kind: row.kind,
          signedAmount: row.signedAmount,
        } as AggregatedSalesRow;
      })
      .filter((row): row is AggregatedSalesRow => !!row);

    const hasStripeSalesData = paymentFinancialRows.length > 0;
    const refundRows = salesRows.filter((row) => row.kind === "refund");

    const salesHourlyMap = new Map<string, { count: number; revenueInr: number }>();
    const salesDailyMap = new Map<string, { count: number; revenueInr: number }>();
    const salesWeekdayMap = new Map<string, { count: number; revenueInr: number }>();
    const salesDayHourMap = new Map<string, { count: number; revenueInr: number }>();
    let totalRevenueInr = 0;
    let paidOrders = 0;
    let refundedOrders = 0;

    for (const row of salesRows) {
      const hourLabel = formatHourLabel(row.hour, dayMode);
      const amount = row.signedAmount;
      const countDelta = row.kind === "refund" ? -1 : 1;
      totalRevenueInr += amount;
      if (row.kind === "sale") paidOrders += 1;
      if (row.kind === "refund") refundedOrders += 1;

      const hourEntry = salesHourlyMap.get(hourLabel) || { count: 0, revenueInr: 0 };
      hourEntry.count += countDelta;
      hourEntry.revenueInr += amount;
      salesHourlyMap.set(hourLabel, hourEntry);

      const dayEntry = salesDailyMap.get(row.dayKey) || { count: 0, revenueInr: 0 };
      dayEntry.count += countDelta;
      dayEntry.revenueInr += amount;
      salesDailyMap.set(row.dayKey, dayEntry);

      const dayHourKey = `${row.dayKey}|${row.hour}`;
      const dayHourEntry = salesDayHourMap.get(dayHourKey) || { count: 0, revenueInr: 0 };
      dayHourEntry.count += countDelta;
      dayHourEntry.revenueInr += amount;
      salesDayHourMap.set(dayHourKey, dayHourEntry);

      const weekdayEntry = salesWeekdayMap.get(row.weekday) || { count: 0, revenueInr: 0 };
      weekdayEntry.count += countDelta;
      weekdayEntry.revenueInr += amount;
      salesWeekdayMap.set(row.weekday, weekdayEntry);
    }

    const peakSalesHour = pickTopSalesMetric(salesHourlyMap, "N/A");
    const peakSalesDay = pickTopSalesMetric(salesWeekdayMap, "N/A");
    const salesHourlySeries = buildHourlySalesSeriesByMode(salesHourlyMap, dayMode);
    const salesDailySeries = buildDailySalesSeries(salesDailyMap, startDate, endDate);
    const salesWeekdaySeries = buildWeekdaySalesSeries(salesWeekdayMap);

    const metaSpendUsdMap = await fetchMetaAdsDailySpend(startDate, endDate);
    const hasMetaSpend = metaSpendUsdMap.size > 0;
    const metaHourlySpendMap = await fetchMetaAdsHourlySpend(startDate, endDate, matrixDayMode);
    const hasMetaHourlySpend = metaHourlySpendMap.size > 0;
    const hourlyProfitabilityRows: HourlyProfitabilityPoint[] = [];

    const dateKeys: string[] = [];
    const cursor = new Date(`${startDate}T00:00:00.000Z`);
    const rangeEnd = new Date(`${endDate}T00:00:00.000Z`);
    while (cursor <= rangeEnd) {
      dateKeys.push(cursor.toISOString().split("T")[0]);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const matrixDayHourMap = new Map<string, { count: number; revenueInr: number }>();
    type AggregatedMatrixRow = {
      dayKey: string;
      hour: number;
      kind: "sale" | "refund";
      signedAmount: number;
    };

    const matrixRows: AggregatedMatrixRow[] = paymentFinancialRows
      .map((row) => {
        const grouped = getMatrixDateGroup(row.created, matrixDayMode);
        if (!inRange(grouped.dayKey)) return null;
        return {
          dayKey: grouped.dayKey,
          hour: grouped.hour,
          kind: row.kind,
          signedAmount: row.signedAmount,
        } as AggregatedMatrixRow;
      })
      .filter((row): row is AggregatedMatrixRow => !!row);

    for (const row of matrixRows) {
      const countDelta = row.kind === "refund" ? -1 : 1;
      const key = `${row.dayKey}|${row.hour}`;
      const prev = matrixDayHourMap.get(key) || { count: 0, revenueInr: 0 };
      prev.count += countDelta;
      prev.revenueInr += row.signedAmount;
      matrixDayHourMap.set(key, prev);
    }

    for (const dayKey of dateKeys) {
      const weekday = getWeekdayFromIsoDate(dayKey);

      for (let hour = 0; hour < 24; hour++) {
        const hourLabel = formatHourLabel(hour, matrixDayMode);
        const dayHour = matrixDayHourMap.get(`${dayKey}|${hour}`) || { count: 0, revenueInr: 0 };
        const hourRevenue = dayHour.revenueInr;
        const hourCount = dayHour.count;
        const hourSpend = metaHourlySpendMap.get(`${dayKey}|${hour}`) || 0;
        const hourProfit = hourRevenue - hourSpend;
        const hourRoas = hourSpend > 0 ? hourRevenue / hourSpend : 0;

        hourlyProfitabilityRows.push({
          date: dayKey,
          weekday,
          hour,
          label: hourLabel,
          orderCount: hourCount,
          revenueInr: Number(hourRevenue.toFixed(2)),
          profitInr: Number(hourProfit.toFixed(2)),
          roas: Number(hourRoas.toFixed(4)),
        });
      }
    }

    const vercelData = await fetchVercelAnalyticsData(startIso, endIso, dayMode, startDate, endDate);
    const gaData = await fetchGoogleAnalyticsData(startDate, endDate, dayMode);
    const internalRouteData = await fetchInternalRouteAnalytics(startIso, endIso, dayMode, startDate, endDate);

    const useVercelRouteData = vercelData.totalSessions > 0 || vercelData.routeMetrics.some((row) => row.pageViews > 0);
    const useInternalRouteData = internalRouteData.totalSessions > 0 || internalRouteData.routeMetrics.length > 0;
    const useGaRouteData = gaData.sourceStatus.connected && (gaData.totalSessions > 0 || gaData.routeMetrics.length > 0);
    const internalHasBetterRouteCoverage =
      useInternalRouteData &&
      (!useVercelRouteData || internalRouteData.totalPageViews >= vercelData.totalPageViews);

    const selectedRouteData = useGaRouteData
      ? gaData
      : internalHasBetterRouteCoverage
        ? {
            ...internalRouteData,
            sourceStatus: {
              configured: true,
              connected: true,
              message:
                useVercelRouteData && vercelData.totalPageViews < internalRouteData.totalPageViews
                  ? "Using first-party route analytics because GA4 is unavailable and the Vercel drain copy is incomplete for this range."
                  : "Using first-party Supabase analytics events because GA4 is unavailable.",
            } as SourceStatus,
          }
        : useVercelRouteData
          ? vercelData
          : gaData;

    const paymentStarts = selectedPaymentRows.length;
    const paywallSignal = inferPaywallVisitors(selectedRouteData.routeMetrics);
    const totalVisitors = selectedRouteData.totalSessions > 0 ? selectedRouteData.totalSessions : paymentStarts;
    const paywallVisitors = paywallSignal.visitors > 0 ? paywallSignal.visitors : paymentStarts;
    const exitedWithoutPaying = Math.max(totalVisitors - paidOrders, 0);
    const conversionRateRaw = totalVisitors > 0 ? (paidOrders / totalVisitors) * 100 : 0;
    const conversionRate = Math.min(conversionRateRaw, 100);
    const dropOffRate = totalVisitors > 0 ? (exitedWithoutPaying / totalVisitors) * 100 : 0;

    return NextResponse.json({
      range: {
        startDate,
        endDate,
        timezone: "Asia/Kolkata",
        dayMode,
      },
      kpis: {
        paidOrders,
        refundedOrders,
        paidRevenueInr: Number(totalRevenueInr.toFixed(2)),
        pendingPayments: pendingRows.length,
        failedPayments: failedRows.length,
        checkoutStarts: totalVisitors,
        checkoutToPaidRate: Number(conversionRate.toFixed(2)),
      },
      funnel: {
        totalVisitors,
        paywallVisitors,
        paidOrders,
        exitedWithoutPaying,
        conversionRate: Number(conversionRate.toFixed(2)),
        dropOffRate: Number(dropOffRate.toFixed(2)),
        paywallRoute: paywallSignal.matchedRoute,
      },
      peaks: {
        sales: {
          hour: peakSalesHour,
          day: peakSalesDay,
        },
        traffic: {
          hour: selectedRouteData.peakTrafficHour,
          day: selectedRouteData.peakTrafficDay,
        },
      },
      trends: {
        sales: {
          hourly: salesHourlySeries,
          daily: salesDailySeries,
          weekday: salesWeekdaySeries,
        },
        traffic: {
          hourly: selectedRouteData.hourlySeries,
          daily: selectedRouteData.dailySeries,
          weekday: selectedRouteData.weekdaySeries,
        },
      },
      hourlyProfitability: {
        rows: hourlyProfitabilityRows,
        exchangeRate: 1,
        adsSource: hasMetaHourlySpend ? "meta" : "none",
        dayMode: matrixDayMode,
      },
      traffic: {
        totalSessions: selectedRouteData.totalSessions,
        totalPageViews: selectedRouteData.totalPageViews,
        overallBounceRate: Number(selectedRouteData.overallBounceRate.toFixed(2)),
        avgSessionDurationSec: Number(selectedRouteData.avgSessionDurationSec.toFixed(2)),
      },
      routes: selectedRouteData.routeMetrics,
      sources: {
        sales: {
          configured: true,
          connected: true,
          message: hasStripeSalesData
            ? "Sales are sourced from Stripe/Supabase payment rows using fulfilled_at when available."
            : "No paid Stripe/Supabase sales rows were found for the selected range.",
        },
        googleAnalytics: gaData.sourceStatus,
        clarity: {
          configured: Boolean(process.env.NEXT_PUBLIC_CLARITY_ID),
          connected: false,
          message: process.env.NEXT_PUBLIC_CLARITY_ID
            ? "Clarity script is installed. Add server API token/project envs to pull route metrics here."
            : "Clarity not configured.",
        },
        vercelAnalytics: {
          configured: vercelData.sourceStatus.configured,
          connected: vercelData.sourceStatus.connected,
          message: vercelData.sourceStatus.message,
        },
        internal: {
          configured: true,
          connected: true,
          message: "Sales + internal fallback metrics are active.",
        },
      },
      notes: [
        useInternalRouteData
          ? "Traffic, route viewers, and hourly/day buckets are sourced from first-party Supabase analytics events."
          : "Traffic and route stats are sourced from GA4 because no first-party Supabase traffic events were available.",
        paywallSignal.matchedRoute
          ? `Paywall audience inferred from route: ${paywallSignal.matchedRoute}.`
          : "Paywall audience inferred from payment starts because paywall route traffic was unavailable.",
        "Checkout funnel conversion is calculated using total visitors (not only paywall visitors).",
        hasStripeSalesData
          ? "Sales metrics are sourced from Stripe/Supabase payment rows with refund/chargeback rows subtracted."
          : "No Stripe/Supabase sales rows were detected in this range.",
        refundRows.length > 0 || refundedOrders > 0
          ? "Refund and chargeback events are subtracted from revenue metrics."
          : "No refund events were detected in this range.",
        hasMetaSpend
          ? hasMetaHourlySpend
            ? "ROAS uses Meta hourly spend by advertiser time zone joined to Stripe/Supabase revenue for the same Stripe-day hour."
            : "Hourly matrix shows Stripe revenue only. Meta daily spend exists, but hourly spend was unavailable, so no fake hourly ROAS is calculated."
          : "Hourly matrix shows Stripe revenue only because no Meta spend source is available.",
        matrixDayMode === "business_1130_ist"
          ? "Matrix day mode: Stripe day (11:30 AM IST to next day 11:29 AM IST, where 11:30 AM IST is treated as 12:00 AM)."
          : "Matrix day mode: IST calendar day (00:00 to 23:59 IST).",
        dayMode === "business_1130_ist"
          ? "Global day mode: Stripe day (11:30 AM IST to next day 11:29 AM IST, where 11:30 AM IST is treated as 12:00 AM)."
          : "Global day mode: IST calendar day (00:00 to 23:59 IST).",
      ],
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: unknown) {
    console.error("Admin analytics API error:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch analytics data";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
