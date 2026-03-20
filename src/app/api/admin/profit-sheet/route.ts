import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const APP_LAUNCH_DATE = "2026-03-13";
const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;

interface ProfitSheetRow {
  date: string;
  day: string;
  revenue: number; // INR
  gst: number; // INR
  adsCostUSD: number;
  adsCostINR: number;
  netRevenue: number; // INR
  roas: number;
  transactionCount: number;
}

interface PaymentRecord {
  amount: number | null;
  created_at: string | null;
  payment_status: string | null;
}

function parseDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getISTWindowForLabelDate(dateStr: string): { start: Date; end: Date } {
  // Day label D means:
  // start = D 11:30:00 IST
  // end   = D+1 11:29:59.999 IST
  const start = new Date(`${dateStr}T11:30:00.000+05:30`);
  const nextDay = addDays(parseDateOnly(dateStr), 1);
  const nextDayStr = formatDateOnly(nextDay);
  const end = new Date(`${nextDayStr}T11:29:59.999+05:30`);
  return { start, end };
}

function getDayOfWeek(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[d.getUTCDay()];
}

async function fetchExchangeRateINR(customExchangeRate?: string | null): Promise<number> {
  if (customExchangeRate) {
    const parsed = parseFloat(customExchangeRate);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  try {
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const data = await response.json();
    const rate = data?.rates?.INR;
    if (Number.isFinite(rate) && rate > 0) return rate;
  } catch {
    // ignore and fallback
  }

  return 85;
}

async function fetchMetaAdsDailySpendUSD(startDate: string, endDate: string): Promise<Map<string, number>> {
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;
  if (!metaAccessToken || !adAccountId) return new Map();

  try {
    const dateParams = `time_range={"since":"${startDate}","until":"${endDate}"}`;
    const url = `${META_BASE_URL}/act_${adAccountId}/insights?fields=spend&time_increment=1&${dateParams}&limit=90&access_token=${metaAccessToken}`;
    const response = await fetch(url);
    const data = await response.json();

    const spendByDate = new Map<string, number>();
    if (Array.isArray(data?.data)) {
      data.data.forEach((row: { date_start?: string; spend?: string }) => {
        if (!row?.date_start) return;
        const spend = parseFloat(row.spend || "0");
        spendByDate.set(row.date_start, Number.isFinite(spend) ? spend : 0);
      });
    }
    return spendByDate;
  } catch {
    return new Map();
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const requestedStart = searchParams.get("startDate") || APP_LAUNCH_DATE;
    const requestedEnd = searchParams.get("endDate") || formatDateOnly(new Date());
    const customExchangeRate = searchParams.get("exchangeRate");

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: sessionData } = await supabase
      .from("admin_sessions")
      .select("*")
      .eq("id", token)
      .single();
    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    if (new Date(sessionData.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const startDate = requestedStart < APP_LAUNCH_DATE ? APP_LAUNCH_DATE : requestedStart;
    const endDate = requestedEnd < startDate ? startDate : requestedEnd;

    const exchangeRate = await fetchExchangeRateINR(customExchangeRate);
    const metaSpendUSDByDate = await fetchMetaAdsDailySpendUSD(startDate, endDate);

    const startWindow = getISTWindowForLabelDate(startDate).start;
    const endWindow = getISTWindowForLabelDate(endDate).end;

    const { data: paymentsRaw, error: paymentsError } = await supabase
      .from("payments")
      .select("amount, created_at, payment_status")
      .gte("created_at", startWindow.toISOString())
      .lte("created_at", endWindow.toISOString())
      .limit(10000);

    if (paymentsError) {
      return NextResponse.json({ error: paymentsError.message }, { status: 500 });
    }

    const successfulPayments: PaymentRecord[] = (paymentsRaw || []).filter((p: PaymentRecord) =>
      p.payment_status === "paid" || p.payment_status === "success" || p.payment_status === "captured"
    );

    const dayLabels: string[] = [];
    const cursor = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    while (cursor <= end) {
      dayLabels.push(formatDateOnly(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    const rows: ProfitSheetRow[] = dayLabels.map((label) => {
      const { start, end } = getISTWindowForLabelDate(label);

      const dayPayments = successfulPayments.filter((p) => {
        if (!p.created_at) return false;
        const createdAt = new Date(p.created_at);
        return createdAt >= start && createdAt <= end;
      });

      const revenueUSD = dayPayments.reduce((sum, p) => sum + ((p.amount || 0) / 100), 0);
      const revenueINR = revenueUSD * exchangeRate;
      const gst = revenueINR * 0.05;
      const adsCostUSD = metaSpendUSDByDate.get(label) || 0;
      const adsCostINR = adsCostUSD * exchangeRate;
      const netRevenue = revenueINR - gst - adsCostINR;
      const roas = adsCostINR > 0 ? revenueINR / adsCostINR : 0;

      return {
        date: label,
        day: getDayOfWeek(label),
        revenue: revenueINR,
        gst,
        adsCostUSD,
        adsCostINR,
        netRevenue,
        roas,
        transactionCount: dayPayments.length,
      };
    });

    const totals = rows.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenue,
        gst: acc.gst + row.gst,
        adsCostUSD: acc.adsCostUSD + row.adsCostUSD,
        adsCostINR: acc.adsCostINR + row.adsCostINR,
        netRevenue: acc.netRevenue + row.netRevenue,
        transactionCount: acc.transactionCount + row.transactionCount,
      }),
      { revenue: 0, gst: 0, adsCostUSD: 0, adsCostINR: 0, netRevenue: 0, transactionCount: 0 }
    );

    const overallRoas = totals.adsCostINR > 0 ? totals.revenue / totals.adsCostINR : 0;

    return NextResponse.json({
      rows,
      totals: {
        ...totals,
        roas: overallRoas,
      },
      exchangeRate,
      dateRange: { start: startDate, end: endDate },
      istDayBoundary: "11:30 to next day 11:29:59 IST",
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate profit sheet" },
      { status: 500 }
    );
  }
}
