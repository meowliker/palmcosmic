import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const PALM_READING_PROMPT = `You are an expert palm reader and mystic with decades of experience analyzing palms. Analyze this palm image and provide a comprehensive reading.

User's birth date: {birthDate}
User's zodiac sign: {zodiacSign}

IMPORTANT: You must respond with ONLY valid JSON, no markdown, no code fences, just pure JSON.

Analyze the palm and return this exact JSON structure:
{
  "cosmicInsight": "A 3-4 sentence personalized cosmic insight connecting their palm lines to their zodiac sign and life path. Make it mystical and meaningful.",
  "tabs": {
    "ageTimeline": {
      "title": "Life Timeline Predictions",
      "stages": [
        {"range": "0-20", "label": "Foundation Years", "description": "Description of this life phase based on palm lines"},
        {"range": "21-35", "label": "Growth Period", "description": "Description of this life phase"},
        {"range": "36-50", "label": "Peak Years", "description": "Description of this life phase"},
        {"range": "51-70", "label": "Wisdom Era", "description": "Description of this life phase"},
        {"range": "71+", "label": "Golden Years", "description": "Description of this life phase"}
      ],
      "milestones": {
        "wealthPeaks": "Ages when financial success is indicated",
        "healthEvents": "Health considerations at certain ages",
        "lifeLineAges": "Key ages marked on the life line",
        "careerMilestones": "Career peak ages",
        "relationshipTiming": "Relationship milestones timing"
      }
    },
    "wealth": {
      "title": "Wealth & Financial Analysis",
      "financialPotential": {"level": "High/Medium/Low", "details": "Detailed analysis"},
      "businessAptitude": "Business and entrepreneurship potential",
      "wealthTimeline": "When wealth is likely to accumulate",
      "assetAccumulation": "Types of assets indicated",
      "moneyManagementStyle": "How they handle money"
    },
    "mounts": {
      "title": "Palm Mounts Analysis",
      "mounts": [
        {"name": "Mount of Jupiter", "description": "Analysis of this mount"},
        {"name": "Mount of Saturn", "description": "Analysis"},
        {"name": "Mount of Apollo", "description": "Analysis"},
        {"name": "Mount of Mercury", "description": "Analysis"},
        {"name": "Mount of Venus", "description": "Analysis"},
        {"name": "Mount of Moon", "description": "Analysis"}
      ],
      "specialMarkings": {
        "travelLines": "Travel line analysis",
        "marriageLines": "Marriage line analysis",
        "healthIndicators": "Health markings",
        "headFateIntersection": "Where head and fate lines meet",
        "lifeHeartIntersection": "Where life and heart lines interact"
      }
    },
    "love": {
      "title": "Love & Partnership Predictions",
      "partnerCharacteristics": "Ideal partner traits indicated",
      "marriageTiming": "When marriage is indicated",
      "partnersFinancialStatus": "Partner's financial prospects",
      "relationshipChallenges": "Potential challenges to overcome",
      "familyPredictions": "Family and children indications"
    }
  },
  "meta": {
    "confidence": 0.85,
    "palmQuality": "good/fair/excellent",
    "dominantHand": "right/left/unknown"
  }
}

If the image is NOT a palm or hand, respond with:
{
  "cosmicInsight": null,
  "tabs": null,
  "meta": {
    "errorMessage": "NOT_A_PALM: Please upload a clear photo of your palm. The image provided does not appear to be a human hand."
  }
}

Be specific, personalized, and mystical in your readings. Connect insights to the user's zodiac sign when relevant.`;

function stripDataUrl(imageData: string) {
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
  const mediaType = imageData.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

  return {
    base64Data,
    mediaType: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
  };
}

function promptForUser(birthDate?: string | null, zodiacSign?: string | null) {
  return PALM_READING_PROMPT
    .replace("{birthDate}", birthDate || "Not provided")
    .replace("{zodiacSign}", zodiacSign || "Unknown");
}

export async function analyzePalmImage(params: {
  imageData: string;
  birthDate?: string | null;
  zodiacSign?: string | null;
}) {
  const { base64Data, mediaType } = stripDataUrl(params.imageData);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: "text",
            text: promptForUser(params.birthDate, params.zodiacSign),
          },
        ],
      },
    ],
  });

  const textContent = response.content.find((content) => content.type === "text");
  if (!textContent || textContent.type !== "text") {
    throw new Error("No response from AI");
  }

  let jsonText = textContent.text.trim();
  jsonText = jsonText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(jsonText);
  } catch {
    console.error("Failed to parse palm reading AI response:", textContent.text);
    throw new Error("Failed to parse reading");
  }
}

export async function generatePalmReadingForUser(userId: string) {
  const cleanUserId = userId.trim();
  if (!cleanUserId) {
    return { generated: false, reason: "missing_user_id" };
  }

  const supabase = getSupabaseAdmin();

  const { data: existingReading, error: existingError } = await supabase
    .from("palm_readings")
    .select("id,reading,palm_image_url,birth_date,zodiac_sign")
    .eq("id", cleanUserId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existingReading?.reading?.tabs) {
    return { generated: false, reason: "already_generated", reading: existingReading.reading };
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("palm_image,palm_image_url,birth_month,birth_day,birth_year,zodiac_sign")
    .eq("id", cleanUserId)
    .maybeSingle();

  if (profileError) throw profileError;

  const imageData = existingReading?.palm_image_url || profile?.palm_image || profile?.palm_image_url;
  if (!imageData) {
    return { generated: false, reason: "missing_palm_image" };
  }

  const birthDate =
    existingReading?.birth_date ||
    (profile?.birth_year && profile?.birth_month && profile?.birth_day
      ? `${profile.birth_year}-${profile.birth_month}-${profile.birth_day}`
      : null);
  const zodiacSign = existingReading?.zodiac_sign || profile?.zodiac_sign || null;

  const reading = await analyzePalmImage({
    imageData,
    birthDate,
    zodiacSign,
  });
  const nowIso = new Date().toISOString();

  const { error: upsertError } = await supabase.from("palm_readings").upsert({
    id: cleanUserId,
    reading,
    palm_image_url: imageData,
    birth_date: birthDate,
    zodiac_sign: zodiacSign,
    created_at: nowIso,
  }, { onConflict: "id" });

  if (upsertError) throw upsertError;

  const { error: profileUpdateError } = await supabase
    .from("user_profiles")
    .upsert({
      id: cleanUserId,
      palm_image: imageData,
      palm_image_url: imageData,
      palm_reading_result: reading,
      palm_reading_date: nowIso,
      updated_at: nowIso,
    }, { onConflict: "id" });

  if (profileUpdateError) throw profileUpdateError;

  return { generated: true, reading };
}
