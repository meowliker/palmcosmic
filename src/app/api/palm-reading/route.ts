import { NextRequest, NextResponse } from "next/server";
import { analyzePalmImage } from "@/lib/palm-reading-generation";

export async function POST(request: NextRequest) {
  try {
    const { imageData, birthDate, zodiacSign } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: "No image provided" },
        { status: 400 }
      );
    }

    const reading = await analyzePalmImage({
      imageData,
      birthDate,
      zodiacSign,
    });

    return NextResponse.json({
      success: true,
      reading,
    });
  } catch (error: any) {
    console.error("Palm reading API error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to analyze palm" },
      { status: 500 }
    );
  }
}
