import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// App launch date - March 13, 2026 (IST)
const APP_LAUNCH_DATE = "2026-03-13";

// PayU API URL - use postservice with form=2 for JSON response
const PAYU_BASE_URL = process.env.PAYU_MODE === "live" 
  ? "https://info.payu.in/merchant/postservice?form=2"
  : "https://test.payu.in/merchant/postservice?form=2";

interface PayUTransaction {
  mihpayid: string;
  txnid: string;
  amount: string;
  status: string;
  mode: string;
  email: string;
  phone: string;
  firstname: string;
  productinfo: string;
  addedon: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  bank_ref_num: string;
  bankcode: string;
  error_code: string;
  error_Message: string;
  net_amount_debit: string;
  discount: string;
  field9: string;
}

function generateHash(params: string): string {
  return crypto.createHash("sha512").update(params).digest("hex");
}

async function fetchPayUTransactions(fromDate: string, toDate: string): Promise<PayUTransaction[]> {
  const merchantKey = process.env.PAYU_MERCHANT_KEY;
  const merchantSalt = process.env.PAYU_MERCHANT_SALT;

  if (!merchantKey || !merchantSalt) {
    console.error("PayU credentials missing - key:", !!merchantKey, "salt:", !!merchantSalt);
    throw new Error("PayU credentials not configured");
  }

  const command = "get_Transaction_Details";
  // PayU expects dates in format: YYYY-MM-DD (without time for var1, var2)
  const var1 = fromDate; // Start date
  const var2 = toDate;   // End date
  
  // PayU hash format for get_Transaction_Details: key|command|var1|salt
  const hashString = `${merchantKey}|${command}|${var1}|${merchantSalt}`;
  const hash = generateHash(hashString);

  console.log("PayU API request - key:", merchantKey.slice(0, 4) + "***", "fromDate:", var1, "toDate:", var2);
  console.log("PayU hash string (masked):", `${merchantKey.slice(0, 4)}***|${command}|${var1}|***`);

  const formData = new URLSearchParams();
  formData.append("key", merchantKey);
  formData.append("command", command);
  formData.append("var1", var1);
  formData.append("var2", var2);
  formData.append("hash", hash);

  try {
    const response = await fetch(PAYU_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
      },
      body: formData.toString(),
    });

    const responseText = await response.text();
    console.log("PayU raw response (first 1000 chars):", responseText.slice(0, 1000));

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("PayU response is not JSON:", responseText.slice(0, 500));
      throw new Error("PayU API returned invalid response: " + responseText.slice(0, 100));
    }

    console.log("PayU parsed response - status:", data.status, "msg:", data.msg);

    // PayU returns status=1 for success
    if (data.status === 1 && data.Transaction_details) {
      const allTxns = Array.isArray(data.Transaction_details) ? data.Transaction_details : Object.values(data.Transaction_details);
      console.log("PayU returned", allTxns.length, "total transactions");
      
      const successTxns = allTxns.filter(
        (txn: PayUTransaction) => txn.status === "success" || txn.status === "captured"
      );
      console.log("PayU successful transactions:", successTxns.length);
      
      return successTxns;
    }

    // Check for error messages
    if (data.msg) {
      console.error("PayU API error message:", data.msg);
      throw new Error("PayU API error: " + data.msg);
    }

    console.log("PayU returned no transactions or unexpected format");
    return [];
  } catch (fetchError: any) {
    console.error("PayU fetch error:", fetchError.message);
    throw fetchError;
  }
}

// Convert Costa Rica time (UTC-6) to IST (UTC+5:30)
function convertCostaRicaToIST(crDateStr: string, crTimeStr: string): Date {
  // Parse Costa Rica date and time
  const [year, month, day] = crDateStr.split("-").map(Number);
  const [hours, minutes] = crTimeStr.split(":").map(Number);
  
  // Create date in Costa Rica timezone (UTC-6)
  const crDate = new Date(Date.UTC(year, month - 1, day, hours + 6, minutes, 0));
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(crDate.getTime() + istOffset);
  
  return istDate;
}

// Format date for PayU API (YYYY-MM-DD)
function formatDateForPayU(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    
    // Date range parameters (in Costa Rica timezone by default)
    const startDateParam = searchParams.get("startDate"); // YYYY-MM-DD
    const endDateParam = searchParams.get("endDate");     // YYYY-MM-DD
    const startTimeParam = searchParams.get("startTime") || "00:00"; // HH:MM
    const endTimeParam = searchParams.get("endTime") || "23:59";     // HH:MM
    const timezone = searchParams.get("timezone") || "costa_rica"; // costa_rica or ist

    if (!token) {
      return NextResponse.json({ error: "Unauthorized - No token provided" }, { status: 401 });
    }

    // Verify admin session
    const { data: sessionData } = await supabase.from("admin_sessions").select("*").eq("id", token).single();
    if (!sessionData) {
      return NextResponse.json({ error: "Unauthorized - Invalid session" }, { status: 401 });
    }
    
    if (new Date(sessionData.expires_at) < new Date()) {
      await supabase.from("admin_sessions").delete().eq("id", token);
      return NextResponse.json({ error: "Session expired - Please login again" }, { status: 401 });
    }

    // Calculate date range for PayU API
    let payuStartDate: string;
    let payuEndDate: string;
    let filterStartTime: Date | null = null;
    let filterEndTime: Date | null = null;

    if (startDateParam && endDateParam) {
      if (timezone === "costa_rica") {
        // Convert Costa Rica time to IST for PayU API
        const istStart = convertCostaRicaToIST(startDateParam, startTimeParam);
        const istEnd = convertCostaRicaToIST(endDateParam, endTimeParam);
        
        payuStartDate = formatDateForPayU(istStart);
        payuEndDate = formatDateForPayU(istEnd);
        filterStartTime = istStart;
        filterEndTime = istEnd;
      } else {
        // Already in IST - create dates in IST timezone
        payuStartDate = startDateParam;
        payuEndDate = endDateParam;
        
        // Parse as IST (UTC+5:30)
        filterStartTime = new Date(`${startDateParam}T${startTimeParam}:00+05:30`);
        filterEndTime = new Date(`${endDateParam}T${endTimeParam}:59+05:30`);
      }
    } else {
      // Default: from app launch to today
      payuStartDate = APP_LAUNCH_DATE;
      payuEndDate = formatDateForPayU(new Date());
    }

    // Ensure we don't fetch before app launch
    if (payuStartDate < APP_LAUNCH_DATE) {
      payuStartDate = APP_LAUNCH_DATE;
    }

    // Fetch transactions from PayU
    let transactions: PayUTransaction[] = [];
    try {
      transactions = await fetchPayUTransactions(payuStartDate, payuEndDate);
    } catch (payuError: any) {
      console.error("PayU fetch error:", payuError);
      return NextResponse.json({ 
        error: "Failed to fetch PayU transactions", 
        details: payuError.message 
      }, { status: 500 });
    }

    // Filter by exact time if specified
    console.log("Before time filter:", transactions.length, "transactions");
    console.log("Filter start:", filterStartTime?.toISOString(), "Filter end:", filterEndTime?.toISOString());
    
    if (filterStartTime && filterEndTime) {
      transactions = transactions.filter(txn => {
        // PayU addedon format: "2026-03-15 14:03:53" (IST)
        const txnDate = new Date(txn.addedon.replace(" ", "T") + "+05:30");
        const isInRange = txnDate >= filterStartTime! && txnDate <= filterEndTime!;
        if (!isInRange) {
          console.log("Filtered out:", txn.addedon, "->", txnDate.toISOString());
        }
        return isInRange;
      });
    }
    
    console.log("After time filter:", transactions.length, "transactions");

    // Process transactions
    const processedTransactions = transactions.map(txn => ({
      id: txn.mihpayid,
      payuId: txn.mihpayid,
      txnId: txn.txnid,
      amount: parseFloat(txn.amount) || 0,
      status: txn.status,
      email: txn.email,
      phone: txn.phone,
      name: txn.firstname || "Customer",
      productInfo: txn.productinfo,
      date: txn.addedon,
      dateIST: new Date(txn.addedon),
      userId: txn.udf1 || "",
      type: txn.udf2 || "bundle",
      bundleId: txn.udf3 || "",
      feature: txn.udf4 || "",
      coins: parseInt(txn.udf5) || 0,
      bankRef: txn.bank_ref_num,
      paymentMode: txn.mode,
      netAmount: parseFloat(txn.net_amount_debit) || parseFloat(txn.amount) || 0,
    }));

    // Calculate metrics
    const totalRevenue = processedTransactions.reduce((sum, txn) => sum + txn.amount, 0);
    const totalNetRevenue = processedTransactions.reduce((sum, txn) => sum + txn.netAmount, 0);
    const totalTransactions = processedTransactions.length;
    const uniqueUsers = new Set(processedTransactions.map(txn => txn.email).filter(Boolean)).size;

    // Revenue by bundle
    const bundleBreakdown = {
      "palm-reading": { count: 0, revenue: 0 },
      "palm-birth": { count: 0, revenue: 0 },
      "palm-birth-compat": { count: 0, revenue: 0 },
    };

    processedTransactions.forEach(txn => {
      const bundleId = txn.bundleId as keyof typeof bundleBreakdown;
      if (bundleBreakdown[bundleId]) {
        bundleBreakdown[bundleId].count++;
        bundleBreakdown[bundleId].revenue += txn.amount;
      }
    });

    // Revenue by type
    const revenueByType = {
      bundle: 0,
      upsell: 0,
      coins: 0,
      report: 0,
    };

    processedTransactions.forEach(txn => {
      const type = txn.type as keyof typeof revenueByType;
      if (revenueByType[type] !== undefined) {
        revenueByType[type] += txn.amount;
      } else {
        revenueByType.bundle += txn.amount;
      }
    });

    // Revenue by day (for chart)
    const revenueByDay: Record<string, number> = {};
    processedTransactions.forEach(txn => {
      const dateStr = txn.date.split(" ")[0]; // Get just the date part
      revenueByDay[dateStr] = (revenueByDay[dateStr] || 0) + txn.amount;
    });

    const revenueOverTime = Object.entries(revenueByDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate period metrics
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const revenueToday = processedTransactions
      .filter(txn => new Date(txn.date) >= startOfToday)
      .reduce((sum, txn) => sum + txn.amount, 0);

    const revenueThisWeek = processedTransactions
      .filter(txn => new Date(txn.date) >= startOfWeek)
      .reduce((sum, txn) => sum + txn.amount, 0);

    const revenueThisMonth = processedTransactions
      .filter(txn => new Date(txn.date) >= startOfMonth)
      .reduce((sum, txn) => sum + txn.amount, 0);

    // ARPU
    const arpu = uniqueUsers > 0 ? (totalRevenue / uniqueUsers).toFixed(2) : "0";

    // Recent transactions (sorted by date desc)
    const recentTransactions = [...processedTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 100)
      .map(txn => ({
        id: txn.id,
        date: txn.date,
        userId: txn.userId,
        userEmail: txn.email,
        userName: txn.name,
        amount: txn.amount,
        bundleId: txn.bundleId,
        type: txn.type,
        status: "paid",
        paymentMode: txn.paymentMode,
        bankRef: txn.bankRef,
      }));

    return NextResponse.json({
      source: "payu",
      currency: "INR",
      dateRange: {
        start: payuStartDate,
        end: payuEndDate,
        startTime: startTimeParam,
        endTime: endTimeParam,
        timezone,
        filterStartIST: filterStartTime?.toISOString(),
        filterEndIST: filterEndTime?.toISOString(),
      },
      
      // Revenue KPIs
      totalRevenue: totalRevenue.toFixed(2),
      totalNetRevenue: totalNetRevenue.toFixed(2),
      revenueToday: revenueToday.toFixed(2),
      revenueThisWeek: revenueThisWeek.toFixed(2),
      revenueThisMonth: revenueThisMonth.toFixed(2),
      
      // Breakdown
      revenueByType,
      bundleBreakdown,
      
      // Users
      uniquePayingUsers: uniqueUsers,
      arpu,
      
      // Transactions
      totalTransactions,
      successfulPayments: totalTransactions,
      failedPayments: 0,
      pendingPayments: 0,
      
      // Charts
      revenueOverTime,
      
      // Recent transactions
      recentTransactions,
      
      // Custom date range (for compatibility)
      customDateRevenue: totalRevenue.toFixed(2),
      customDatePaymentCount: totalTransactions,
      customDateTransactions: recentTransactions,
    }, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    });
  } catch (error: any) {
    console.error("Admin revenue-payu API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch revenue data" },
      { status: 500 }
    );
  }
}
