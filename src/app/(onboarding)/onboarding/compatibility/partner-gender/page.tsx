import { CompatibilityQuestionPage } from "@/components/onboarding/compatibility/CompatibilityQuestionPage";
import { compatibilityScreens } from "@/components/onboarding/compatibility/compatibilityFlow";

export default function CompatibilityPartnerGenderPage() {
  return <CompatibilityQuestionPage screen={compatibilityScreens.partnerGender} />;
}
