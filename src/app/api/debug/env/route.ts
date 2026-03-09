import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    
    // Check payments table
    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id, amount, payment_status, created_at")
      .limit(10);
    
    // Check users table
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, email")
      .limit(10);

    return NextResponse.json({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      nodeEnv: process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      payments: {
        count: payments?.length || 0,
        data: payments,
        error: paymentsError?.message || null,
      },
      users: {
        count: users?.length || 0,
        data: users?.map(u => ({ id: u.id, email: u.email })),
        error: usersError?.message || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    }, { status: 500 });
  }
}
