import { FuturePredictionQuestionPage } from "@/components/onboarding/future-prediction/FuturePredictionQuestionPage";
import { futurePredictionScreens } from "@/components/onboarding/future-prediction/futurePredictionFlow";

export default function FuturePredictionRelationshipsPage() {
  return <FuturePredictionQuestionPage screen={futurePredictionScreens.relationships} />;
}
