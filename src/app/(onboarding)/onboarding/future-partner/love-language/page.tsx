import { FuturePartnerQuestionPage } from "@/components/onboarding/future-partner/FuturePartnerQuestionPage";
import { futurePartnerScreens } from "@/components/onboarding/future-partner/futurePartnerFlow";

export default function FuturePartnerLoveLanguagePage() {
  return <FuturePartnerQuestionPage screen={futurePartnerScreens.loveLanguage} />;
}
