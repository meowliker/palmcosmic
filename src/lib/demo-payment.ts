import type { FlowKey } from "@/lib/report-entitlements";

type DemoPaymentParams = {
  flow: FlowKey;
  email: string;
  userId: string;
};

type DemoPaymentResult = {
  bypassed: boolean;
  redirectPath?: string;
  reports?: string[];
  primaryReport?: string;
};

function isLocalBrowser() {
  if (typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

export function isDemoPaymentBypassEnabled() {
  return process.env.NEXT_PUBLIC_DEMO_PAYMENT_BYPASS === "true" || isLocalBrowser();
}

export async function runDemoPaymentBypass(params: DemoPaymentParams): Promise<DemoPaymentResult> {
  if (!isDemoPaymentBypassEnabled()) {
    return { bypassed: false };
  }

  const response = await fetch("/api/demo/activate-subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || "Unable to activate demo payment bypass");
  }

  return {
    bypassed: true,
    redirectPath: data.redirectPath,
    reports: data.reports,
    primaryReport: data.primaryReport,
  };
}
