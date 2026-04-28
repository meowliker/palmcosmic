import { SoulmateSketchImagePage } from "@/components/onboarding/soulmate-sketch/SoulmateSketchImagePage";
import { soulmateSketchScreens } from "@/components/onboarding/soulmate-sketch/soulmateSketchFlow";

export default function SoulmateSketchIntroPage() {
  return <SoulmateSketchImagePage screen={soulmateSketchScreens.intro} />;
}
