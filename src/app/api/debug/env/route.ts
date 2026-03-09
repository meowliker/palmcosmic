import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Create a fresh client every time - no caching
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    // Check payments table
    const { data: payments, error: paymentsError, count: paymentsCount } = await supabase
      .from("payments")
      .select("id, amount, payment_status, created_at, user_id", { count: "exact" });
    
    // Check users table
    const { data: users, error: usersError, count: usersCount } = await supabase
      .from("users")
      .select("id, email", { count: "exact" });

    // Calculate revenue like the admin API does
    const paidPayments = (payments || []).filter((p: any) => p.payment_status === "paid");
    const totalRevenue = paidPayments.reduce((sum: number, p: any) => sum + ((p.amount || 0) / 100), 0);
    const uniquePayingUsers = new Set(paidPayments.map((p: any) => p.user_id).filter(Boolean)).size;

    const response = NextResponse.json({
      supabaseUrl: url,
      serviceKeyPrefix: serviceKey?.substring(0, 20) + "...",
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      payments: {
        totalCount: paymentsCount,
        paidCount: paidPayments.length,
        data: payments,
        error: paymentsError?.message || null,
      },
      users: {
        count: usersCount,
        data: users?.map((u: any) => ({ id: u.id, email: u.email })),
        error: usersError?.message || null,
      },
      calculatedRevenue: {
        totalRevenue: totalRevenue.toFixed(2),
        uniquePayingUsers,
      },
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      stack: err.stack,
    }, { status: 500 });
  }
}
