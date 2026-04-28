import { SoulmateSketchQuestionPage } from "@/components/onboarding/soulmate-sketch/SoulmateSketchQuestionPage";
import { soulmateSketchScreens } from "@/components/onboarding/soulmate-sketch/soulmateSketchFlow";

export default function SoulmateSketchPartnerGenderPage() {
  return <SoulmateSketchQuestionPage screen={soulmateSketchScreens.partnerGender} />;
}
