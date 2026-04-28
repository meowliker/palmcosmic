import { FuturePartnerImagePage } from "@/components/onboarding/future-partner/FuturePartnerImagePage";
import { futurePartnerScreens } from "@/components/onboarding/future-partner/futurePartnerFlow";

export default function FuturePartnerIntroPage() {
  return <FuturePartnerImagePage screen={futurePartnerScreens.intro} />;
}
