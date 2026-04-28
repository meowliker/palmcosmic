export type SoulmateSketchScreen =
  | SoulmateSketchQuestionScreen
  | SoulmateSketchImageScreen;

export interface SoulmateSketchQuestionScreen {
  type: "question";
  id: string;
  answerKey: string;
  progress: number;
  title: string;
  options: string[];
  nextRoute: string;
}

export interface SoulmateSketchImageScreen {
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

export const soulmateSketchScreens = {
  intro: {
    type: "image",
    id: "soulmate-intro",
    progress: 86,
    title: "Your soulmate sketch is beginning to take shape",
    body: "PalmCosmic uses your answers to tune the portrait toward the energy, presence, and traits you feel drawn to.",
    imageSrc: "/soulmate-sketch-intro.png",
    imageAlt: "Cosmic soulmate portrait forming inside a zodiac circle",
    imagePosition: "object-[50%_48%]",
    nextRoute: "/onboarding/soulmate-sketch/partner-gender",
  },
  partnerGender: {
    type: "question",
    id: "soulmate-partner-gender",
    answerKey: "attracted_to",
    progress: 88,
    title: "Who are you looking to meet?",
    options: ["Male", "Female"],
    nextRoute: "/onboarding/soulmate-sketch/age-range",
  },
  ageRange: {
    type: "question",
    id: "soulmate-age-range",
    answerKey: "age_group",
    progress: 91,
    title: "Which age range feels aligned for your future partner?",
    options: ["20-27", "28-35", "36-45", "46-54", "55+"],
    nextRoute: "/onboarding/soulmate-sketch/visual-style",
  },
  visualStyle: {
    type: "question",
    id: "soulmate-visual-style",
    answerKey: "appearance_preference",
    progress: 94,
    title: "Do you have a preferred look for your sketch?",
    options: [
      "White / European",
      "Hispanic / Latino",
      "Black / African descent",
      "Asian",
      "Middle Eastern / North African",
      "No Preference",
    ],
    nextRoute: "/onboarding/soulmate-sketch/core-quality",
  },
  coreQuality: {
    type: "question",
    id: "soulmate-core-quality",
    answerKey: "vibe",
    progress: 97,
    title: "Which quality matters most in your future partner?",
    options: [
      "Emotional understanding",
      "Creative energy",
      "Loyal devotion",
      "Grounded wisdom",
      "A gentle heart",
      "Magnetic passion",
    ],
    nextRoute: "/onboarding/soulmate-sketch/email",
  },
} satisfies Record<string, SoulmateSketchScreen>;
