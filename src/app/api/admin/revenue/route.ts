import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import {
  classifyStoredPaymentEvent,
  normalizeFinanceStatus,
} from "@/lib/finance-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const IST_OFFSET_MINUTES = 330;
const STRIPE_DAY_START_MINUTE_IST = 11 * 60 + 30;
const DEFAULT_START_DATE = "2026-04-30";

type BreakdownRow = {
  id: string;
  label: string;
  count: number;
  revenue: number;
};

type LedgerEntry = Record<string, any> & {
  eventAt: string;
  normalizedStatus: string;
  financialKind: "sale" | "refund" | "ignore";
  amountUsdAbs: number;
  signedAmountUsd: number;
  categoryId: string;
  categoryLabel: string;
  productId: string;
  productLabel: string;
};

function parseDateOnly(value: string | null | undefined): { y: number; m: number; d: number } | null {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function parseTime(value: string | null | undefined, fallback: string): { hour: number; minute: number } {
  const match = String(value || fallback).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return parseTime(fallback, "00:00");
  return {
    hour: Math.min(Math.max(Number(match[1]), 0), 23),
    minute: Math.min(Math.max(Number(match[2]), 0), 59),
  };
}

function dateAtIst(date: string, time = "00:00"): Date {
  const parsedDate = parseDateOnly(date) || parseDateOnly(DEFAULT_START_DATE)!;
  const parsedTime = parseTime(time, "00:00");
  return new Date(
    Date.UTC(
      parsedDate.y,
      parsedDate.m - 1,
      parsedDate.d,
      parsedTime.hour,
      parsedTime.minute,
      0,
      0
    ) - IST_OFFSET_MINUTES * 60 * 1000
  );
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatIstDate(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function stripeBusinessDayStart(date: string): Date {
  return dateAtIst(date, "11:30");
}

function stripeBusinessDayLabel(date: Date): string {
  const shifted = new Date(date.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const minutes = shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
  if (minutes < STRIPE_DAY_START_MINUTE_IST) {
    shifted.setUTCDate(shifted.getUTCDate() - 1);
  }
  return shifted.toISOString().slice(0, 10);
}

function currentStripeDayLabel(now = new Date()): string {
  return stripeBusinessDayLabel(now);
}

function selectedRange(startDate: string | null, endDate: string | null, startTime: string, endTime: string) {
  const start = dateAtIst(startDate || DEFAULT_START_DATE, startTime);
  let endExclusive = dateAtIst(endDate || startDate || DEFAULT_START_DATE, endTime);

  // In the dashboard, 11:30 means a Stripe business-day boundary. The end date is
  // selected as an inclusive business-day label, so May 1 at 11:30 ends on May 2.
  if (endTime === "11:30") {
    endExclusive = addDays(endExclusive, 1);
  } else if (endExclusive <= start) {
    endExclusive = addDays(endExclusive, 1);
  }

  return { start, endExclusive };
}

function titleize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function metadataValue(metadata: unknown, key: string): string {
  if (!metadata || typeof metadata !== "object") return "";
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function resolveCategory(payment: Record<string, any>): { id: string; label: string } {
  const type = String(payment.type || metadataValue(payment.metadata, "type") || "").toLowerCase();
  const billingKind = String(payment.billing_kind || metadataValue(payment.metadata, "billingKind") || "").toLowerCase();

  if (billingKind.includes("renewal") || type.includes("renewal")) {
    return { id: "subscription_renewal", label: "Subscription Renewal" };
  }
  if (billingKind.includes("subscription") || type.includes("subscription")) {
    return { id: "subscription_trial", label: "Subscription Trial" };
  }
  if (type === "coins") return { id: "coin_purchase", label: "Coin Purchase" };
  if (type === "report") return { id: "report_purchase", label: "Report Purchase" };
  if (type === "upsell") return { id: "upsell_purchase", label: "Upsell Purchase" };
  if (type === "bundle") return { id: "bundle_purchase", label: "Bundle Purchase" };
  return { id: type || "other", label: type ? titleize(type) : "Other" };
}

function reportKeyLabel(key: string): string {
  const labels: Record<string, string> = {
    prediction_2026: "2026 Prediction Report",
    palm_reading: "Palm Reading & Birth Chart",
    compatibility: "Compatibility Report",
    soulmate_sketch: "Soulmate Sketch & Reading",
    future_partner: "Future Partner Report",
    all_reports: "All Reports Subscription",
  };
  return labels[key] || titleize(key);
}

function resolveProduct(payment: Record<string, any>): { id: string; label: string } {
  const reportKey = String(payment.report_key || metadataValue(payment.metadata, "reportKey") || metadataValue(payment.metadata, "primaryReport") || "").trim();
  if (reportKey) return { id: reportKey, label: reportKeyLabel(reportKey) };

  const productName = metadataValue(payment.metadata, "productName");
  if (productName) return { id: productName.toLowerCase().replace(/\s+/g, "-"), label: productName };

  const bundleId = String(payment.bundle_id || metadataValue(payment.metadata, "bundleId") || "").trim();
  if (bundleId) return { id: bundleId, label: titleize(bundleId) };

  const packageId = metadataValue(payment.metadata, "packageId");
  if (packageId) return { id: packageId, label: titleize(packageId) };

  const feature = String(payment.feature || metadataValue(payment.metadata, "feature") || "").trim();
  if (feature) return { id: feature, label: titleize(feature) };

  const category = resolveCategory(payment);
  return { id: category.id, label: category.label };
}

function addBreakdown(map: Map<string, BreakdownRow>, id: string, label: string, signedAmount: number, financialKind: string) {
  const row = map.get(id) || { id, label, count: 0, revenue: 0 };
  row.revenue += signedAmount;
  if (financialKind === "sale") row.count += 1;
  if (financialKind === "refund") row.count -= 1;
  map.set(id, row);
}

function sumRevenue(entries: LedgerEntry[], predicate: (entry: LedgerEntry) => boolean): number {
  return entries.filter(predicate).reduce((sum, entry) => sum + entry.signedAmountUsd, 0);
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMoneyString(value: number): string {
  return roundMoney(value).toFixed(2);
}

async function verifyAdminSession(supabase: ReturnType<typeof getSupabaseAdmin>, token: string | null) {
  if (!token) return false;

  const { data: sessionData } = await supabase
    .from("admin_sessions")
    .select("id, expires_at")
    .eq("id", token)
    .single();

  if (!sessionData) return false;

  if (new Date(sessionData.expires_at) < new Date()) {
    await supabase.from("admin_sessions").delete().eq("id", token);
    return false;
  }

  return true;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    const isAdmin = await verifyAdminSession(supabase, token);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startDateParam = searchParams.get("startDate") || DEFAULT_START_DATE;
    const endDateParam = searchParams.get("endDate") || currentStripeDayLabel();
    const startTimeParam = searchParams.get("startTime") || "11:30";
    const endTimeParam = searchParams.get("endTime") || "11:30";
    const customRange = selectedRange(startDateParam, endDateParam, startTimeParam, endTimeParam);

    const { data: allPaymentsRaw, error: paymentsError } = await supabase
      .from("payments")
      .select(
        "id,user_id,type,bundle_id,feature,coins,customer_email,amount,currency,payment_status,fulfilled_at,created_at,stripe_session_id,stripe_payment_intent_id,stripe_customer_id,stripe_subscription_id,report_key,billing_kind,metadata"
      )
      .order("created_at", { ascending: false })
      .limit(5000);

    if (paymentsError) throw paymentsError;

    const { data: allUsersRaw, error: usersError } = await supabase
      .from("users")
      .select(
        "id,email,name,payment_status,subscription_status,access_status,trial_ends_at,subscription_current_period_end,subscription_cancel_at_period_end,subscription_lock_reason"
      );

    if (usersError) throw usersError;

    const users = allUsersRaw || [];
    const userMap = new Map<string, {
      email?: string;
      name?: string;
      subscriptionStatus?: string | null;
      accessStatus?: string | null;
      trialEndsAt?: string | null;
      subscriptionCurrentPeriodEnd?: string | null;
      subscriptionCancelAtPeriodEnd?: boolean;
      subscriptionLockReason?: string | null;
    }>();
    users.forEach((user: any) => userMap.set(user.id, {
      email: user.email,
      name: user.name,
      subscriptionStatus: user.subscription_status || null,
      accessStatus: user.access_status || null,
      trialEndsAt: user.trial_ends_at || null,
      subscriptionCurrentPeriodEnd: user.subscription_current_period_end || null,
      subscriptionCancelAtPeriodEnd: Boolean(user.subscription_cancel_at_period_end),
      subscriptionLockReason: user.subscription_lock_reason || null,
    }));

    const ledgerEntries: LedgerEntry[] = (allPaymentsRaw || []).map((payment: any) => {
      const financial = classifyStoredPaymentEvent(payment.payment_status, payment.amount);
      const category = resolveCategory(payment);
      const product = resolveProduct(payment);

      return {
        ...payment,
        eventAt: payment.created_at || payment.fulfilled_at,
        normalizedStatus: normalizeFinanceStatus(payment.payment_status),
        financialKind: financial.kind,
        amountUsdAbs: financial.amount,
        signedAmountUsd: financial.signedAmount,
        categoryId: category.id,
        categoryLabel: category.label,
        productId: product.id,
        productLabel: product.label,
      };
    });

    const sales = ledgerEntries.filter((entry) => entry.financialKind === "sale");
    const refunds = ledgerEntries.filter((entry) => entry.financialKind === "refund");
    const financialEvents = ledgerEntries.filter((entry) => entry.financialKind !== "ignore");

    const grossRevenue = sales.reduce((sum, entry) => sum + entry.amountUsdAbs, 0);
    const refundAmount = refunds.reduce((sum, entry) => sum + entry.amountUsdAbs, 0);
    const totalRevenue = financialEvents.reduce((sum, entry) => sum + entry.signedAmountUsd, 0);

    const now = new Date();
    const todayLabel = currentStripeDayLabel(now);
    const todayStart = stripeBusinessDayStart(todayLabel);
    const weekStart = addDays(todayStart, -6);

    const todayParts = parseDateOnly(todayLabel)!;
    const monthStart = stripeBusinessDayStart(`${todayParts.y}-${String(todayParts.m).padStart(2, "0")}-01`);
    const yearStart = stripeBusinessDayStart(`${todayParts.y}-01-01`);
    const lastMonthDate = new Date(Date.UTC(todayParts.y, todayParts.m - 2, 1, 12, 0, 0));
    const lastMonthStartLabel = `${lastMonthDate.getUTCFullYear()}-${String(lastMonthDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthStart = stripeBusinessDayStart(lastMonthStartLabel);
    const lastMonthEnd = monthStart;

    const revenueToday = sumRevenue(financialEvents, (entry) => new Date(entry.eventAt) >= todayStart);
    const revenueThisWeek = sumRevenue(financialEvents, (entry) => new Date(entry.eventAt) >= weekStart);
    const revenueThisMonth = sumRevenue(financialEvents, (entry) => new Date(entry.eventAt) >= monthStart);
    const revenueThisYear = sumRevenue(financialEvents, (entry) => new Date(entry.eventAt) >= yearStart);
    const revenueLastMonth = sumRevenue(financialEvents, (entry) => {
      const eventAt = new Date(entry.eventAt);
      return eventAt >= lastMonthStart && eventAt < lastMonthEnd;
    });
    const momGrowth = revenueLastMonth > 0
      ? (((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100).toFixed(1)
      : "N/A";

    const categoryMap = new Map<string, BreakdownRow>();
    const productMap = new Map<string, BreakdownRow>();
    financialEvents.forEach((entry) => {
      addBreakdown(categoryMap, entry.categoryId, entry.categoryLabel, entry.signedAmountUsd, entry.financialKind);
      addBreakdown(productMap, entry.productId, entry.productLabel, entry.signedAmountUsd, entry.financialKind);
    });

    const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);
    const productBreakdown = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);

    const revenueByType = {
      bundle: roundMoney(categoryMap.get("bundle_purchase")?.revenue || 0),
      upsell: roundMoney(categoryMap.get("upsell_purchase")?.revenue || 0),
      coins: roundMoney(categoryMap.get("coin_purchase")?.revenue || 0),
      report: roundMoney(
        (categoryMap.get("report_purchase")?.revenue || 0) +
        (categoryMap.get("subscription_trial")?.revenue || 0) +
        (categoryMap.get("subscription_renewal")?.revenue || 0)
      ),
    };

    const bundleBreakdown = Object.fromEntries(
      productBreakdown.map((product) => [product.id, { count: product.count, revenue: roundMoney(product.revenue) }])
    );

    const uniquePayingUsers = new Set(
      sales.map((entry) => entry.user_id || entry.customer_email).filter(Boolean)
    ).size;
    const arpu = uniquePayingUsers > 0 ? totalRevenue / uniquePayingUsers : 0;
    const averageOrderValue = sales.length > 0 ? grossRevenue / sales.length : 0;

    const failedPayments = ledgerEntries.filter((entry) => entry.normalizedStatus === "failed").length;
    const pendingPayments = ledgerEntries.filter((entry) => ["created", "pending", "open"].includes(entry.normalizedStatus)).length;

    const revenueOverTime: { date: string; revenue: number; orders: number }[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const start = addDays(todayStart, -i);
      const end = addDays(start, 1);
      const label = formatIstDate(start);
      const dayEvents = financialEvents.filter((entry) => {
        const eventAt = new Date(entry.eventAt);
        return eventAt >= start && eventAt < end;
      });
      revenueOverTime.push({
        date: label,
        revenue: roundMoney(dayEvents.reduce((sum, entry) => sum + entry.signedAmountUsd, 0)),
        orders: dayEvents.filter((entry) => entry.financialKind === "sale").length,
      });
    }

    const mapTransaction = (entry: LedgerEntry) => {
      const user = userMap.get(entry.user_id) || {};
      return {
        id: entry.id,
        date: entry.eventAt,
        userId: entry.user_id,
        userEmail: user.email || entry.customer_email || "Unknown",
        userName: user.name || "Unknown",
        amount: roundMoney(entry.signedAmountUsd),
        bundleId: entry.productId,
        productId: entry.productId,
        productLabel: entry.productLabel,
        type: entry.categoryId,
        typeLabel: entry.categoryLabel,
        status: entry.financialKind === "refund" ? "refunded" : entry.normalizedStatus,
        stripeSessionId: entry.stripe_session_id,
        stripePaymentIntentId: entry.stripe_payment_intent_id,
        stripeSubscriptionId: entry.stripe_subscription_id,
        currency: entry.currency || "USD",
        subscriptionStatus: user.subscriptionStatus || null,
        accessStatus: user.accessStatus || null,
        trialEndsAt: user.trialEndsAt || null,
        subscriptionCurrentPeriodEnd: user.subscriptionCurrentPeriodEnd || null,
        subscriptionCancelAtPeriodEnd: Boolean(user.subscriptionCancelAtPeriodEnd),
        subscriptionLockReason: user.subscriptionLockReason || null,
      };
    };

    const recentTransactions = ledgerEntries
      .filter((entry) => entry.financialKind !== "ignore" || ["failed", "created", "pending", "open"].includes(entry.normalizedStatus))
      .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime())
      .slice(0, 150)
      .map(mapTransaction);

    const customPayments = financialEvents.filter((entry) => {
      const eventAt = new Date(entry.eventAt);
      return eventAt >= customRange.start && eventAt < customRange.endExclusive;
    });

    const registeredUsers = users.filter((user: any) => !String(user.id || "").startsWith("anon_"));
    const paidUsers = users.filter((user: any) => user.payment_status === "paid");

    return NextResponse.json({
      currency: "USD",
      source: "stripe_supabase",
      dayMode: "business_1130_ist",
      stripeBusinessDay: {
        startTimeIst: "11:30",
        today: todayLabel,
      },

      totalRevenue: formatMoneyString(totalRevenue),
      grossRevenue: formatMoneyString(grossRevenue),
      refundAmount: formatMoneyString(refundAmount),
      revenueToday: formatMoneyString(revenueToday),
      revenueThisWeek: formatMoneyString(revenueThisWeek),
      revenueThisMonth: formatMoneyString(revenueThisMonth),
      revenueThisYear: formatMoneyString(revenueThisYear),
      revenueLastMonth: formatMoneyString(revenueLastMonth),
      momGrowth,
      arpu: formatMoneyString(arpu),
      averageOrderValue: formatMoneyString(averageOrderValue),

      revenueByType,
      categoryBreakdown: categoryBreakdown.map((row) => ({ ...row, revenue: roundMoney(row.revenue) })),
      productBreakdown: productBreakdown.map((row) => ({ ...row, revenue: roundMoney(row.revenue) })),
      bundleBreakdown,

      totalPayments: ledgerEntries.length,
      successfulPayments: sales.length,
      refundedPayments: refunds.length,
      failedPayments,
      pendingPayments,

      revenueOverTime,
      recentTransactions,

      totalUsers: users.length,
      registeredUsers: registeredUsers.length,
      paidUsersFromDB: paidUsers.length,
      uniquePayingUsers: uniquePayingUsers || paidUsers.length,

      customDateRevenue: formatMoneyString(customPayments.reduce((sum, entry) => sum + entry.signedAmountUsd, 0)),
      customDatePaymentCount: customPayments.filter((entry) => entry.financialKind === "sale").length,
      customDateTransactions: customPayments
        .sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime())
        .map(mapTransaction),
      customDateRange: {
        start: startDateParam,
        end: endDateParam,
        startTime: startTimeParam,
        endTime: endTimeParam,
        startAt: customRange.start.toISOString(),
        endAt: customRange.endExclusive.toISOString(),
      },
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error: any) {
    console.error("Admin revenue API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
