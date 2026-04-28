export type CompatibilityScreen = CompatibilityQuestionScreen | CompatibilityImageScreen;

export interface CompatibilityQuestionScreen {
  type: "question";
  id: string;
  progress: number;
  title: string;
  options: string[];
  nextRoute: string;
}

export interface CompatibilityImageScreen {
  type: "image";
  id: string;
  progress: number;
  title: string;
  body?: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition?: string;
  nextRoute: string;
}

export const compatibilityScreens = {
  intro: {
    type: "image",
    id: "compatibility-intro",
    progress: 86,
    title: "Your connection has a deeper pattern",
    body: "PalmCosmic can compare your birth energy with someone special to reveal emotional rhythm, attraction, and long-term compatibility clues.",
    imageSrc: "/compatibility-intro.png",
    imageAlt: "Romantic couple with a soft cosmic compatibility glow",
    imagePosition: "object-center",
    nextRoute: "/onboarding/compatibility/partner-gender",
  },
  partnerGender: {
    type: "question",
    id: "compatibility-partner-gender",
    progress: 88,
    title: "Please select your partner's gender",
    options: ["Female", "Male"],
    nextRoute: "/onboarding/compatibility/partner-birthday",
  },
  ready: {
    type: "image",
    id: "compatibility-ready",
    progress: 99,
    title: "Your compatibility map is almost ready",
    body: "Your answers help focus the report on emotional harmony, timing patterns, attraction, and where this connection may need more care.",
    imageSrc: "/compatibility-ready.png",
    imageAlt: "Glowing heart in soft clouds symbolizing compatibility",
    imagePosition: "object-center",
    nextRoute: "/onboarding/compatibility/email",
  },
} satisfies Record<string, CompatibilityScreen>;

export const COMPATIBILITY_ANSWER_KEYS = [
  "priority_area",
  "compatibility-partner-gender",
  "compatibility-partner-birth-day",
  "compatibility-partner-birth-month",
  "compatibility-partner-birth-year",
  "compatibility-partner-birth-date-known",
  "compatibility-partner-birthplace",
  "compatibility-partner-birthplace-known",
  "compatibility-partner-birth-hour",
  "compatibility-partner-birth-minute",
  "compatibility-partner-birth-time-known",
];
