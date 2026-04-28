import { PalmReadingQuestionPage } from "@/components/onboarding/palm-reading/PalmReadingQuestionPage";
import { palmReadingScreens } from "@/components/onboarding/palm-reading/palmReadingFlow";

export default function PalmReadingClarityPage() {
  return <PalmReadingQuestionPage screen={palmReadingScreens.clarity} />;
}
