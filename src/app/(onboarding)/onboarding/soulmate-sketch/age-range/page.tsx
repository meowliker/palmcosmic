import { SoulmateSketchQuestionPage } from "@/components/onboarding/soulmate-sketch/SoulmateSketchQuestionPage";
import { soulmateSketchScreens } from "@/components/onboarding/soulmate-sketch/soulmateSketchFlow";

export default function SoulmateSketchAgeRangePage() {
  return <SoulmateSketchQuestionPage screen={soulmateSketchScreens.ageRange} />;
}
