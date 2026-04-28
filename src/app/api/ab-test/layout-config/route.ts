import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_LAYOUT_B_CONFIG, normalizeLayoutBConfig } from "@/lib/layout-b-funnel";

const SETTINGS_KEY = "funnel_layout_b_config";

function disableLayoutB(config: ReturnType<typeof normalizeLayoutBConfig>) {
  return {
    ...config,
    enabled: false,
    layoutBEnabled: false,
    variantAWeight: 100,
    variantBWeight: 0,
  };
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    const config = disableLayoutB(normalizeLayoutBConfig(data?.value || DEFAULT_LAYOUT_B_CONFIG));
    return NextResponse.json({ success: true, config });
  } catch (error) {
    console.error("layout-config GET error:", error);
    return NextResponse.json({ success: true, config: disableLayoutB(DEFAULT_LAYOUT_B_CONFIG) });
  }
}
