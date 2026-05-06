import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: paidPayments, error: paymentError } = await supabase
      .from("payments")
      .select("id,user_id,payment_status,type,amount,created_at")
      .eq("customer_email", normalizedEmail)
      .eq("payment_status", "paid")
      .in("type", ["bundle", "upsell", "report", "coins"])
      .gte("amount", 0)
      .order("created_at", { ascending: false })
      .limit(1);

    if (paymentError) {
      throw paymentError;
    }

    const latestPaidPayment = paidPayments?.[0] || null;
    const hasPaid = !!latestPaidPayment;

    const { data: users, error: userError } = await supabase
      .from("users")
      .select("id,password_hash,created_at")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    if (userError) {
      throw userError;
    }

    const user = users?.[0] || null;
    const isRegistered = !!user?.password_hash;

    let nextAction: "checkout" | "register" | "login" = "checkout";
    if (hasPaid && isRegistered) {
      nextAction = "login";
    } else if (hasPaid) {
      nextAction = "register";
    }

    return NextResponse.json({
      email: normalizedEmail,
      hasPaid,
      isRegistered,
      nextAction,
      payment: latestPaidPayment
        ? {
            id: latestPaidPayment.id,
            userId: latestPaidPayment.user_id,
            status: latestPaidPayment.payment_status,
            type: latestPaidPayment.type,
            amount: latestPaidPayment.amount,
            createdAt: latestPaidPayment.created_at,
          }
        : null,
      user: user
        ? {
            id: user.id,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[payment-state] Error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Failed to check payment state" },
      { status: 500 }
    );
  }
}
