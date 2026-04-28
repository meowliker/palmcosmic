export type OnboardingPriorityId =
  | "future-prediction"
  | "soulmate-sketch"
  | "palm-reading"
  | "future-partner"
  | "compatibility";

export type OnboardingFunnelKey =
  | "future_prediction"
  | "soulmate_sketch"
  | "palm_reading"
  | "future_partner"
  | "compatibility";

export const PRIORITY_OPTIONS: Array<{
  id: OnboardingPriorityId;
  label: string;
  funnel: OnboardingFunnelKey;
  firstRoute: string;
}> = [
  {
    id: "future-prediction",
    label: "See what the future may have in store for me",
    funnel: "future_prediction",
    firstRoute: "/onboarding/future-prediction/intro",
  },
  {
    id: "soulmate-sketch",
    label: "Reveal my soulmate sketch and reading",
    funnel: "soulmate_sketch",
    firstRoute: "/onboarding/soulmate-sketch/intro",
  },
  {
    id: "palm-reading",
    label: "Understand what my palm lines say about me",
    funnel: "palm_reading",
    firstRoute: "/onboarding/palm-reading/intro",
  },
  {
    id: "future-partner",
    label: "Discover who my future partner could be",
    funnel: "future_partner",
    firstRoute: "/onboarding/future-partner/intro",
  },
  {
    id: "compatibility",
    label: "Check my compatibility with someone special",
    funnel: "compatibility",
    firstRoute: "/onboarding/compatibility/intro",
  },
];

export const PRIORITY_ROUTE_BY_ID = PRIORITY_OPTIONS.reduce(
  (acc, option) => {
    acc[option.id] = option.firstRoute;
    return acc;
  },
  {} as Record<OnboardingPriorityId, string>
);

export function getPriorityRoute(priorityId: string): string {
  return PRIORITY_ROUTE_BY_ID[priorityId as OnboardingPriorityId] || "/onboarding/step-7";
}
