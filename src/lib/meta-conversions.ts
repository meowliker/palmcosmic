import crypto from "crypto";
import { NextRequest } from "next/server";

type MetaEventName = "Lead" | "InitiateCheckout" | "Purchase";

type MetaEventInput = {
  eventName: MetaEventName;
  eventId: string;
  request?: NextRequest;
  email?: string | null;
  userId?: string | null;
  value?: number | null;
  currency?: string;
  contentName?: string | null;
  contentIds?: string[];
  contentType?: string;
  customData?: Record<string, unknown>;
};

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

function getClientIp(request?: NextRequest): string | undefined {
  if (!request) return undefined;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || undefined;
}

function getEventSourceUrl(request?: NextRequest): string | undefined {
  if (!request) return undefined;
  const referer = request.headers.get("referer");
  return referer || request.url;
}

export async function sendMetaConversionEvent(input: MetaEventInput): Promise<void> {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN || process.env.META_ACCESS_TOKEN;

  if (!pixelId || !accessToken) {
    return;
  }

  const graphVersion = process.env.META_GRAPH_API_VERSION || "v21.0";
  const normalizedEmail = normalizeEmail(input.email);
  const userData: Record<string, unknown> = {};

  if (normalizedEmail) userData.em = [sha256(normalizedEmail)];
  if (input.userId) userData.external_id = [sha256(input.userId.trim())];

  const clientIp = getClientIp(input.request);
  const userAgent = input.request?.headers.get("user-agent") || undefined;
  const fbp = input.request?.cookies.get("_fbp")?.value;
  const fbc = input.request?.cookies.get("_fbc")?.value;

  if (clientIp) userData.client_ip_address = clientIp;
  if (userAgent) userData.client_user_agent = userAgent;
  if (fbp) userData.fbp = fbp;
  if (fbc) userData.fbc = fbc;

  const customData: Record<string, unknown> = {
    ...input.customData,
  };

  if (typeof input.value === "number") customData.value = input.value;
  if (input.currency) customData.currency = input.currency;
  if (input.contentName) customData.content_name = input.contentName;
  if (input.contentIds?.length) customData.content_ids = input.contentIds;
  if (input.contentType) customData.content_type = input.contentType;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: input.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: "website",
        event_source_url: getEventSourceUrl(input.request),
        user_data: userData,
        custom_data: customData,
      },
    ],
  };

  if (process.env.META_TEST_EVENT_CODE) {
    body.test_event_code = process.env.META_TEST_EVENT_CODE;
  }

  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.error("[Meta CAPI] Event failed", input.eventName, response.status, text);
    }
  } catch (error) {
    console.error("[Meta CAPI] Event request failed", input.eventName, error);
  }
}
