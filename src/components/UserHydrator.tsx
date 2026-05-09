"use client";

import { useCallback, useEffect } from "react";
import { useUserStore } from "@/lib/user-store";
import { usePathname, useRouter } from "next/navigation";

export default function UserHydrator() {
  const { syncFromServer, setCoins, setUserId, unlockFeature, unlockAllFeatures } = useUserStore();
  const router = useRouter();
  const pathname = usePathname();

  const hydrate = useCallback(async () => {
    if (pathname?.startsWith("/admin")) {
      return;
    }

    const storedId = localStorage.getItem("astrorekha_user_id");
    if (!storedId) return;

    const userId = storedId;

    try {
      const response = await fetch(`/api/user/hydrate?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      // User not found in database - clear localStorage and redirect to welcome.
      if (response.status === 404 || result?.error === "user_not_found") {
        console.warn("User not found in database, clearing session");
        localStorage.removeItem("astrorekha_user_id");
        localStorage.removeItem("astrorekha_email");
        localStorage.removeItem("astrorekha_password");
        localStorage.removeItem("astrorekha_onboarding_flow");
        localStorage.removeItem("astrorekha_purchase_type");
        
        // Clear session cookie
        await fetch("/api/session/clear", { method: "POST" });
        
        // Redirect to welcome
        router.push("/welcome");
        return;
      }

      if (!response.ok || !result?.success || !result.user) {
        throw new Error(result?.error || "Failed to hydrate user");
      }

      const data = result.user;
      setUserId(userId);

      if (data.trialEndsAt) {
        localStorage.setItem("astrorekha_trial_end_date", data.trialEndsAt);
        localStorage.setItem("palmcosmic_trial_end_date", data.trialEndsAt);
      }

      if (typeof data.coins === "number") {
        setCoins(data.coins);
      }

      if (data.isDevTester === true) {
        unlockAllFeatures();
        setCoins(typeof data.coins === "number" ? data.coins : 999999);
        return;
      }

      // Sync unlocked features from server
      const unlocked = data.unlockedFeatures || {};
      syncFromServer({
        unlockedFeatures: unlocked,
        coins: data.coins,
        purchasedBundle: data.purchasedBundle || null,
      });

      const hasPalmReading = !!unlocked.palmReading;
      const hasPrediction2026 = !!unlocked.prediction2026;
      const hasBirthChart = !!unlocked.birthChart;
      const hasCompatibility = !!unlocked.compatibilityTest;
      const hasSoulmateSketch = !!unlocked.soulmateSketch;
      const hasFuturePartnerReport = !!unlocked.futurePartnerReport;

      if (hasPalmReading) unlockFeature("palmReading");
      if (hasPrediction2026) unlockFeature("prediction2026");
      if (hasBirthChart) unlockFeature("birthChart");
      if (hasCompatibility) unlockFeature("compatibilityTest");
      if (hasSoulmateSketch) unlockFeature("soulmateSketch");
      if (hasFuturePartnerReport) unlockFeature("futurePartnerReport");
    } catch (err) {
      console.error("Failed to hydrate user:", err);
    }
  }, [syncFromServer, setCoins, setUserId, unlockAllFeatures, unlockFeature, router, pathname]);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) {
      return;
    }

    // Hydrate immediately on mount
    hydrate();

    const onPageShow = () => hydrate();
    const onVisibility = () => {
      if (document.visibilityState === "visible") hydrate();
    };

    window.addEventListener("pageshow", onPageShow);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("pageshow", onPageShow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hydrate, pathname]);

  useEffect(() => {
    if (pathname?.startsWith("/admin")) {
      return;
    }

    const trialEnd =
      localStorage.getItem("astrorekha_trial_end_date") ||
      localStorage.getItem("palmcosmic_trial_end_date");
    if (!trialEnd) return;

    const delay = new Date(trialEnd).getTime() - Date.now() + 1500;
    if (delay <= 0) {
      hydrate();
      return;
    }

    const timeout = window.setTimeout(() => {
      hydrate();
    }, Math.min(delay, 24 * 60 * 60 * 1000));

    return () => window.clearTimeout(timeout);
  }, [hydrate, pathname]);

  return null;
}
