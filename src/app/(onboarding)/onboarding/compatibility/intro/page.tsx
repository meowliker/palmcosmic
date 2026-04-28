import { CompatibilityImagePage } from "@/components/onboarding/compatibility/CompatibilityImagePage";
import { compatibilityScreens } from "@/components/onboarding/compatibility/compatibilityFlow";

export default function CompatibilityIntroPage() {
  return <CompatibilityImagePage screen={compatibilityScreens.intro} />;
}
