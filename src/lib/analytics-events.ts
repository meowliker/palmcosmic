"use client";

import { trackCustomEvent, trackPixelEvent } from "@/lib/pixel-events";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    clarity?: (...args: any[]) => void;
  }
}

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "campaign_id",
  "adset_id",
  "ad_id",
  "meta_campaign_id",
  "meta_adset_id",
  "meta_ad_id",
] as const;

function getAnalyticsSessionId() {
  if (typeof window === "undefined") return "";
  const key = "palmcosmic_analytics_session_id";
  const existing = sessionStorage.getItem(key);
  if (existing) return existing;

  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem(key, id);
  return id;
}

function getStoredAttribution(): AnalyticsParams {
  if (typeof window === "undefined") return {};
  const storageKey = "palmcosmic_first_touch_attribution";
  const params = new URLSearchParams(window.location.search);
  const fresh: AnalyticsParams = {};

  ATTRIBUTION_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) fresh[key] = value.slice(0, 500);
  });

  const hasFreshAttribution = Object.keys(fresh).length > 0;
  if (hasFreshAttribution) {
    const payload = {
      ...fresh,
      landing_page: window.location.pathname,
      captured_at: new Date().toISOString(),
    };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    return payload;
  }

  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    ) as AnalyticsParams;
  } catch {
    return {};
  }
}

function cleanParams(params: AnalyticsParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

function trackFirstPartyEvent(eventName: string, params: AnalyticsParams = {}, routeOverride?: string) {
  if (typeof window === "undefined") return;

  const payload = {
    eventName,
    params: cleanParams({
      ...getStoredAttribution(),
      ...params,
    }),
    route: routeOverride || String(params.route || window.location.pathname || "/"),
    sessionId: getAnalyticsSessionId(),
    userId:
      window.localStorage.getItem("palmcosmic_user_id") ||
      window.localStorage.getItem("astrorekha_user_id") ||
      window.localStorage.getItem("astrorekha_anon_id") ||
      undefined,
    email:
      window.localStorage.getItem("palmcosmic_email") ||
      window.localStorage.getItem("astrorekha_email") ||
      undefined,
  };

  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/event", new Blob([body], { type: "application/json" }));
    return;
  }

  fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}

export function trackAnalyticsEvent(eventName: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;

  const payload = cleanParams(params);

  trackFirstPartyEvent(eventName, payload);

  trackCustomEvent(eventName, payload);

  if (window.gtag) {
    window.gtag("event", eventName, payload);
  }

  if (window.clarity) {
    window.clarity("event", eventName);
    Object.entries(payload).forEach(([key, value]) => {
      window.clarity?.("set", key, String(value));
    });
  }
}

export function trackFunnelStepView(params: {
  route: string;
  stepId: string;
  stepName?: string;
  funnel?: string;
  progress?: number;
}) {
  trackAnalyticsEvent("OnboardingStepView", {
    funnel: params.funnel || "onboarding",
    route: params.route,
    step_id: params.stepId,
    step_name: params.stepName || params.stepId,
    progress: params.progress,
  });
}

export function trackFunnelAction(action: string, params: AnalyticsParams = {}) {
  trackAnalyticsEvent("OnboardingAction", {
    action,
    ...params,
  });
}

export function trackLeadCaptured(params: AnalyticsParams = {}) {
  const eventId = typeof params.event_id === "string" ? params.event_id : undefined;
  trackPixelEvent("Lead", params, eventId ? { eventID: eventId } : undefined);
  trackAnalyticsEvent("LeadCaptured", params);
}

export function trackRoutePageView(path: string) {
  if (typeof window === "undefined") return;

  trackFirstPartyEvent("PageView", { route: path }, path);

  if (window.gtag) {
    window.gtag("config", process.env.NEXT_PUBLIC_GA_ID, {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }

  if (window.clarity) {
    window.clarity("event", "page_view");
    window.clarity("set", "page_path", path);
  }
}
