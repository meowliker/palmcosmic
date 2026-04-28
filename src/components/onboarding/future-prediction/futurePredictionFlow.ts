export type FuturePredictionScreen =
  | FuturePredictionQuestionScreen
  | FuturePredictionImageScreen;

export interface FuturePredictionQuestionScreen {
  type: "question";
  id: string;
  progress: number;
  title: string;
  options: string[];
  nextRoute: string;
}

export interface FuturePredictionImageScreen {
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

export const futurePredictionScreens = {
  intro: {
    type: "image",
    id: "future-intro",
    progress: 86,
    title: "Your future is already forming in the stars",
    body: "Our astrologers can map your upcoming timing, turning points, and opportunities into clear guidance.",
    imageAlt: "Person looking toward a glowing celestial path",
    imagePosition: "object-[50%_58%]",
    nextRoute: "/onboarding/future-prediction/focus",
  },
  focus: {
    type: "question",
    id: "future-focus",
    progress: 88,
    title: "What would you most like to understand about your future?",
    options: [
      "Career growth and financial timing",
      "Love, marriage, and emotional direction",
      "Personal purpose and life path",
      "Health, balance, and inner stability",
      "A complete picture of what is ahead",
    ],
    nextRoute: "/onboarding/future-prediction/relationships",
  },
  relationships: {
    type: "question",
    id: "future-relationships",
    progress: 90,
    title: "Which life area should your 2026 forecast focus on most?",
    options: [
      "Love and emotional bonds",
      "Career and financial progress",
      "Health, energy, and balance",
      "Personal growth and purpose",
      "All major areas equally",
    ],
    nextRoute: "/onboarding/future-prediction/decision-style",
  },
  decisionStyle: {
    type: "question",
    id: "future-decision-style",
    progress: 92,
    title: "Where do you feel most uncertain about the year ahead?",
    options: [
      "My next big life decision",
      "Love and emotional direction",
      "Career, money, and stability",
      "My personal growth and purpose",
    ],
    nextRoute: "/onboarding/future-prediction/horizon",
  },
  horizon: {
    type: "image",
    id: "future-horizon",
    progress: 94,
    title: "Important shifts may be approaching",
    body: "Your chart can highlight windows for growth, movement, and decisions so you can step forward with more confidence.",
    imageSrc: "/future-prediction-cosmic-shifts.png",
    imageAlt: "Celestial path opening toward the horizon",
    imagePosition: "object-[50%_52%]",
    nextRoute: "/onboarding/future-prediction/confidence",
  },
  confidence: {
    type: "question",
    id: "future-confidence",
    progress: 95,
    title: "What would make you feel more confident about the future?",
    options: [
      "Knowing when to act on my goals",
      "Feeling secure in love and relationships",
      "Understanding my spiritual direction",
      "Staying strong through challenges",
      "Building meaningful connections",
    ],
    nextRoute: "/onboarding/future-prediction/change",
  },
  change: {
    type: "question",
    id: "future-change",
    progress: 96,
    title: "What kind of change are you hoping for soon?",
    options: [
      "A positive breakthrough after feeling stuck",
      "Better emotional balance and peace",
      "Clearer direction for my life path",
      "More harmony with my destiny",
    ],
    nextRoute: "/onboarding/future-prediction/life-path",
  },
  lifePath: {
    type: "question",
    id: "future-life-path",
    progress: 97,
    title: "What kind of guidance would feel most helpful?",
    options: [
      "Lucky days and best timing",
      "Opportunities I should act on",
      "Challenges I should prepare for",
      "A balanced mix of everything",
    ],
    nextRoute: "/onboarding/future-prediction/ready",
  },
  ready: {
    type: "image",
    id: "future-ready",
    progress: 99,
    title: "You are ready to meet your next chapter",
    body: "Elysia is mapping your 2026 timing, key themes, and lucky windows into a forecast made around what you care about most.",
    imageSrc: "/future-prediction-next-chapter.png",
    imageAlt: "Soft cosmic clouds and stars suggesting future possibilities",
    imagePosition: "object-[50%_46%]",
    nextRoute: "/onboarding/future-prediction/email",
  },
} satisfies Record<string, FuturePredictionScreen>;
