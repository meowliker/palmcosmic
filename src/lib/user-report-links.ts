type SupabaseAdminClient = ReturnType<typeof import("@/lib/supabase-admin").getSupabaseAdmin>;

export type UserReportKey =
  | "palm_reading"
  | "birth_chart"
  | "soulmate_sketch"
  | "future_partner"
  | "prediction_2026"
  | "compatibility";

const REPORT_ID_COLUMNS: Record<UserReportKey, string> = {
  palm_reading: "palm_reading_report_id",
  birth_chart: "birth_chart_report_id",
  soulmate_sketch: "soulmate_sketch_report_id",
  future_partner: "future_partner_report_id",
  prediction_2026: "prediction_2026_report_id",
  compatibility: "compatibility_report_id",
};

function isUserReportKey(value: string): value is UserReportKey {
  return value in REPORT_ID_COLUMNS;
}

function normalizeSignId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value.trim().toLowerCase() || null;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return normalizeSignId(record.name || record.sign || record.id);
  }
  return null;
}

async function getPrediction2026ReportId(
  supabase: SupabaseAdminClient,
  userId: string
): Promise<string> {
  const { data: user } = await supabase
    .from("users")
    .select("zodiac_sign, sun_sign")
    .eq("id", userId)
    .maybeSingle();

  return normalizeSignId(user?.zodiac_sign) || normalizeSignId(user?.sun_sign) || "prediction_2026";
}

async function ensurePalmReadingReportId(supabase: SupabaseAdminClient, userId: string): Promise<string> {
  await supabase
    .from("palm_readings")
    .upsert({ id: userId }, { onConflict: "id" });
  return userId;
}

async function ensureSoulmateSketchReportId(supabase: SupabaseAdminClient, userId: string): Promise<string | null> {
  const nowIso = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("soulmate_sketches")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    console.error("[user-report-links] failed to read soulmate sketch row", existingError);
    return null;
  }

  if (existing?.id) return String(existing.id);

  const { data, error } = await supabase
    .from("soulmate_sketches")
    .insert(
      {
        user_id: userId,
        status: "pending",
        updated_at: nowIso,
      }
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[user-report-links] failed to ensure soulmate sketch row", error);
    return null;
  }

  return data?.id ? String(data.id) : null;
}

async function ensureFuturePartnerReportId(supabase: SupabaseAdminClient, userId: string): Promise<string | null> {
  const nowIso = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("future_partner_reports")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) {
    console.error("[user-report-links] failed to read future partner row", existingError);
    return null;
  }

  if (existing?.id) return String(existing.id);

  const { data, error } = await supabase
    .from("future_partner_reports")
    .insert(
      {
        user_id: userId,
        status: "pending",
        updated_at: nowIso,
      }
    )
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[user-report-links] failed to ensure future partner row", error);
    return null;
  }

  return data?.id ? String(data.id) : null;
}

async function ensureBirthChartReportId(supabase: SupabaseAdminClient, userId: string): Promise<string | null> {
  const { data: existing, error: existingError } = await supabase
    .from("birth_chart_reports")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("[user-report-links] failed to read birth chart report row", existingError);
    return null;
  }

  if (existing?.id) return String(existing.id);

  const { data, error } = await supabase
    .from("birth_chart_reports")
    .insert({ user_id: userId, status: "pending" })
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[user-report-links] failed to create birth chart report row", error);
    return null;
  }

  return data?.id ? String(data.id) : null;
}

async function ensureReportIdForUser(
  supabase: SupabaseAdminClient,
  userId: string,
  reportKey: UserReportKey
): Promise<string | null> {
  if (reportKey === "palm_reading") return ensurePalmReadingReportId(supabase, userId);
  if (reportKey === "birth_chart") return ensureBirthChartReportId(supabase, userId);
  if (reportKey === "soulmate_sketch") return ensureSoulmateSketchReportId(supabase, userId);
  if (reportKey === "future_partner") return ensureFuturePartnerReportId(supabase, userId);
  if (reportKey === "prediction_2026") return getPrediction2026ReportId(supabase, userId);
  if (reportKey === "compatibility") return `compatibility_${userId}`;
  return null;
}

export async function linkReportToUser(params: {
  supabase: SupabaseAdminClient;
  userId: string;
  reportKey: UserReportKey;
  reportId: string;
  email?: string | null;
}) {
  const column = REPORT_ID_COLUMNS[params.reportKey];
  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    [column]: params.reportId,
    updated_at: nowIso,
  };

  const userPatch = {
    id: params.userId,
    ...(params.email ? { email: params.email } : {}),
    ...patch,
  };

  const profilePatch = {
    id: params.userId,
    ...(params.email ? { email: params.email } : {}),
    ...patch,
  };

  const { error: userError } = await params.supabase
    .from("users")
    .upsert(userPatch, { onConflict: "id" });

  if (userError) {
    console.error("[user-report-links] failed to link report on users", userError);
    throw userError;
  }

  const { error: profileError } = await params.supabase
    .from("user_profiles")
    .upsert(profilePatch, { onConflict: "id" });

  if (profileError) {
    console.error("[user-report-links] failed to link report on user_profiles", profileError);
    throw profileError;
  }
}

export async function ensureAndLinkReportForUser(params: {
  supabase: SupabaseAdminClient;
  userId: string;
  reportKey: string;
  email?: string | null;
}) {
  if (!isUserReportKey(params.reportKey)) return null;

  const reportId = await ensureReportIdForUser(params.supabase, params.userId, params.reportKey);
  if (!reportId) return null;

  await linkReportToUser({
    supabase: params.supabase,
    userId: params.userId,
    reportKey: params.reportKey,
    reportId,
    email: params.email,
  });

  return reportId;
}

export async function ensureAndLinkReportsForUser(params: {
  supabase: SupabaseAdminClient;
  userId: string;
  reportKeys: string[];
  email?: string | null;
}) {
  const linked: Record<string, string> = {};

  for (const reportKey of params.reportKeys) {
    const reportId = await ensureAndLinkReportForUser({
      supabase: params.supabase,
      userId: params.userId,
      reportKey,
      email: params.email,
    });

    if (reportId) linked[reportKey] = reportId;
  }

  return linked;
}
