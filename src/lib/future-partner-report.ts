import { anthropic } from "@/lib/anthropic";
import { toPartnerInitial } from "@/lib/future-partner-format";

export interface FuturePartnerReportData {
  partnerName: string;
  marriageYear: string;
  partnerAgeAtMarriage: string;
  relationshipTheme: string;
  compatibilityScore: number;
  compatibilitySummary: string;
  marriageOutlook: string;
  strengths: string[];
  growthAreas: string[];
  guidance: string;
  reportVersion?: string;
  variationSeed?: string;
}

const PARTNER_REPORT_MAX_RETRIES = 4;
export const FUTURE_PARTNER_REPORT_VERSION = "2026-04-29-v2";

interface FuturePartnerAnchors {
  partnerName: string;
  marriageYear: string;
  partnerAgeAtMarriage: string;
  compatibilityScore: number;
  variationSeed: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOverloadedError(error: unknown): boolean {
  const asAny = error as any;
  const status = Number(asAny?.status || asAny?.statusCode || asAny?.response?.status || 0);
  if (status === 429 || status === 529 || status === 503) return true;

  const message = String(asAny?.message || "").toLowerCase();
  return (
    message.includes("overloaded_error") ||
    message.includes("overloaded") ||
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("529")
  );
}

function toPlainSign(value: unknown): string {
  if (!value) return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "—";

    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed?.name === "string" && parsed.name.trim()) {
          return parsed.name.trim();
        }
      } catch {
        // ignore json parse errors
      }
    }

    return trimmed;
  }

  if (typeof value === "object" && value !== null) {
    const asRecord = value as Record<string, unknown>;
    if (typeof asRecord.name === "string" && asRecord.name.trim()) {
      return asRecord.name.trim();
    }
  }

  return "—";
}

function extractText(response: any): string {
  const firstText = Array.isArray(response?.content)
    ? response.content.find((chunk: any) => chunk?.type === "text" && typeof chunk?.text === "string")
    : null;

  return firstText?.text?.trim() || "";
}

function stripMarkdownFences(input: string): string {
  return input.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function parseReportJson(raw: string): FuturePartnerReportData {
  const cleaned = stripMarkdownFences(raw);

  const parseCandidates = [cleaned];
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch?.[0] && jsonMatch[0] !== cleaned) {
    parseCandidates.push(jsonMatch[0]);
  }

  let parsed: any = null;
  for (const candidate of parseCandidates) {
    try {
      parsed = JSON.parse(candidate);
      break;
    } catch {
      // try next candidate
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Could not parse future partner report JSON");
  }

  const requireText = (value: unknown, fieldName: string): string => {
    const normalized = String(value || "").trim();
    if (!normalized) {
      throw new Error(`Missing required future partner report field: ${fieldName}`);
    }
    return normalized;
  };

  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths.map((v: unknown) => String(v).trim()).filter(Boolean)
    : [];

  const growthAreas = Array.isArray(parsed.growthAreas)
    ? parsed.growthAreas.map((v: unknown) => String(v).trim()).filter(Boolean)
    : [];

  const scoreRaw = Number(parsed.compatibilityScore);
  const compatibilityScore = Number.isFinite(scoreRaw)
    ? Math.max(0, Math.min(100, Math.round(scoreRaw)))
    : 72;

  const partnerName = toPartnerInitial(requireText(parsed.partnerName, "partnerName"));
  const marriageYear = requireText(parsed.marriageYear, "marriageYear");
  const partnerAgeAtMarriage = requireText(parsed.partnerAgeAtMarriage, "partnerAgeAtMarriage");
  const relationshipTheme = requireText(parsed.relationshipTheme, "relationshipTheme");
  const compatibilitySummary = requireText(parsed.compatibilitySummary, "compatibilitySummary");
  const marriageOutlook = requireText(parsed.marriageOutlook, "marriageOutlook");
  const guidance = requireText(parsed.guidance, "guidance");

  if (strengths.length === 0) {
    throw new Error("Missing required future partner report field: strengths");
  }

  if (growthAreas.length === 0) {
    throw new Error("Missing required future partner report field: growthAreas");
  }

  return {
    partnerName,
    marriageYear,
    partnerAgeAtMarriage,
    relationshipTheme,
    compatibilityScore,
    compatibilitySummary,
    marriageOutlook,
    strengths: strengths.slice(0, 4),
    growthAreas: growthAreas.slice(0, 4),
    guidance,
  };
}

function firstKnownValue(values: unknown[]): string {
  for (const value of values) {
    const normalized = toPlainSign(value);
    if (normalized !== "—") return normalized;
  }
  return "—";
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pickFromHash<T>(items: T[], hash: number, salt: number): T {
  return items[(hash + salt) % items.length];
}

function parseBirthYear(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(String(value || "").trim());
    if (Number.isFinite(parsed) && parsed >= 1940 && parsed <= 2010) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function buildAnswersSummary(answers: Record<string, any> | null | undefined): string {
  if (!answers || typeof answers !== "object") return "not specified";

  const entries = Object.entries(answers)
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key.replace(/^future-partner-/, "")}: ${String(value).trim()}`);

  return entries.length ? entries.join("; ") : "not specified";
}

function buildFuturePartnerAnchors({
  user,
  userProfile,
  chartData,
  answers,
}: {
  user: Record<string, any>;
  userProfile: Record<string, any> | null;
  chartData: Record<string, any> | null;
  answers: Record<string, any> | null;
}): FuturePartnerAnchors {
  const seedParts = [
    user?.id,
    user?.email,
    user?.birth_day,
    user?.birth_month,
    user?.birth_year,
    user?.birth_hour,
    user?.birth_minute,
    user?.birth_place,
    userProfile?.birth_day,
    userProfile?.birth_month,
    userProfile?.birth_year,
    userProfile?.birth_hour,
    userProfile?.birth_minute,
    userProfile?.birth_place,
    chartData?.sun_sign,
    chartData?.moon_sign,
    chartData?.lagna,
    chartData?.ascendant,
    JSON.stringify(answers || {}),
  ]
    .map((value) => toPlainSign(value))
    .join("|");

  const seedHash = hashString(seedParts);
  const initialLetters = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "P",
    "R",
    "S",
    "T",
    "V",
    "Y",
  ];

  const birthYear = parseBirthYear(user?.birth_year, userProfile?.birth_year, chartData?.birth_year);
  const currentYear = new Date().getFullYear();
  const targetMarriageAge = 24 + (seedHash % 10);
  let marriageYear = birthYear ? birthYear + targetMarriageAge : currentYear + 1 + (seedHash % 8);

  if (marriageYear <= currentYear) {
    marriageYear = currentYear + 1 + ((seedHash >>> 5) % 7);
  }

  const userAgeAtMarriage = birthYear ? Math.max(21, marriageYear - birthYear) : 27 + ((seedHash >>> 8) % 7);
  const partnerAgeOffset = ((seedHash >>> 11) % 7) - 3;
  const partnerAgeAtMarriage = Math.max(21, Math.min(42, userAgeAtMarriage + partnerAgeOffset));

  const compatibilityScore = 66 + ((seedHash >>> 14) % 25);

  return {
    partnerName: `${pickFromHash(initialLetters, seedHash, 3)}.`,
    marriageYear: String(marriageYear),
    partnerAgeAtMarriage: String(partnerAgeAtMarriage),
    compatibilityScore,
    variationSeed: seedHash.toString(36),
  };
}

export async function generateFuturePartnerReport({
  user,
  userProfile,
  chartData,
  answers,
}: {
  user: Record<string, any>;
  userProfile: Record<string, any> | null;
  chartData: Record<string, any> | null;
  answers?: Record<string, any> | null;
}): Promise<FuturePartnerReportData> {
  const name = String(user?.name || userProfile?.name || "friend").trim() || "friend";

  const sunSign = firstKnownValue([chartData?.sun_sign, user?.sun_sign, userProfile?.sun_sign]);

  const moonSign = firstKnownValue([chartData?.moon_sign, user?.moon_sign, userProfile?.moon_sign]);

  const ascendant = firstKnownValue([
    chartData?.lagna,
    chartData?.ascendant,
    user?.ascendant_sign,
    userProfile?.ascendant_sign,
  ]);

  const birthYear = String(
    user?.birth_year ||
      userProfile?.birth_year ||
      chartData?.birth_year ||
      "—"
  ).trim();

  const relationshipStatus =
    String(user?.relationship_status || userProfile?.relationship_status || "").trim() || "not specified";

  const userGender = String(user?.gender || userProfile?.gender || "").trim() || "not specified";
  const anchors = buildFuturePartnerAnchors({
    user,
    userProfile,
    chartData,
    answers: answers || null,
  });
  const answerSummary = buildAnswersSummary(answers || null);

  const prompt = `You are an experienced Vedic astrologer for an Indian audience.

Generate one concise, realistic marriage prediction as JSON only.

User details:
- Name: ${name}
- Gender: ${userGender}
- Relationship status: ${relationshipStatus}
- Birth year: ${birthYear}
- Sun sign: ${sunSign}
- Moon sign: ${moonSign}
- Ascendant: ${ascendant}
- Future partner preference answers: ${answerSummary}

Use these precomputed headline values exactly:
- partnerName: ${anchors.partnerName}
- marriageYear: ${anchors.marriageYear}
- partnerAgeAtMarriage: ${anchors.partnerAgeAtMarriage}
- compatibilityScore: ${anchors.compatibilityScore}

Strict requirements:
1. Return VALID JSON only. No markdown, no explanation.
2. Output keys exactly:
{
  "partnerName": "single uppercase initial only, formatted like A.",
  "marriageYear": "YYYY",
  "partnerAgeAtMarriage": "number",
  "relationshipTheme": "short phrase",
  "compatibilityScore": 0-100,
  "compatibilitySummary": "2-3 sentences",
  "marriageOutlook": "2-3 sentences",
  "strengths": ["point", "point", "point"],
  "growthAreas": ["point", "point"],
  "guidance": "2-3 sentences"
}
3. Use the precomputed headline values exactly. Do not change partnerName, marriageYear, partnerAgeAtMarriage, or compatibilityScore.
4. Keep tone warm and practical. This is an entertainment-style astrological insight.
5. Do not include uncertainty language like "cannot predict".
6. Make relationshipTheme, summaries, strengths, growthAreas, and guidance specific to the chart and preference answers.`;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= PARTNER_REPORT_MAX_RETRIES; attempt += 1) {
    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 900,
        system:
          "You are a precise JSON generator. Always output strict JSON with the requested keys and valid JSON syntax.",
        messages: [{ role: "user", content: prompt }],
      });

      const text = extractText(response);
      const parsed = parseReportJson(text);
      return {
        ...parsed,
        partnerName: anchors.partnerName,
        marriageYear: anchors.marriageYear,
        partnerAgeAtMarriage: anchors.partnerAgeAtMarriage,
        compatibilityScore: anchors.compatibilityScore,
        reportVersion: FUTURE_PARTNER_REPORT_VERSION,
        variationSeed: anchors.variationSeed,
      };
    } catch (error) {
      lastError = error;

      if (!isOverloadedError(error) || attempt === PARTNER_REPORT_MAX_RETRIES) {
        throw error;
      }

      // Exponential-ish backoff for transient provider overload/rate-limit.
      const delayMs = attempt * 1500;
      await sleep(delayMs);
    }
  }

  throw lastError || new Error("Unable to generate future partner report");
}
