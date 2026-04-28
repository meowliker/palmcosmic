import { FuturePredictionImagePage } from "@/components/onboarding/future-prediction/FuturePredictionImagePage";
import { futurePredictionScreens } from "@/components/onboarding/future-prediction/futurePredictionFlow";

export default function FuturePredictionHorizonPage() {
  return <FuturePredictionImagePage screen={futurePredictionScreens.horizon} />;
}
