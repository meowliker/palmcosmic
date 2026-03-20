import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
    summary: {
      created: 0,
      skipped: 0,
    },
    message: "No backfill needed for Stripe migration.",
  });
}
