"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackRoutePageView } from "@/lib/analytics-events";

function RouteAnalyticsTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams?.toString();
    const path = query ? `${pathname}?${query}` : pathname || "/";
    trackRoutePageView(path);
  }, [pathname, searchParams]);

  return null;
}

export function RouteAnalyticsTracker() {
  return (
    <Suspense fallback={null}>
      <RouteAnalyticsTrackerInner />
    </Suspense>
  );
}
