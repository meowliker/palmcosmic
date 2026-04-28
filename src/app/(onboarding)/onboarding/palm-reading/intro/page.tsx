import { PalmReadingImagePage } from "@/components/onboarding/palm-reading/PalmReadingImagePage";
import { palmReadingScreens } from "@/components/onboarding/palm-reading/palmReadingFlow";

export default function PalmReadingIntroPage() {
  return <PalmReadingImagePage screen={palmReadingScreens.intro} />;
}
