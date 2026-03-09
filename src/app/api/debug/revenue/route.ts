import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Debug version of admin revenue API - no auth required
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    // Create fresh client
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    
    // Fetch payments exactly like admin revenue API
    const { data: allPaymentsRaw, error: paymentsError } = await supabase
      .from("payments")
      .select("*")
      .order("created_at", { ascending: false });

    const payments = (allPaymentsRaw || []).map((p: any) => ({
      id: p.id,
      amount: p.amount,
      payment_status: p.payment_status,
      user_id: p.user_id,
      created_at: p.created_at,
    }));

    const getAmountINR = (p: any) => (p.amount || 0) / 100;
    const paidPayments = payments.filter(p => p.payment_status === "paid");
    const totalRevenue = paidPayments.reduce((sum, p) => sum + getAmountINR(p), 0);
    const uniquePayingUsers = new Set(paidPayments.map(p => p.user_id).filter(Boolean)).size;

    // Fetch users
    const { data: users } = await supabase.from("users").select("id, email");
    const nonAnonUsers = (users || []).filter((u: any) => !u.id.startsWith("anon_"));

    const response = NextResponse.json({
      _version: "v3-fresh-client",
      timestamp: new Date().toISOString(),
      supabaseUrl: url,
      
      // Raw data
      rawPaymentsCount: allPaymentsRaw?.length || 0,
      rawPayments: allPaymentsRaw,
      paymentsError: paymentsError?.message || null,
      
      // Processed data (same as admin API)
      processedPaymentsCount: payments.length,
      paidPaymentsCount: paidPayments.length,
      
      // Revenue calculations
      totalRevenue: totalRevenue.toFixed(2),
      uniquePayingUsers,
      totalUsers: nonAnonUsers.length,
      
      // What admin dashboard should show
      expectedDisplay: {
        totalRevenue: `₹${totalRevenue.toFixed(2)}`,
        payingUsers: `${uniquePayingUsers} of ${nonAnonUsers.length} total`,
      },
    });

    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
