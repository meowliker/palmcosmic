import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_PRICING } from "@/lib/pricing";

// GET - Fetch current pricing
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "pricing")
      .single();

    if (error || !data) {
      return NextResponse.json({ success: true, pricing: DEFAULT_PRICING });
    }

    return NextResponse.json({ success: true, pricing: data.value });
  } catch (error: any) {
    console.error("Error fetching pricing:", error);
    return NextResponse.json({ success: true, pricing: DEFAULT_PRICING });
  }
}

// POST - Update pricing
export async function POST(request: NextRequest) {
  try {
    const { pricing } = await request.json();

    if (!pricing) {
      return NextResponse.json({ success: false, error: "Pricing data required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase.from("settings").upsert(
      {
        key: "pricing",
        value: pricing,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      console.error("Error saving pricing:", error);
      return NextResponse.json({ success: false, error: "Failed to save pricing" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating pricing:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update pricing" }, { status: 500 });
  }
}
