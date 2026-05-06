"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackFunnelStepView } from "@/lib/analytics-events";

const STEP_META: Record<string, { stepId: string; stepName: string; progress?: number; funnel?: string }> = {
  "/onboarding": { stepId: "trust_intro", stepName: "Trust Intro", progress: 12 },
  "/onboarding/insights-history": { stepId: "insights_history", stepName: "Insights History", progress: 24 },
  "/onboarding/why-astrorekha": { stepId: "why_palmcosmic", stepName: "Why PalmCosmic", progress: 36 },
  "/onboarding/birth-details-intro": { stepId: "birth_details_intro", stepName: "Birth Details Intro", progress: 58 },
  "/onboarding/gender": { stepId: "gender", stepName: "Gender", progress: 8 },
  "/onboarding/birthday": { stepId: "birthday", stepName: "Birthday", progress: 16 },
  "/onboarding/birth-time": { stepId: "birth_time", stepName: "Birth Time", progress: 24 },
  "/onboarding/birthplace": { stepId: "birthplace", stepName: "Birthplace", progress: 32 },
  "/onboarding/step-5": { stepId: "loading_analysis", stepName: "Loading Analysis", progress: 40 },
  "/onboarding/step-6": { stepId: "forecast_accuracy", stepName: "Forecast Accuracy", progress: 48 },
  "/onboarding/step-7": { stepId: "soulmate_sketch_step_7", stepName: "Soulmate Sketch Question 1", progress: 56 },
  "/onboarding/step-8": { stepId: "soulmate_sketch_step_8", stepName: "Soulmate Sketch Question 2", progress: 64 },
  "/onboarding/step-9": { stepId: "soulmate_sketch_step_9", stepName: "Soulmate Sketch Question 3", progress: 72 },
  "/onboarding/step-10": { stepId: "soulmate_sketch_step_10", stepName: "Soulmate Sketch Question 4", progress: 80 },
  "/onboarding/step-11": { stepId: "soulmate_sketch_step_11", stepName: "Soulmate Sketch Question 5", progress: 88 },
  "/onboarding/step-12": { stepId: "soulmate_chart_reveal", stepName: "Soulmate Chart Reveal", progress: 92 },
  "/onboarding/step-13": { stepId: "forecast_accuracy_boost", stepName: "Forecast Accuracy Boost", progress: 96 },
  "/onboarding/step-14": { stepId: "palm_scan", stepName: "Palm Scan", progress: 98 },
  "/onboarding/step-15": { stepId: "forecast_accuracy_complete", stepName: "Forecast Accuracy Complete", progress: 99 },
  "/onboarding/email": { stepId: "email", stepName: "Email Capture", progress: 99 },
  "/paywall": { stepId: "bundle_paywall", stepName: "Lifetime Bundle Paywall", progress: 100, funnel: "palm_reading" },
  "/upsell": { stepId: "bundle_upsell", stepName: "Bundle Upsell", progress: 100, funnel: "palm_reading" },
  "/registration": { stepId: "registration", stepName: "Registration", progress: 100, funnel: "palm_reading" },
  "/onboarding/future-prediction/intro": { stepId: "future_intro", stepName: "Future Intro", progress: 86, funnel: "future_prediction" },
  "/onboarding/future-prediction/focus": { stepId: "future_focus", stepName: "Future Focus", progress: 88, funnel: "future_prediction" },
  "/onboarding/future-prediction/relationships": { stepId: "future_relationships", stepName: "Future Relationships", progress: 90, funnel: "future_prediction" },
  "/onboarding/future-prediction/decision-style": { stepId: "future_decision_style", stepName: "Future Decision Style", progress: 92, funnel: "future_prediction" },
  "/onboarding/future-prediction/horizon": { stepId: "future_horizon", stepName: "Future Horizon", progress: 94, funnel: "future_prediction" },
  "/onboarding/future-prediction/confidence": { stepId: "future_confidence", stepName: "Future Confidence", progress: 95, funnel: "future_prediction" },
  "/onboarding/future-prediction/change": { stepId: "future_change", stepName: "Future Change", progress: 96, funnel: "future_prediction" },
  "/onboarding/future-prediction/life-path": { stepId: "future_life_path", stepName: "Future Life Path", progress: 97, funnel: "future_prediction" },
  "/onboarding/future-prediction/ready": { stepId: "future_ready", stepName: "Future Ready", progress: 99, funnel: "future_prediction" },
  "/onboarding/future-prediction/email": { stepId: "future_email", stepName: "Future Email", progress: 99, funnel: "future_prediction" },
  "/onboarding/future-prediction/paywall": { stepId: "future_paywall", stepName: "Future Prediction Paywall", progress: 100, funnel: "future_prediction" },
  "/onboarding/soulmate-sketch/intro": { stepId: "soulmate_intro", stepName: "Soulmate Sketch Intro", progress: 86, funnel: "soulmate_sketch" },
  "/onboarding/soulmate-sketch/partner-gender": { stepId: "soulmate_partner_gender", stepName: "Soulmate Partner Gender", progress: 88, funnel: "soulmate_sketch" },
  "/onboarding/soulmate-sketch/age-range": { stepId: "soulmate_age_range", stepName: "Soulmate Age Range", progress: 91, funnel: "soulmate_sketch" },
  "/onboarding/soulmate-sketch/visual-style": { stepId: "soulmate_visual_style", stepName: "Soulmate Visual Style", progress: 94, funnel: "soulmate_sketch" },
  "/onboarding/soulmate-sketch/core-quality": { stepId: "soulmate_core_quality", stepName: "Soulmate Core Quality", progress: 97, funnel: "soulmate_sketch" },
  "/onboarding/soulmate-sketch/email": { stepId: "soulmate_email", stepName: "Soulmate Email", progress: 99, funnel: "soulmate_sketch" },
  "/onboarding/soulmate-sketch/paywall": { stepId: "soulmate_paywall", stepName: "Soulmate Sketch Paywall", progress: 100, funnel: "soulmate_sketch" },
  "/onboarding/palm-reading/intro": { stepId: "palm_intro", stepName: "Palm Reading Intro", progress: 86, funnel: "palm_reading" },
  "/onboarding/palm-reading/line-focus": { stepId: "palm_line_focus", stepName: "Palm Line Focus", progress: 88, funnel: "palm_reading" },
  "/onboarding/palm-reading/life-area": { stepId: "palm_life_area", stepName: "Palm Life Area", progress: 90, funnel: "palm_reading" },
  "/onboarding/palm-reading/clarity": { stepId: "palm_clarity", stepName: "Palm Clarity", progress: 92, funnel: "palm_reading" },
  "/onboarding/palm-reading/hand-map": { stepId: "palm_hand_map", stepName: "Palm Hand Map", progress: 94, funnel: "palm_reading" },
  "/onboarding/palm-reading/personality": { stepId: "palm_personality", stepName: "Palm Personality", progress: 96, funnel: "palm_reading" },
  "/onboarding/palm-reading/timing": { stepId: "palm_timing", stepName: "Palm Timing", progress: 98, funnel: "palm_reading" },
  "/onboarding/palm-reading/ready": { stepId: "palm_ready", stepName: "Palm Ready", progress: 99, funnel: "palm_reading" },
  "/onboarding/palm-reading/email": { stepId: "palm_email", stepName: "Palm Email", progress: 99, funnel: "palm_reading" },
  "/onboarding/palm-reading/paywall": { stepId: "palm_paywall", stepName: "Palm Reading Paywall", progress: 100, funnel: "palm_reading" },
  "/onboarding/future-partner/intro": { stepId: "future_partner_intro", stepName: "Future Partner Intro", progress: 86, funnel: "future_partner" },
  "/onboarding/future-partner/partner-type": { stepId: "future_partner_type", stepName: "Future Partner Type", progress: 88, funnel: "future_partner" },
  "/onboarding/future-partner/love-language": { stepId: "future_partner_love_language", stepName: "Future Partner Love Language", progress: 90, funnel: "future_partner" },
  "/onboarding/future-partner/relationship-values": { stepId: "future_partner_relationship_values", stepName: "Future Partner Relationship Values", progress: 92, funnel: "future_partner" },
  "/onboarding/future-partner/ideal-date": { stepId: "future_partner_ideal_date", stepName: "Future Partner Ideal Date", progress: 94, funnel: "future_partner" },
  "/onboarding/future-partner/cosmic-timing": { stepId: "future_partner_cosmic_timing", stepName: "Future Partner Cosmic Timing", progress: 99, funnel: "future_partner" },
  "/onboarding/future-partner/email": { stepId: "future_partner_email", stepName: "Future Partner Email", progress: 99, funnel: "future_partner" },
  "/onboarding/future-partner/paywall": { stepId: "future_partner_paywall", stepName: "Future Partner Paywall", progress: 100, funnel: "future_partner" },
  "/onboarding/compatibility/intro": { stepId: "compatibility_intro", stepName: "Compatibility Intro", progress: 86, funnel: "compatibility" },
  "/onboarding/compatibility/partner-gender": { stepId: "compatibility_partner_gender", stepName: "Compatibility Partner Gender", progress: 88, funnel: "compatibility" },
  "/onboarding/compatibility/partner-birthday": { stepId: "compatibility_partner_birthday", stepName: "Compatibility Partner Birthday", progress: 91, funnel: "compatibility" },
  "/onboarding/compatibility/partner-birthplace": { stepId: "compatibility_partner_birthplace", stepName: "Compatibility Partner Birthplace", progress: 94, funnel: "compatibility" },
  "/onboarding/compatibility/partner-birth-time": { stepId: "compatibility_partner_birth_time", stepName: "Compatibility Partner Birth Time", progress: 97, funnel: "compatibility" },
  "/onboarding/compatibility/ready": { stepId: "compatibility_ready", stepName: "Compatibility Ready", progress: 99, funnel: "compatibility" },
  "/onboarding/compatibility/email": { stepId: "compatibility_email", stepName: "Compatibility Email", progress: 99, funnel: "compatibility" },
  "/onboarding/compatibility/paywall": { stepId: "compatibility_paywall", stepName: "Compatibility Paywall", progress: 100, funnel: "compatibility" },
  "/onboarding/create-password": { stepId: "create_password", stepName: "Create Password", progress: 100, funnel: "post_payment" },
};

export function OnboardingFunnelTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const route = pathname || "";
    const meta = STEP_META[route];
    if (!meta) return;

    const dedupeKey = `palmcosmic_step_view_${route}`;
    if (sessionStorage.getItem(dedupeKey) === "true") return;
    sessionStorage.setItem(dedupeKey, "true");

    trackFunnelStepView({
      route,
      stepId: meta.stepId,
      stepName: meta.stepName,
      progress: meta.progress,
      funnel: meta.funnel,
    });
  }, [pathname]);

  return null;
}
