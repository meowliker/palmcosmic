"use client";

import { trackCustomEvent, trackPixelEvent } from "@/lib/pixel-events";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    clarity?: (...args: any[]) => void;
  }
}

export type AnalyticsParams = Record<string, string | number | boolean | null | undefined>;

function cleanParams(params: AnalyticsParams = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

export function trackAnalyticsEvent(eventName: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;

  const payload = cleanParams(params);

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
