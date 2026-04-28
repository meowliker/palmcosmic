"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { OnboardingSidebar } from "@/components/OnboardingSidebar";
import { cn } from "@/lib/utils";

interface OnboardingMenuButtonProps {
  className?: string;
}

export function OnboardingMenuButton({ className }: OnboardingMenuButtonProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className={cn("p-2 text-[#b8c7da] transition-colors hover:text-white", className)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      <OnboardingSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
