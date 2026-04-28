import { PalmReadingImagePage } from "@/components/onboarding/palm-reading/PalmReadingImagePage";
import { palmReadingScreens } from "@/components/onboarding/palm-reading/palmReadingFlow";

export default function PalmReadingReadyPage() {
  return <PalmReadingImagePage screen={palmReadingScreens.ready} />;
}
