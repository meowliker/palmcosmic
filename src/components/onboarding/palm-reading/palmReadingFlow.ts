export type PalmReadingScreen = PalmReadingQuestionScreen | PalmReadingImageScreen;

export interface PalmReadingQuestionScreen {
  type: "question";
  id: string;
  progress: number;
  title: string;
  options: string[];
  nextRoute: string;
}

export interface PalmReadingImageScreen {
  type: "image";
  id: string;
  progress: number;
  title: string;
  body?: string;
  imageSrc?: string;
  imageAlt: string;
  imagePosition?: string;
  nextRoute: string;
}

export const palmReadingScreens = {
  intro: {
    type: "image",
    id: "palm-intro",
    progress: 86,
    title: "Your palm lines can reveal more than you think",
    body: "Every major line carries clues about your instincts, emotional patterns, strengths, and the timing of important life chapters.",
    imageSrc: "/palm-reading-intro.png",
    imageAlt: "Glowing palm outline with cosmic line details",
    imagePosition: "object-center",
    nextRoute: "/onboarding/palm-reading/line-focus",
  },
  lineFocus: {
    type: "question",
    id: "palm-line-focus",
    progress: 88,
    title: "Which palm line are you most curious about?",
    options: [
      "My heart line and emotional patterns",
      "My life line and vitality",
      "My head line and decision style",
      "My fate line and life direction",
      "I want the full palm picture",
    ],
    nextRoute: "/onboarding/palm-reading/life-area",
  },
  lifeArea: {
    type: "question",
    id: "palm-life-area",
    progress: 90,
    title: "What part of your life should the reading focus on?",
    options: [
      "Love and relationships",
      "Career and money direction",
      "Personality and hidden strengths",
      "Health, energy, and balance",
      "Everything my palm can show",
    ],
    nextRoute: "/onboarding/palm-reading/clarity",
  },
  clarity: {
    type: "question",
    id: "palm-clarity",
    progress: 92,
    title: "What kind of clarity would feel most useful right now?",
    options: [
      "Why I repeat certain patterns",
      "What strengths I should trust more",
      "Where my path may be opening",
      "What I should be careful about",
    ],
    nextRoute: "/onboarding/palm-reading/hand-map",
  },
  handMap: {
    type: "image",
    id: "palm-hand-map",
    progress: 94,
    title: "Your palm is a map of lived energy",
    body: "The depth, curve, and spacing of your lines help shape a reading that feels personal instead of generic.",
    imageSrc: "/palm-reading-hand-map.png",
    imageAlt: "Palm line map with highlighted line areas",
    imagePosition: "object-center",
    nextRoute: "/onboarding/palm-reading/personality",
  },
  personality: {
    type: "question",
    id: "palm-personality",
    progress: 96,
    title: "Which description feels closest to you?",
    options: [
      "I feel deeply and notice subtle shifts",
      "I think carefully before I move",
      "I follow intuition even when it is hard to explain",
      "I carry pressure quietly and keep going",
      "I am still discovering who I am becoming",
    ],
    nextRoute: "/onboarding/palm-reading/timing",
  },
  timing: {
    type: "question",
    id: "palm-timing",
    progress: 98,
    title: "What would you like your palm reading to help you understand?",
    options: [
      "My emotional tendencies",
      "My career and purpose signals",
      "My relationship timing",
      "My personal strengths and challenges",
      "A balanced reading of all areas",
    ],
    nextRoute: "/onboarding/palm-reading/ready",
  },
  ready: {
    type: "image",
    id: "palm-ready",
    progress: 99,
    title: "Elysia is preparing your palm line reading",
    body: "Your answers help focus the analysis on the lines, mounts, and patterns that matter most to your story.",
    imageSrc: "/palm-reading-ready.png",
    imageAlt: "Cosmic palm analysis preparation",
    imagePosition: "object-center",
    nextRoute: "/onboarding/palm-reading/email",
  },
} satisfies Record<string, PalmReadingScreen>;
