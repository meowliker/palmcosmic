import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getSoulmateSketchJobStatusFromKie } from "@/lib/soulmate-sketch";
import { linkReportToUser } from "@/lib/user-report-links";

export const maxDuration = 60;

interface SyncBody {
  secret?: string;
  limit?: number;
  staleSeconds?: number;
}

interface SoulmateSketchRow {
  id: string;
  user_id: string;
  status: "pending" | "generating" | "complete" | "failed";
  provider_job_id: string | null;
  sketch_image_url: string | null;
  generation_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

function getAuthSecret(request: NextRequest, bodySecret?: string): string | null {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  const headerSecret = request.headers.get("x-cron-secret");
  return bearer || headerSecret || bodySecret || null;
}

export async function POST(request: NextRequest) {
  try {
    const body: SyncBody = await request.json().catch(() => ({}));
    const expectedSecret = process.env.CRON_SECRET || process.env.ADMIN_SYNC_SECRET;

    if (!expectedSecret) {
      return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
    }

    const providedSecret = getAuthSecret(request, body.secret);
    if (!providedSecret || providedSecret !== expectedSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = Math.max(1, Math.min(50, body.limit || 20));
    const staleSeconds = Math.max(30, Math.min(3600, body.staleSeconds || 60));
    const thresholdIso = new Date(Date.now() - staleSeconds * 1000).toISOString();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("soulmate_sketches")
      .select("id,user_id,status,provider_job_id,sketch_image_url,generation_count,created_at,updated_at")
      .eq("status", "generating")
      .not("provider_job_id", "is", null)
      .is("sketch_image_url", null)
      .lt("updated_at", thresholdIso)
      .order("updated_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const rows = (data || []) as SoulmateSketchRow[];
    let completed = 0;
    let failed = 0;
    let stillGenerating = 0;
    let errors = 0;

    for (const row of rows) {
      try {
        if (!row.provider_job_id) {
          stillGenerating += 1;
          continue;
        }

        const job = await getSoulmateSketchJobStatusFromKie(row.provider_job_id);

        if (job.state === "success" && job.imageUrl) {
          const { data: completedRow, error: updateError } = await supabase
            .from("soulmate_sketches")
            .update({
              status: "complete",
              sketch_image_url: job.imageUrl,
              generated_at: new Date().toISOString(),
              generation_count: 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id)
            .select("id,user_id")
            .maybeSingle();

          if (updateError) {
            throw updateError;
          }

          if (completedRow?.id && completedRow?.user_id) {
            await linkReportToUser({
              supabase,
              userId: completedRow.user_id,
              reportKey: "soulmate_sketch",
              reportId: String(completedRow.id),
            });
          }

          completed += 1;
          continue;
        }

        if (job.state === "fail" || job.state === "failed") {
          const { error: updateError } = await supabase
            .from("soulmate_sketches")
            .update({
              status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);

          if (updateError) {
            throw updateError;
          }

          failed += 1;
          continue;
        }

        await supabase
          .from("soulmate_sketches")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", row.id);
        stillGenerating += 1;
      } catch (rowError) {
        errors += 1;
        console.error("[sync-soulmate-sketches] row sync failed", {
          sketchId: row.id,
          userId: row.user_id,
          providerJobId: row.provider_job_id,
          error: rowError,
        });
      }
    }

    return NextResponse.json({
      success: true,
      checked: rows.length,
      completed,
      failed,
      stillGenerating,
      errors,
    });
  } catch (error) {
    console.error("[sync-soulmate-sketches] unexpected error", error);
    return NextResponse.json({ error: "sync_failed" }, { status: 500 });
  }
}
