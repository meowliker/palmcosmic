export type SoulmateSketchQuestionId =
  | "relationship_status"
  | "future_goal"
  | "color_preference"
  | "element_preference";

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
