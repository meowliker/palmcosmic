import { CompatibilityImagePage } from "@/components/onboarding/compatibility/CompatibilityImagePage";
import { compatibilityScreens } from "@/components/onboarding/compatibility/compatibilityFlow";

export default function CompatibilityReadyPage() {
  return <CompatibilityImagePage screen={compatibilityScreens.ready} />;
}
