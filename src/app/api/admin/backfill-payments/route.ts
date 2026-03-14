import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

// Bundle prices in paise (matching DEFAULT_PRICING in lib/pricing.ts)
const BUNDLE_PRICES: Record<string, number> = {
  "palm-reading": 55900,   // ₹559
  "palm-birth": 83900,     // ₹839
  "palm-birth-compat": 159900, // ₹1599
};

export async function POST(request: NextRequest) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify admin token
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { data: sessionData } = await supabase
      .from("admin_sessions")
      .select("*")
      .eq("id", token)
      .single();
      
    if (!sessionData || new Date(sessionData.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invalid or expired session" }, { status: 401 });
    }

    // Find users with payu_txn_id but no corresponding payment record
    const { data: usersWithPayments, error: usersError } = await supabase
      .from("users")
      .select("id, email, payu_txn_id, payu_payment_id, bundle_purchased, payment_status, created_at")
      .not("payu_txn_id", "is", null);

    if (usersError) {
      return NextResponse.json({ error: usersError.message }, { status: 500 });
    }

    let created = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const user of usersWithPayments || []) {
      // Check if payment record already exists
      const { data: existingPayment } = await supabase
        .from("payments")
        .select("id")
        .eq("payu_txn_id", user.payu_txn_id)
        .maybeSingle();

      if (existingPayment) {
        // Update existing payment with correct amount
        const bundleId = user.bundle_purchased || "palm-birth";
        const correctAmount = BUNDLE_PRICES[bundleId] || 83900;
        
        const { error: updateError } = await supabase
          .from("payments")
          .update({ amount: correctAmount, bundle_id: bundleId })
          .eq("id", existingPayment.id);
        
        if (updateError) {
          results.push({ userId: user.id, txnId: user.payu_txn_id, status: "update error", error: updateError.message });
        } else {
          skipped++;
          results.push({ userId: user.id, txnId: user.payu_txn_id, status: "updated amount", newAmount: correctAmount / 100 });
        }
        continue;
      }

      // Create payment record from user data
      const bundleId = user.bundle_purchased || "palm-birth";
      const amount = BUNDLE_PRICES[bundleId] || 83900; // Default to palm-birth price

      const { error: insertError } = await supabase.from("payments").insert({
        id: `pay_${user.payu_txn_id}`,
        payu_txn_id: user.payu_txn_id,
        payu_payment_id: user.payu_payment_id,
        user_id: user.id,
        type: "bundle",
        bundle_id: bundleId,
        customer_email: user.email || null,
        amount,
        currency: "INR",
        payment_status: user.payment_status || "paid",
        fulfilled_at: user.created_at,
        created_at: user.created_at,
      });

      if (insertError) {
        results.push({ userId: user.id, txnId: user.payu_txn_id, status: "error", error: insertError.message });
      } else {
        created++;
        results.push({ userId: user.id, txnId: user.payu_txn_id, status: "created" });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        totalUsers: usersWithPayments?.length || 0,
        created,
        skipped,
      },
      results,
    });
  } catch (error: any) {
    console.error("Backfill payments error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
