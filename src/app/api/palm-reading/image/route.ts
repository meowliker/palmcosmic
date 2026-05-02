import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function cleanText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = cleanText(body.userId);
    const imageData = cleanText(body.imageData);

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    if (!imageData || !imageData.startsWith("data:image/")) {
      return NextResponse.json({ success: false, error: "A palm image is required" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const birthDate = cleanText(body.birthDate);
    const zodiacSign = cleanText(body.zodiacSign);
    const supabase = getSupabaseAdmin();

    const profilePayload: Record<string, unknown> = {
      id: userId,
      palm_image: imageData,
      palm_image_url: imageData,
      updated_at: nowIso,
    };

    const email = cleanText(body.email);
    if (email) profilePayload.email = email;
    if (cleanText(body.birthMonth)) profilePayload.birth_month = cleanText(body.birthMonth);
    if (cleanText(body.birthDay)) profilePayload.birth_day = cleanText(body.birthDay);
    if (cleanText(body.birthYear)) profilePayload.birth_year = cleanText(body.birthYear);
    if (zodiacSign) profilePayload.zodiac_sign = zodiacSign;

    const { error: profileError } = await supabase.from("user_profiles").upsert(profilePayload, { onConflict: "id" });

    if (profileError) throw profileError;

    const { error: readingError } = await supabase.from("palm_readings").upsert({
      id: userId,
      reading: null,
      palm_image_url: imageData,
      birth_date: birthDate,
      zodiac_sign: zodiacSign,
      created_at: nowIso,
    }, { onConflict: "id" });

    if (readingError) throw readingError;

    return NextResponse.json({
      success: true,
      palmImageUrl: imageData,
    });
  } catch (error: any) {
    console.error("[palm-reading/image] POST error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to save palm image" },
      { status: 500 }
    );
  }
}
