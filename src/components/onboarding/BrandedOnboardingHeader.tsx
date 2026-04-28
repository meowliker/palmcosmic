"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";

interface BrandedOnboardingHeaderProps {
  onBack: () => void;
}

export function BrandedOnboardingHeader({ onBack }: BrandedOnboardingHeaderProps) {
  return (
    <header className="relative flex items-center justify-center px-4 pt-6 pb-3">
      <button
        onClick={onBack}
        className="absolute left-4 p-2 text-[#b8c7da] hover:text-white transition-colors"
        aria-label="Go back"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="flex items-center gap-2.5">
        <Image
          src="/logo.png"
          alt="PalmCosmic"
          width={32}
          height={32}
          className="rounded-full object-cover"
          priority
        />
        <span className="text-lg font-semibold text-white">PalmCosmic</span>
      </div>
    </header>
  );
}
