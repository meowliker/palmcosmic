import { PalmReadingImagePage } from "@/components/onboarding/palm-reading/PalmReadingImagePage";
import { palmReadingScreens } from "@/components/onboarding/palm-reading/palmReadingFlow";

export default function PalmReadingHandMapPage() {
  return <PalmReadingImagePage screen={palmReadingScreens.handMap} />;
}
