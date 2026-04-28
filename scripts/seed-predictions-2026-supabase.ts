import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const inputFile = path.resolve(process.cwd(), "data/predictions-2026.json");

function titleCaseSign(sign: string) {
  return sign.slice(0, 1).toUpperCase() + sign.slice(1);
}

async function main() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }

  if (!fs.existsSync(inputFile)) {
    throw new Error(`Predictions file not found: ${inputFile}`);
  }

  const predictions = JSON.parse(fs.readFileSync(inputFile, "utf8")) as Record<
    string,
    { prediction?: unknown; createdAt?: string }
  >;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const rows = Object.entries(predictions).map(([sign, value]) => ({
    id: sign.toLowerCase(),
    zodiac_sign: titleCaseSign(sign),
    prediction: value.prediction ?? value,
    version: "1.0",
    created_at: value.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("predictions_2026_global")
    .upsert(rows, { onConflict: "id" });

  if (error) throw error;

  console.log(`Seeded ${rows.length} 2026 prediction rows into predictions_2026_global.`);
}

main().catch((error) => {
  console.error("Failed to seed 2026 predictions:", error);
  process.exit(1);
});

