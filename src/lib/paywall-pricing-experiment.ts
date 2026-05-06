import type { BundlePlan } from "@/lib/pricing";

export const PAYWALL_PRICING_EXPERIMENT = "paywall_bundle_price_v1";
export const PAYWALL_PRICING_STORAGE_KEY = "palmcosmic_paywall_price_variant_v1";

export type PaywallPriceVariant = "control_29_49_89" | "test_17_27_47";

export const PAYWALL_PRICE_VARIANTS: PaywallPriceVariant[] = ["control_29_49_89", "test_17_27_47"];

const TEST_PRICE_OVERRIDES: Record<string, Pick<BundlePlan, "price" | "displayPrice" | "originalPrice" | "discount">> = {
  "palm-reading": {
    price: 1700,
    displayPrice: 1700,
    originalPrice: 2900,
    discount: "41% OFF",
  },
  "palm-birth": {
    price: 2700,
    displayPrice: 2700,
    originalPrice: 4900,
    discount: "45% OFF",
  },
  "palm-birth-sketch": {
    price: 4700,
    displayPrice: 4700,
    originalPrice: 8900,
    discount: "47% OFF",
  },
};

export function isPaywallPriceVariant(value: unknown): value is PaywallPriceVariant {
  return typeof value === "string" && PAYWALL_PRICE_VARIANTS.includes(value as PaywallPriceVariant);
}

export function pickPaywallPriceVariant(): PaywallPriceVariant {
  if (typeof window === "undefined") return "control_29_49_89";

  const stored = window.localStorage.getItem(PAYWALL_PRICING_STORAGE_KEY);
  if (isPaywallPriceVariant(stored)) return stored;

  const variant: PaywallPriceVariant = Math.random() < 0.5 ? "control_29_49_89" : "test_17_27_47";
  window.localStorage.setItem(PAYWALL_PRICING_STORAGE_KEY, variant);
  return variant;
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

