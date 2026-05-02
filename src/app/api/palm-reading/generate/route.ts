import { NextRequest, NextResponse } from "next/server";
import { generatePalmReadingForUser } from "@/lib/palm-reading-generation";

export const dynamic = "force-dynamic";

function cleanUserId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = cleanUserId(body.userId);

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const result = await generatePalmReadingForUser(userId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[palm-reading/generate] POST error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to generate palm reading" },
      { status: 500 }
    );
  }
}
