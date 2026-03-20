import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    configured: false,
    exchangeRate: 1,
    datePreset: "last_7d",
    dateRange: { start: "", end: "" },
    campaigns: [],
    revenue: {
      totalRevenue: 0,
      totalSales: 0,
      gst: 0,
      netRevenue: 0,
      totalSpendINR: 0,
      profit: 0,
      roas: 0,
    },
    totals: {
      spend: 0,
      spendINR: 0,
      impressions: 0,
      clicks: 0,
      purchases: 0,
      reach: 0,
      cpc: 0,
      cpm: 0,
      ctr: 0,
      costPerPurchase: 0,
    },
    message: "Meta ads breakdown is disabled during Stripe migration.",
  });
}
