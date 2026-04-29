import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const sign = request.nextUrl.searchParams.get("sign")?.trim().toLowerCase();
    if (!sign) {
      return NextResponse.json({ success: false, error: "sign is required" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("predictions_2026_global")
      .select("prediction")
      .eq("id", sign)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ success: true, prediction: data?.prediction || null });
  } catch (error: any) {
    console.error("[prediction-2026/global] Error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load prediction" },
      { status: 500 }
    );
  }
}
