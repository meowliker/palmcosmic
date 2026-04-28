export type FuturePartnerScreen = FuturePartnerQuestionScreen | FuturePartnerImageScreen;

export interface FuturePartnerQuestionScreen {
  type: "question";
  id: string;
  progress: number;
  title: string;
  options: string[];
  nextRoute: string;
}

export interface FuturePartnerImageScreen {
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

export const futurePartnerScreens = {
  intro: {
    type: "image",
    id: "future-partner-intro",
    progress: 86,
    title: "Your future partner may already be written in your stars",
    body: "Your birth details can reveal the kind of connection, timing, and emotional pattern that may shape your next meaningful relationship.",
    imageSrc: "/future-partner-intro.png",
    imageAlt: "Romantic couple with soft cosmic lighting",
    imagePosition: "object-center",
    nextRoute: "/onboarding/future-partner/partner-type",
  },
  partnerType: {
    type: "question",
    id: "future-partner-partner-type",
    progress: 88,
    title: "What kind of partner feels most aligned with you?",
    options: [
      "Warm, loyal, and emotionally present",
      "Ambitious, passionate, and driven",
      "Playful, smart, and adventurous",
      "Calm, grounded, and supportive",
    ],
    nextRoute: "/onboarding/future-partner/love-language",
  },
  loveLanguage: {
    type: "question",
    id: "future-partner-love-language",
    progress: 90,
    title: "How do you most naturally receive love?",
    options: [
      "Quality time and full attention",
      "Words that reassure and affirm me",
      "Thoughtful gestures and acts of care",
      "Physical closeness and affection",
      "Meaningful gifts with real intention",
    ],
    nextRoute: "/onboarding/future-partner/relationship-values",
  },
  relationshipValues: {
    type: "question",
    id: "future-partner-relationship-values",
    progress: 92,
    title: "What matters most in your future relationship?",
    options: [
      "Trust, respect, and emotional safety",
      "Honesty even when conversations are hard",
      "A deep bond that still feels exciting",
      "Stability through difficult seasons",
      "Shared growth and long-term commitment",
    ],
    nextRoute: "/onboarding/future-partner/ideal-date",
  },
  idealDate: {
    type: "question",
    id: "future-partner-ideal-date",
    progress: 94,
    title: "Which date would make you feel most connected?",
    options: [
      "A cozy dinner with honest conversation",
      "A quiet movie night close together",
      "A spontaneous trip or live music night",
      "Something active, outdoors, and fun",
      "No plan, just being together",
    ],
    nextRoute: "/onboarding/future-partner/cosmic-timing",
  },
  cosmicTiming: {
    type: "image",
    id: "future-partner-cosmic-timing",
    progress: 99,
    title: "Your love timing is being mapped",
    body: "Elysia is reading relationship patterns in your chart to highlight the kind of partner, energy, and timing that may feel most aligned.",
    imageSrc: "/future-partner-cosmic-timing.png",
    imageAlt: "Cosmic moon and relationship timing glow",
    imagePosition: "object-center",
    nextRoute: "/onboarding/future-partner/email",
  },
} satisfies Record<string, FuturePartnerScreen>;
