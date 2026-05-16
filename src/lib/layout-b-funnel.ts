export type LayoutVariant = "A" | "B";

export type SketchQuestionId =
  | "relationship_status"
  | "future_goal"
  | "color_preference"
  | "element_preference";

export interface SketchQuestionOption {
  value: string;
  label: string;
  emoji: string;
}

export interface SketchQuestion {
  id: SketchQuestionId;
  title: string;
  options: SketchQuestionOption[];
}

export interface LayoutBFunnelConfig {
  testId: string;
  enabled: boolean;
  layoutBEnabled: boolean;
  variantAWeight: number;
  variantBWeight: number;
  maxSketchPerUser: number;
  questionOrder: SketchQuestionId[];
  questions: Record<SketchQuestionId, boolean>;
}

export const SKETCH_QUESTION_BANK: SketchQuestion[] = [
  {
    id: "relationship_status",
    title: "To get started, tell us about your current relationship status",
    options: [
      { value: "in-relationship", label: "In a relationship", emoji: "💕" },
      { value: "just-broke-up", label: "Just broke up", emoji: "💔" },
      { value: "engaged", label: "Engaged", emoji: "🥰" },
      { value: "married", label: "Married", emoji: "💍" },
      { value: "looking-for-soulmate", label: "Looking for a soulmate", emoji: "🔍" },
      { value: "single", label: "Single", emoji: "😊" },
      { value: "complicated", label: "It's complicated", emoji: "🤔" },
    ],
  },
  {
    id: "future_goal",
    title: "What are your goals for the future?",
    options: [
      { value: "family-harmony", label: "Family harmony", emoji: "👨‍👩‍👧" },
      { value: "career", label: "Career", emoji: "🏆" },
      { value: "health", label: "Health", emoji: "🍎" },
      { value: "getting-married", label: "Getting married", emoji: "💒" },
      { value: "traveling", label: "Traveling the world", emoji: "🌍" },
      { value: "education", label: "Education", emoji: "🎓" },
      { value: "friends", label: "Friends", emoji: "👥" },
      { value: "children", label: "Children", emoji: "👶" },
    ],
  },
  {
    id: "color_preference",
    title: "Which of the following colors do you prefer?",
    options: [
      { value: "red", label: "Red", emoji: "🔴" },
      { value: "yellow", label: "Yellow", emoji: "🟡" },
      { value: "blue", label: "Blue", emoji: "🔵" },
      { value: "orange", label: "Orange", emoji: "🟠" },
      { value: "green", label: "Green", emoji: "🟢" },
      { value: "violet", label: "Violet", emoji: "🟣" },
    ],
  },
  {
    id: "element_preference",
    title: "Which element of nature do you like the best?",
    options: [
      { value: "earth", label: "Earth", emoji: "🌍" },
      { value: "water", label: "Water", emoji: "💧" },
      { value: "fire", label: "Fire", emoji: "🔥" },
      { value: "air", label: "Air", emoji: "🌬️" },
    ],
  },
];

export const DEFAULT_LAYOUT_B_CONFIG: LayoutBFunnelConfig = {
  testId: "onboarding-layout-qa",
  enabled: false,
  layoutBEnabled: false,
  variantAWeight: 100,
  variantBWeight: 0,
  maxSketchPerUser: 1,
  questionOrder: [
    "relationship_status",
    "future_goal",
    "color_preference",
    "element_preference",
  ],
  questions: {
    relationship_status: true,
    future_goal: true,
    color_preference: true,
    element_preference: true,
  },
};

export function normalizeLayoutBConfig(raw: any): LayoutBFunnelConfig {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const questions = {
    ...DEFAULT_LAYOUT_B_CONFIG.questions,
    ...(cfg.questions || {}),
  };

  const validOrder = Array.isArray(cfg.questionOrder)
    ? cfg.questionOrder.filter((id: unknown): id is SketchQuestionId =>
        typeof id === "string" && SKETCH_QUESTION_BANK.some((q) => q.id === id)
      )
    : [];

  const questionOrder = validOrder.length > 0 ? validOrder : DEFAULT_LAYOUT_B_CONFIG.questionOrder;

  const parseInteger = (value: unknown, fallback: number) => {
    if (value === null || value === undefined || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const variantAWeight = Math.min(100, Math.max(0, parseInteger(cfg.variantAWeight, DEFAULT_LAYOUT_B_CONFIG.variantAWeight)));
  const variantBWeight = Math.min(100, Math.max(0, parseInteger(cfg.variantBWeight, DEFAULT_LAYOUT_B_CONFIG.variantBWeight)));
  const maxSketchPerUser = Math.max(1, parseInteger(cfg.maxSketchPerUser, DEFAULT_LAYOUT_B_CONFIG.maxSketchPerUser));

  return {
    ...DEFAULT_LAYOUT_B_CONFIG,
    ...cfg,
    variantAWeight,
    variantBWeight,
    maxSketchPerUser,
    questionOrder,
    questions,
  };
}

export function getActiveSketchQuestions(config: LayoutBFunnelConfig): SketchQuestion[] {
  const byId = new Map(SKETCH_QUESTION_BANK.map((q) => [q.id, q]));
  return config.questionOrder
    .filter((id) => config.questions[id] !== false)
    .map((id) => byId.get(id))
    .filter((q): q is SketchQuestion => !!q);
}
