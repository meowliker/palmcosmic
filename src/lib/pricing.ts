// Pricing utility functions
// Fetches dynamic pricing from database with fallback to defaults

export interface BundlePlan {
  id: string;
  name: string;
  price: number;
  displayPrice: number; // Price shown on paywall (can differ from actual PayU price)
  originalPrice: number;
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
  price: number;
  displayPrice: number;
  originalPrice: number;
  discount: string;
  description: string;
  feature: string;
  active: boolean;
}

export interface ReportPlan {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  feature: string;
  active: boolean;
}

export interface CoinPackage {
  id: string;
  coins: number;
  price: number;
  displayPrice: number;
  originalPrice: number;
  active: boolean;
}

export interface PricingConfig {
  bundles: BundlePlan[];
  upsells: UpsellPlan[];
  reports: ReportPlan[];
  coinPackages: CoinPackage[];
}

function mergeById<T extends { id: string }>(defaults: T[], incoming?: T[]): T[] {
  const incomingList = Array.isArray(incoming) ? incoming : [];
  const incomingMap = new Map(incomingList.map((item) => [item.id, item]));
  const mergedDefaults = defaults.map((d) => ({ ...d, ...(incomingMap.get(d.id) || {}) }));
  const extraIncoming = incomingList.filter((item) => !defaults.some((d) => d.id === item.id));
  return [...mergedDefaults, ...extraIncoming];
}

function canonicalizeBundleFeatures(bundleId: string, features: string[]): string[] {
  const unique = new Set(features || []);

  if (bundleId === "palm-birth-compat") {
    unique.add("palmReading");
    unique.add("birthChart");
    unique.add("compatibilityTest");
    unique.add("futurePartnerReport");
    return ["palmReading", "birthChart", "compatibilityTest", "futurePartnerReport"];
  }

  if (bundleId === "palm-birth-sketch") {
    unique.add("palmReading");
    unique.add("birthChart");
    unique.add("soulmateSketch");
    unique.add("futurePartnerReport");
    return ["palmReading", "birthChart", "soulmateSketch", "futurePartnerReport"];
  }

  return Array.from(unique);
}

function applyBundleOverrides(bundles: BundlePlan[]): BundlePlan[] {
  return bundles.map((bundle) => {
    if (bundle.id === "palm-reading") {
      return {
        ...bundle,
        name: "Palm Reading",
        price: 2900,
        displayPrice: 2900,
        originalPrice: 3600,
        discount: "20% OFF",
        description: "Lifetime access to your personalized palm reading report.",
        features: ["palmReading"],
        featureList: [
          "Complete palm line analysis",
          "Life, heart, and head line insights",
          "15 chat coins included",
          "Lifetime report access",
        ],
        active: true,
      };
    }

    if (bundle.id === "palm-birth") {
      return {
        ...bundle,
        name: "Palm + Birth Chart",
        price: 4900,
        displayPrice: 4900,
        originalPrice: 7000,
        discount: "30% OFF",
        description: "Lifetime access to your palm reading and birth chart reports.",
        features: ["palmReading", "birthChart"],
        featureList: [
          "Everything in Palm Reading",
          "Complete birth chart analysis",
          "15 chat coins included",
          "Lifetime report access",
        ],
        popular: true,
        active: true,
      };
    }

    if (bundle.id === "palm-birth-compat") {
      return {
        ...bundle,
        name: "Palm + Birth Chart + Compatibility Report + Future Partner Report",
        description: "Complete cosmic package with compatibility + future partner report.",
        features: canonicalizeBundleFeatures(bundle.id, bundle.features),
        featureList: [
          "Everything in Palm + Birth Chart",
          "Full compatibility analysis",
          "Future partner report",
        ],
        active: false,
      };
    }

    if (bundle.id === "palm-birth-sketch") {
      return {
        ...bundle,
        name: "Palm + Birth Chart + Soulmate Sketch + Future Partner Report",
        price: 8900,
        displayPrice: 8900,
        originalPrice: 17800,
        discount: "50% OFF",
        description: "Lifetime access to palm, birth chart, soulmate sketch, and future partner reports.",
        features: canonicalizeBundleFeatures(bundle.id, bundle.features),
        featureList: [
          "Everything in Palm + Birth Chart",
          "One AI soulmate sketch",
          "Future partner report",
          "30 chat coins included",
          "Lifetime report access",
        ],
        popular: false,
        limitedOffer: true,
        active: true,
      };
    }

    return {
      ...bundle,
      features: canonicalizeBundleFeatures(bundle.id, bundle.features),
    };
  });
}

function applyUpsellOverrides(upsells: UpsellPlan[]): UpsellPlan[] {
  return upsells.map((upsell) => ({
    ...upsell,
    price: 2400,
    displayPrice: 2400,
    originalPrice: 4800,
    discount: "50% OFF",
    active: true,
  }));
}

function applyReportOverrides(reports: ReportPlan[]): ReportPlan[] {
  return reports.map((report) => ({
    ...report,
    price: 2900,
    originalPrice: 5800,
    active: true,
  }));
}

export function normalizePricing(raw?: Partial<PricingConfig> | null): PricingConfig {
  if (!raw || typeof raw !== "object") {
    return {
      ...DEFAULT_PRICING,
      reports: applyReportOverrides(DEFAULT_PRICING.reports),
    };
  }

  const mergedBundles = mergeById(DEFAULT_PRICING.bundles, raw.bundles as BundlePlan[] | undefined);

  return {
    bundles: applyBundleOverrides(mergedBundles),
    upsells: applyUpsellOverrides(mergeById(DEFAULT_PRICING.upsells, raw.upsells as UpsellPlan[] | undefined)),
    reports: applyReportOverrides(mergeById(DEFAULT_PRICING.reports, raw.reports as ReportPlan[] | undefined)),
    coinPackages: mergeById(DEFAULT_PRICING.coinPackages, raw.coinPackages as CoinPackage[] | undefined),
  };
}

// Default pricing (fallback)
export const DEFAULT_PRICING: PricingConfig = {
  bundles: [
    {
      id: "palm-reading",
      name: "Palm Reading",
      price: 2900,
      displayPrice: 2900,
      originalPrice: 3600,
      discount: "20% OFF",
      description: "Lifetime access to your personalized palm reading report.",
      features: ["palmReading"],
      featureList: [
        "Complete palm line analysis",
        "Life, heart, head line insights",
        "15 chat coins included",
        "Personality traits revealed",
      ],
      popular: false,
      limitedOffer: false,
      active: true,
    },
    {
      id: "palm-birth",
      name: "Palm + Birth Chart",
      price: 4900,
      displayPrice: 4900,
      originalPrice: 7000,
      discount: "30% OFF",
      description: "Lifetime access to your palm reading and birth chart reports.",
      features: ["palmReading", "birthChart"],
      featureList: [
        "Everything in Palm Reading",
        "Complete birth chart analysis",
        "15 chat coins included",
        "Planetary positions & houses",
      ],
      popular: true,
      limitedOffer: false,
      active: true,
    },
    {
      id: "palm-birth-compat",
      name: "Palm + Birth Chart + Compatibility Report + Future Partner Report",
      price: 1599,
      displayPrice: 1599,
      originalPrice: 3199,
      discount: "50% OFF",
      description: "Complete cosmic package with compatibility + future partner report.",
      features: ["palmReading", "birthChart", "compatibilityTest", "futurePartnerReport"],
      featureList: [
        "Everything in Palm + Birth Chart",
        "Full compatibility analysis",
        "Future partner report",
      ],
      popular: false,
      limitedOffer: true,
      active: false,
    },
    {
      id: "palm-birth-sketch",
      name: "Palm + Birth Chart + Soulmate Sketch + Future Partner Report",
      price: 8900,
      displayPrice: 8900,
      originalPrice: 17800,
      discount: "50% OFF",
      description: "Lifetime access to palm, birth chart, soulmate sketch, and future partner reports.",
      features: ["palmReading", "birthChart", "soulmateSketch", "futurePartnerReport"],
      featureList: [
        "Everything in Palm + Birth Chart",
        "One AI soulmate sketch",
        "Future partner report",
        "30 chat coins included",
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
      price: 2400,
      displayPrice: 2400,
      originalPrice: 4800,
      discount: "50% OFF",
      description: "Detailed predictions for your 2026 journey.",
      feature: "prediction2026",
      active: true,
    },
    {
      id: "compatibility",
      name: "Compatibility Report",
      price: 2400,
      displayPrice: 2400,
      originalPrice: 4800,
      discount: "50% OFF",
      description: "Check your love match and relationship chemistry.",
      feature: "compatibilityTest",
      active: true,
    },
    {
      id: "birth-chart",
      name: "Birth Chart Report",
      price: 2400,
      displayPrice: 2400,
      originalPrice: 4800,
      discount: "50% OFF",
      description: "Unlock your complete astrological blueprint.",
      feature: "birthChart",
      active: true,
    },
    {
      id: "soulmate-sketch",
      name: "Soulmate Sketch",
      price: 2400,
      displayPrice: 2400,
      originalPrice: 4800,
      discount: "50% OFF",
      description: "Generate your one-time AI soulmate portrait.",
      feature: "soulmateSketch",
      active: true,
    },
  ],
  reports: [
    {
      id: "report-palm",
      name: "Palm Reading Report",
      price: 2900,
      originalPrice: 5800,
      feature: "palmReading",
      active: true,
    },
    {
      id: "report-2026",
      name: "2026 Future Predictions",
      price: 2900,
      originalPrice: 5800,
      feature: "prediction2026",
      active: true,
    },
    {
      id: "report-birth-chart",
      name: "Birth Chart Report",
      price: 2900,
      originalPrice: 5800,
      feature: "birthChart",
      active: true,
    },
    {
      id: "report-compatibility",
      name: "Compatibility Report",
      price: 2900,
      originalPrice: 5800,
      feature: "compatibilityTest",
      active: true,
    },
    {
      id: "report-soulmate-sketch",
      name: "Soulmate Sketch",
      price: 2900,
      originalPrice: 5800,
      feature: "soulmateSketch",
      active: true,
    },
    {
      id: "report-future-partner",
      name: "Future Partner Report",
      price: 2900,
      originalPrice: 5800,
      feature: "futurePartnerReport",
      active: true,
    },
  ],
  coinPackages: [
    { id: "coins-50", coins: 50, price: 416, displayPrice: 416, originalPrice: 500, active: true },
    { id: "coins-150", coins: 150, price: 1082, displayPrice: 1082, originalPrice: 1500, active: true },
    { id: "coins-300", coins: 300, price: 1666, displayPrice: 1666, originalPrice: 2500, active: true },
    { id: "coins-500", coins: 500, price: 2499, displayPrice: 2499, originalPrice: 3500, active: true },
  ],
};

// Server-side function to get pricing
export async function getPricing(): Promise<PricingConfig> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/admin/pricing`, {
      cache: 'no-store',
    });
    const data = await response.json();
    return normalizePricing(data.pricing);
  } catch {
    return DEFAULT_PRICING;
  }
}

// Get bundle by ID
export function getBundleById(pricing: PricingConfig, bundleId: string): BundlePlan | undefined {
  return pricing.bundles.find(b => b.id === bundleId);
}

// Get upsell by ID
export function getUpsellById(pricing: PricingConfig, upsellId: string): UpsellPlan | undefined {
  return pricing.upsells.find(u => u.id === upsellId);
}

// Get report by ID
export function getReportById(pricing: PricingConfig, reportId: string): ReportPlan | undefined {
  return pricing.reports.find(r => r.id === reportId);
}

// Get coin package by ID
export function getCoinPackageById(pricing: PricingConfig, packageId: string): CoinPackage | undefined {
  return pricing.coinPackages.find(c => c.id === packageId);
}
