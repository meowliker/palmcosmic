import { FuturePredictionQuestionPage } from "@/components/onboarding/future-prediction/FuturePredictionQuestionPage";
import { futurePredictionScreens } from "@/components/onboarding/future-prediction/futurePredictionFlow";

export default function FuturePredictionFocusPage() {
  return <FuturePredictionQuestionPage screen={futurePredictionScreens.focus} />;
}
