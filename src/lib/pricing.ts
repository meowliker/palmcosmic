// Pricing utility functions
// Fetches dynamic pricing from database with fallback to defaults

export interface BundlePlan {
  id: string;
  name: string;
  price: number; // stored in cents
  displayPrice: number; // stored in cents
  originalPrice: number; // stored in cents
  discount: string;
  description: string;
  features: string[];
  featureList: string[];
  popular?: boolean;
  limitedOffer?: boolean;
  active: boolean;
}

export interface UpsellPlan {
  id: string;
  name: string;
  price: number; // stored in cents
  displayPrice: number; // stored in cents
  originalPrice: number; // stored in cents
  discount: string;
  description: string;
  feature: string;
  active: boolean;
}

export interface ReportPlan {
  id: string;
  name: string;
  price: number; // stored in cents
  originalPrice: number; // stored in cents
  feature: string;
  active: boolean;
}

export interface CoinPackage {
  id: string;
  coins: number;
  price: number; // stored in cents
  displayPrice: number; // stored in cents
  originalPrice: number; // stored in cents
  active: boolean;
}

export interface PricingConfig {
  bundles: BundlePlan[];
  upsells: UpsellPlan[];
  reports: ReportPlan[];
  coinPackages: CoinPackage[];
}

// Default pricing (fallback)
export const DEFAULT_PRICING: PricingConfig = {
  bundles: [
    {
      id: "palm-reading",
      name: "Palm Reading",
      price: 1199,
      displayPrice: 1199,
      originalPrice: 1499,
      discount: "20% OFF",
      description: "Personalized palm reading report delivered instantly.",
      features: ["palmReading"],
      featureList: [
        "Complete palm line analysis",
        "Life, heart, head line insights",
        "Personality traits revealed",
      ],
      popular: false,
      limitedOffer: false,
      active: true,
    },
    {
      id: "palm-birth",
      name: "Palm + Birth Chart",
      price: 1499,
      displayPrice: 1499,
      originalPrice: 2149,
      discount: "30% OFF",
      description: "Deep palm insights plus your full zodiac reading.",
      features: ["palmReading", "birthChart"],
      featureList: [
        "Everything in Palm Reading",
        "Complete birth chart analysis",
        "Planetary positions & houses",
      ],
      popular: true,
      limitedOffer: false,
      active: true,
    },
    {
      id: "palm-birth-compat",
      name: "Palm + Birth Chart + Compatibility Report",
      price: 2499,
      displayPrice: 2499,
      originalPrice: 4999,
      discount: "50% OFF",
      description: "Complete cosmic package with all reports included.",
      features: ["palmReading", "birthChart", "compatibilityTest"],
      featureList: [
        "Everything in Palm + Birth Chart",
        "Full compatibility analysis",
        "Partner matching report",
      ],
      popular: false,
      limitedOffer: true,
      active: true,
    },
  ],
  upsells: [
    {
      id: "2026-predictions",
      name: "2026 Future Predictions",
      price: 799,
      displayPrice: 799,
      originalPrice: 1599,
      discount: "50% OFF",
      description: "Detailed predictions for your 2026 journey.",
      feature: "prediction2026",
      active: true,
    },
  ],
  reports: [
    {
      id: "report-2026",
      name: "2026 Future Predictions",
      price: 999,
      originalPrice: 1999,
      feature: "prediction2026",
      active: true,
    },
    {
      id: "report-birth-chart",
      name: "Birth Chart Report",
      price: 999,
      originalPrice: 1999,
      feature: "birthChart",
      active: true,
    },
    {
      id: "report-compatibility",
      name: "Compatibility Report",
      price: 999,
      originalPrice: 1999,
      feature: "compatibilityTest",
      active: true,
    },
  ],
  coinPackages: [
    { id: "coins-50", coins: 50, price: 299, displayPrice: 299, originalPrice: 599, active: true },
    { id: "coins-150", coins: 150, price: 799, displayPrice: 799, originalPrice: 1599, active: true },
    { id: "coins-300", coins: 300, price: 1299, displayPrice: 1299, originalPrice: 2499, active: true },
    { id: "coins-500", coins: 500, price: 1799, displayPrice: 1799, originalPrice: 3499, active: true },
  ],
};

export function formatUsdFromCents(amountInCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((amountInCents || 0) / 100);
}

// Server-side function to get pricing
export async function getPricing(): Promise<PricingConfig> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/admin/pricing`, {
      cache: "no-store",
    });
    const data = await response.json();
    return data.pricing || DEFAULT_PRICING;
  } catch {
    return DEFAULT_PRICING;
  }
}

// Get bundle by ID
export function getBundleById(pricing: PricingConfig, bundleId: string): BundlePlan | undefined {
  return pricing.bundles.find((b) => b.id === bundleId);
}

// Get upsell by ID
export function getUpsellById(pricing: PricingConfig, upsellId: string): UpsellPlan | undefined {
  return pricing.upsells.find((u) => u.id === upsellId);
}

// Get report by ID
export function getReportById(pricing: PricingConfig, reportId: string): ReportPlan | undefined {
  return pricing.reports.find((r) => r.id === reportId);
}

// Get coin package by ID
export function getCoinPackageById(pricing: PricingConfig, packageId: string): CoinPackage | undefined {
  return pricing.coinPackages.find((c) => c.id === packageId);
}
