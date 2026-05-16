import type { BundlePlan } from "@/lib/pricing";

export const PAYWALL_PRICING_EXPERIMENT = "paywall_bundle_price_v1";
export const PAYWALL_PRICING_STORAGE_KEY = "palmcosmic_paywall_price_variant_v1";

export type PaywallPriceVariant = "control_29_49_89" | "test_17_27_47";

export const PAYWALL_PRICE_VARIANTS: PaywallPriceVariant[] = ["control_29_49_89", "test_17_27_47"];

const TEST_PRICE_OVERRIDES: Record<string, Pick<BundlePlan, "price" | "displayPrice" | "originalPrice" | "discount">> = {
  "palm-reading": {
    price: 1700,
    displayPrice: 1700,
    originalPrice: 2400,
    discount: "30% OFF",
  },
  "palm-birth": {
    price: 2700,
    displayPrice: 2700,
    originalPrice: 5400,
    discount: "50% OFF",
  },
  "palm-birth-sketch": {
    price: 4700,
    displayPrice: 4700,
    originalPrice: 15700,
    discount: "70% OFF",
  },
};

export function isPaywallPriceVariant(value: unknown): value is PaywallPriceVariant {
  return typeof value === "string" && PAYWALL_PRICE_VARIANTS.includes(value as PaywallPriceVariant);
}

export function variantKeyToPaywallPriceVariant(variant: unknown): PaywallPriceVariant {
  return variant === "B" ? "test_17_27_47" : "control_29_49_89";
}

export async function resolvePaywallPriceVariant(visitorId: string): Promise<PaywallPriceVariant> {
  if (typeof window === "undefined") return "control_29_49_89";

  try {
    const params = new URLSearchParams({
      testId: PAYWALL_PRICING_EXPERIMENT,
      visitorId,
      userId: visitorId,
    });
    const response = await fetch(`/api/ab-test?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to resolve paywall price variant");

    const data = await response.json();
    const resolvedFromPage = isPaywallPriceVariant(data?.page) ? data.page : null;
    const resolved = resolvedFromPage || variantKeyToPaywallPriceVariant(data?.variant);
    window.localStorage.setItem(PAYWALL_PRICING_STORAGE_KEY, resolved);
    return resolved;
  } catch {
    const stored = window.localStorage.getItem(PAYWALL_PRICING_STORAGE_KEY);
    if (isPaywallPriceVariant(stored) && stored !== "control_29_49_89") return stored;
    return "test_17_27_47";
  }
}

export function applyPaywallPriceVariant<T extends BundlePlan>(
  bundles: T[],
  variant: PaywallPriceVariant
): T[] {
  if (variant !== "test_17_27_47") return bundles;

  return bundles.map((bundle) => {
    const override = TEST_PRICE_OVERRIDES[bundle.id];
    return override ? { ...bundle, ...override } : bundle;
  });
}
