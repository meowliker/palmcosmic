import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { classifyStoredPaymentEvent } from "@/lib/finance-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const APP_LAUNCH_DATE = "2026-03-13";
const META_API_VERSION = "v21.0";
const META_BASE_URL = `https://graph.facebook.com/${META_API_VERSION}`;
const IST_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET_MINUTES = 5 * 60 + 30;
const BUSINESS_BOUNDARY_HOUR = 11;
const BUSINESS_BOUNDARY_MINUTE = 30;

interface ProfitSheetRow {
  date: string;
  day: string;
  revenue: number;
  grossRevenue: number;
  refundAmount: number;
  gst: number;
  adsCostUSD: number;
  adsCostINR: number;
  netRevenue: number;
  profitPercent: number;
  roas: number;
  transactionCount: number;
  salesCount: number;
  refundCount: number;
}

type FinancialRow = {
  createdAt: Date;
  dayKey: string;
  kind: "sale" | "refund";
  amountInr: number;
};

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function isIsoDate(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

async function fetchExchangeRate(): Promise<number> {
  try {
    const response = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    const data = await response.json();
    const rate = Number(data.rates?.INR);
    return Number.isFinite(rate) && rate > 0 ? rate : 85;
  } catch {
    return 85;
  }
}

async function fetchMetaAdsDailySpend(startDate: string, endDate: string): Promise<Map<string, number>> {
  const metaAccessToken = process.env.META_ACCESS_TOKEN;
  const adAccountId = process.env.META_AD_ACCOUNT_ID;

  if (!metaAccessToken || !adAccountId) {
    return new Map();
  }

  try {
    const dateParams = `time_range={"since":"${startDate}","until":"${endDate}"}`;
    const dailyUrl = `${META_BASE_URL}/act_${adAccountId}/insights?fields=spend&time_increment=1&${dateParams}&limit=90&access_token=${metaAccessToken}`;

    const response = await fetch(dailyUrl);
    const data = await response.json();
    const spendMap = new Map<string, number>();

    if (Array.isArray(data.data)) {
      data.data.forEach((day: { date_start: string; spend: string }) => {
        spendMap.set(day.date_start, Number(day.spend || 0));
      });
    }

    return spendMap;
  } catch (error) {
    console.error("Meta Ads fetch error:", error);
    return new Map();
  }
}

function addDaysToIsoDate(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

function getDayOfWeek(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return days[date.getUTCDay()];
}

function getBoundaryUtcDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utcMs =
    Date.UTC(year, month - 1, day, BUSINESS_BOUNDARY_HOUR, BUSINESS_BOUNDARY_MINUTE, 0, 0) -
    IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs);
}

function getBusinessWindow(startDate: string, endDate: string): { start: Date; end: Date } {
  return {
    start: getBoundaryUtcDate(startDate),
    end: new Date(getBoundaryUtcDate(addDaysToIsoDate(endDate, 1)).getTime() - 1),
  };
}

function getIstDateTimeParts(date: Date): { dayKey: string; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    dayKey: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number.isFinite(minute) ? minute : 0,
  };
}

function getStripeBusinessDayKeyFromDate(date: Date): string {
  const { dayKey, hour, minute } = getIstDateTimeParts(date);
  const isBeforeBoundary =
    hour < BUSINESS_BOUNDARY_HOUR || (hour === BUSINESS_BOUNDARY_HOUR && minute < BUSINESS_BOUNDARY_MINUTE);
  return isBeforeBoundary ? addDaysToIsoDate(dayKey, -1) : dayKey;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const startDate = searchParams.get("startDate") || APP_LAUNCH_DATE;
    const endDate = searchParams.get("endDate") || new Date().toISOString().split("T")[0];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      return NextResponse.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
    }

    const { data: sessionData } = await supabase
      .from("admin_sessions")
      .select("id, expires_at")
      .eq("id", token)
      .single();

    if (!sessionData) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }

    if (new Date(sessionData.expires_at) < new Date()) {
      return NextResponse.json({ error: "Session expired" }, { status: 401 });
    }

    const customExchangeRate = searchParams.get("exchangeRate");
    const parsedExchangeRate = customExchangeRate ? Number(customExchangeRate) : null;
    const exchangeRate =
      parsedExchangeRate && Number.isFinite(parsedExchangeRate) && parsedExchangeRate > 0
        ? parsedExchangeRate
        : await fetchExchangeRate();

    const metaSpendMap = await fetchMetaAdsDailySpend(startDate, endDate);
    const dates = getDateRange(startDate, endDate);
    const businessWindow = getBusinessWindow(startDate, endDate);

    const { data: paymentRows, error: paymentsError } = await supabase
      .from("payments")
      .select("id, amount, payment_status, created_at, fulfilled_at, currency, type, billing_kind, report_key")
      .order("created_at", { ascending: false })
      .limit(10000);

    if (paymentsError) {
      throw paymentsError;
    }

    const financialRows: FinancialRow[] = (paymentRows || [])
      .map((payment) => {
        const financial = classifyStoredPaymentEvent(payment.payment_status, payment.amount);
        const createdAt = new Date(String(payment.fulfilled_at || payment.created_at || ""));
        if (financial.kind === "ignore" || Number.isNaN(createdAt.getTime())) {
          return null;
        }

        const dayKey = getStripeBusinessDayKeyFromDate(createdAt);
        if (createdAt < businessWindow.start || createdAt > businessWindow.end || dayKey < startDate || dayKey > endDate) {
          return null;
        }

        return {
          createdAt,
          dayKey,
          kind: financial.kind,
          amountInr: financial.amount * exchangeRate,
        } satisfies FinancialRow;
      })
      .filter((row): row is FinancialRow => !!row);

    const profitSheet: ProfitSheetRow[] = dates.map((date) => {
      const dayTransactions = financialRows.filter((txn) => txn.dayKey === date);
      const saleRows = dayTransactions.filter((event) => event.kind === "sale");
      const refundRows = dayTransactions.filter((event) => event.kind === "refund");
      const grossRevenue = saleRows.reduce((sum, event) => sum + event.amountInr, 0);
      const refundAmount = refundRows.reduce((sum, event) => sum + event.amountInr, 0);
      const revenue = grossRevenue - refundAmount;
      const gst = Math.max(revenue, 0) * 0.05;
      const adsCostUSD = metaSpendMap.get(date) || 0;
      const adsCostINR = adsCostUSD * exchangeRate;
      const netRevenue = revenue - gst - adsCostINR;
      const profitPercent = revenue > 0 ? (netRevenue / revenue) * 100 : 0;
      const roas = adsCostINR > 0 ? revenue / adsCostINR : 0;

      return {
        date,
        day: getDayOfWeek(date),
        revenue,
        grossRevenue,
        refundAmount,
        gst,
        adsCostUSD,
        adsCostINR,
        netRevenue,
        profitPercent,
        roas,
        transactionCount: saleRows.length,
        salesCount: saleRows.length,
        refundCount: refundRows.length,
      };
    });

    const totals = profitSheet.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenue,
        grossRevenue: acc.grossRevenue + row.grossRevenue,
        refundAmount: acc.refundAmount + row.refundAmount,
        gst: acc.gst + row.gst,
        adsCostUSD: acc.adsCostUSD + row.adsCostUSD,
        adsCostINR: acc.adsCostINR + row.adsCostINR,
        netRevenue: acc.netRevenue + row.netRevenue,
        transactionCount: acc.transactionCount + row.transactionCount,
        salesCount: acc.salesCount + row.salesCount,
        refundCount: acc.refundCount + row.refundCount,
      }),
      {
        revenue: 0,
        grossRevenue: 0,
        refundAmount: 0,
        gst: 0,
        adsCostUSD: 0,
        adsCostINR: 0,
        netRevenue: 0,
        transactionCount: 0,
        salesCount: 0,
        refundCount: 0,
      }
    );

    const overallRoas = totals.adsCostINR > 0 ? totals.revenue / totals.adsCostINR : 0;
    const overallProfitPercent = totals.revenue > 0 ? (totals.netRevenue / totals.revenue) * 100 : 0;

    return NextResponse.json({
      rows: profitSheet,
      totals: {
        ...totals,
        roas: overallRoas,
        profitPercent: overallProfitPercent,
      },
      exchangeRate,
      source: "stripe_supabase",
      currency: "INR",
      sourceCurrency: "USD",
      businessRule: "Stripe day: 11:30 AM IST -> next 11:29 AM IST",
      dateRange: { start: startDate, end: endDate },
    });
  } catch (error: any) {
    console.error("Profit sheet error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate profit sheet" },
      { status: 500 }
    );
  }
}
