import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function cleanUserId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = cleanUserId(request.nextUrl.searchParams.get("userId"));
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("palm_readings")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ success: true, reading: data || null });
  } catch (error: any) {
    console.error("[palm-reading/user] GET error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to load palm reading" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = cleanUserId(body.userId);
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const row = {
      id: userId,
      reading: body.reading || null,
      palm_image_url: body.palmImageUrl || null,
      birth_date: body.birthDate || null,
      zodiac_sign: body.zodiacSign || null,
      created_at: body.createdAt || new Date().toISOString(),
    };

    const { error } = await getSupabaseAdmin()
      .from("palm_readings")
      .upsert(row, { onConflict: "id" });

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[palm-reading/user] POST error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save palm reading" },
      { status: 500 }
    );
  }
}
