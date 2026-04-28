import { PalmReadingQuestionPage } from "@/components/onboarding/palm-reading/PalmReadingQuestionPage";
import { palmReadingScreens } from "@/components/onboarding/palm-reading/palmReadingFlow";

export default function PalmReadingPersonalityPage() {
  return <PalmReadingQuestionPage screen={palmReadingScreens.personality} />;
}
