import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const active = body.active === true;

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from("users")
      .update({
        birth_chart_timer_active: active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[birth-chart-timer] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update birth chart timer" },
      { status: 500 }
    );
  }
}
