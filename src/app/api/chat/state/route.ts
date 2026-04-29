import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function GET(request: NextRequest) {
  try {
    const userId = clean(request.nextUrl.searchParams.get("userId"));
    const anonId = clean(request.nextUrl.searchParams.get("anonId"));
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const [palmResult, chartResult, chatResult] = await Promise.all([
      supabase.from("palm_readings").select("*").eq("id", userId).maybeSingle(),
      supabase.from("natal_charts").select("*").eq("id", userId).maybeSingle(),
      supabase.from("chat_messages").select("*").eq("id", userId).maybeSingle(),
    ]);

    let chatDoc = chatResult.data || null;

    if (!chatDoc && anonId && anonId !== userId) {
      const { data: anonChatDoc } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("id", anonId)
        .maybeSingle();

      if (anonChatDoc?.messages?.length) {
        chatDoc = anonChatDoc;
        await supabase
          .from("chat_messages")
          .upsert(
            { id: userId, messages: anonChatDoc.messages, updated_at: new Date().toISOString() },
            { onConflict: "id" }
          );
        await supabase.from("chat_messages").delete().eq("id", anonId);
      }
    }

    const error = palmResult.error || chartResult.error || chatResult.error;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      palmReading: palmResult.data || null,
      natalChart: chartResult.data || null,
      chat: chatDoc,
    });
  } catch (error: any) {
    console.error("[chat/state] GET error:", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to load chat state" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const userId = clean(body.userId);
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    if (body.action === "deduct_coins") {
      const amount = Math.max(0, Number(body.amount || 0));
      const { data: user, error: readError } = await supabase
        .from("users")
        .select("coins")
        .eq("id", userId)
        .maybeSingle();
      if (readError) throw readError;

      const coins = Math.max(0, Number(user?.coins || 0) - amount);
      const { error } = await supabase
        .from("users")
        .update({ coins, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
      return NextResponse.json({ success: true, coins });
    }

    const { error } = await supabase
      .from("chat_messages")
      .upsert(
        {
          id: userId,
          messages: Array.isArray(body.messages) ? body.messages : [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[chat/state] POST error:", error?.message || error);
    return NextResponse.json({ success: false, error: error?.message || "Failed to save chat state" }, { status: 500 });
  }
}
