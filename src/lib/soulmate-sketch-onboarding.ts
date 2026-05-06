export type SoulmateSketchQuestionId =
  | "attracted_to"
  | "age_group"
  | "vibe"
  | "main_worry"
  | "future_goal";

export interface SoulmateSketchQuestionOption {
  value: string;
  label: string;
  emoji: string;
}

export interface SoulmateSketchQuestion {
  id: SoulmateSketchQuestionId;
  title: string;
  options: SoulmateSketchQuestionOption[];
}

export const SOULMATE_SKETCH_ONBOARDING_QUESTIONS: SoulmateSketchQuestion[] = [
  {
    id: "attracted_to",
    title: "Who are you attracted to?",
    options: [
      { value: "male", label: "Male", emoji: "👨" },
      { value: "female", label: "Female", emoji: "👩" },
      { value: "any", label: "Any", emoji: "✨" },
    ],
  },
  {
    id: "age_group",
    title: "Which age group is your perfect match?",
    options: [
      { value: "20-25", label: "20-25", emoji: "🧒" },
      { value: "25-30", label: "25-30", emoji: "🧑" },
      { value: "30-35", label: "30-35", emoji: "🧑‍💼" },
      { value: "35-40", label: "35-40", emoji: "🧔" },
      { value: "40-45", label: "40-45", emoji: "👨‍🦱" },
      { value: "45-50", label: "45-50", emoji: "👨‍🦳" },
      { value: "50+", label: "50+", emoji: "🧓" },
    ],
  },
  {
    id: "vibe",
    title: "What vibe do you want your soulmate to have?",
    options: [
      { value: "cute", label: "Cute", emoji: "😊" },
      { value: "bold", label: "Bold", emoji: "⚡" },
      { value: "elegant", label: "Elegant", emoji: "✨" },
      { value: "mysterious", label: "Mysterious", emoji: "🌙" },
    ],
  },
  {
    id: "main_worry",
    title: "Your main worry when it comes to love?",
    options: [
      { value: "broken_trust", label: "Broken trust", emoji: "🥀" },
      { value: "emotional_distance", label: "Emotional distance", emoji: "🧊" },
      { value: "lack_understanding", label: "Lack of understanding", emoji: "❓" },
      { value: "commitment_issues", label: "Commitment issues", emoji: "🔒" },
      { value: "fear_opening_up", label: "Fear of opening up", emoji: "🛡️" },
      { value: "heartbreak", label: "Heartbreak", emoji: "💔" },
      { value: "something_else", label: "Something else", emoji: "🎭" },
    ],
  },
  {
    id: "future_goal",
    title: "What’s the future you hope to create together?",
    options: [
      { value: "family_life", label: "Peaceful family life", emoji: "🏡" },
      { value: "adventures", label: "Adventures around the globe", emoji: "🌍" },
      { value: "grow_together", label: "Growing together", emoji: "🌱" },
      { value: "financial_security", label: "Financially secure", emoji: "💰" },
      { value: "change_world", label: "Changing the world", emoji: "🌟" },
    ],
  },
];
