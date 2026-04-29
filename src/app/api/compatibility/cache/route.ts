import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function getDocId(sign1: string | null, sign2: string | null) {
  if (!sign1 || !sign2) return null;
  const [s1, s2] = [sign1, sign2].sort();
  return `${s1.toLowerCase()}_${s2.toLowerCase()}`;
}

export async function GET(request: NextRequest) {
  try {
    const docId = getDocId(request.nextUrl.searchParams.get("sign1"), request.nextUrl.searchParams.get("sign2"));
    if (!docId) {
      return NextResponse.json({ success: false, error: "sign1 and sign2 are required" }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("compatibility")
      .select("*")
      .eq("id", docId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ success: true, result: data || null });
  } catch (error: any) {
    console.error("[compatibility/cache] GET error:", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to load compatibility" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const docId = getDocId(body.sign1, body.sign2);
    if (!docId) {
      return NextResponse.json({ success: false, error: "sign1 and sign2 are required" }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from("compatibility")
      .upsert(
        {
          id: docId,
          ...body,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[compatibility/cache] POST error:", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to save compatibility" }, { status: 500 });
  }
}
