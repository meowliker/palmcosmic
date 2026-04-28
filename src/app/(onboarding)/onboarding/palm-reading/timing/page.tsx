import { PalmReadingQuestionPage } from "@/components/onboarding/palm-reading/PalmReadingQuestionPage";
import { palmReadingScreens } from "@/components/onboarding/palm-reading/palmReadingFlow";

export default function PalmReadingTimingPage() {
  return <PalmReadingQuestionPage screen={palmReadingScreens.timing} />;
}
