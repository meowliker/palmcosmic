import { FuturePredictionImagePage } from "@/components/onboarding/future-prediction/FuturePredictionImagePage";
import { futurePredictionScreens } from "@/components/onboarding/future-prediction/futurePredictionFlow";

export default function FuturePredictionIntroPage() {
  return <FuturePredictionImagePage screen={futurePredictionScreens.intro} />;
}
