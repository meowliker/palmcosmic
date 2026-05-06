import { NextRequest, NextResponse } from "next/server";
import { getStripeClient } from "@/lib/stripe";
import { getPricing, getBundleById, getCoinPackageById, getReportById, getUpsellById } from "@/lib/pricing";
import { markStripePaymentStatus } from "@/lib/payment-fulfillment";
import { sendMetaConversionEvent } from "@/lib/meta-conversions";
import {
  PAYWALL_PRICING_EXPERIMENT,
  applyPaywallPriceVariant,
  isPaywallPriceVariant,
} from "@/lib/paywall-pricing-experiment";

const OFFER_ID_TO_FEATURE: Record<string, string> = {
  "2026-predictions": "prediction2026",
  "birth-chart": "birthChart",
  compatibility: "compatibilityTest",
};

function normalizeRelativePath(path: string | undefined, fallback: string): string {
  const safe = path && path.startsWith("/") ? path : fallback;
  return safe || fallback;
}

function appendQuery(path: string, query: Record<string, string>): string {
  const [pathname, existingQuery] = path.split("?");
  const params = new URLSearchParams(existingQuery || "");
  Object.entries(query).forEach(([k, v]) => params.set(k, v));
  return `${pathname}?${params.toString()}`;
}

function normalizeEmail(email: string | undefined): string {
  return (email || "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      type,
      bundleId,
      packageId,
      userId,
      email,
      firstName,
      successPath,
      cancelPath,
      offerIds,
      pricingExperiment,
      pricingVariant,
    } = body as {
      type: "bundle" | "upsell" | "coins" | "report";
      bundleId?: string;
      packageId?: string;
      userId?: string;
      email?: string;
      firstName?: string;
      successPath?: string;
      cancelPath?: string;
      offerIds?: string;
      pricingExperiment?: string;
      pricingVariant?: string;
    };

    if (!type) {
      return NextResponse.json({ error: "Purchase type is required" }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(email);
    const pricing = await getPricing();

    let amount = 0;
    let productName = "PalmCosmic Purchase";
    const metadata: Record<string, string> = {
      type,
      userId: userId || "",
      firstName: firstName || "Customer",
    };

    if (type === "bundle") {
      const baseBundle = getBundleById(pricing, bundleId || "");
      if (!baseBundle) return NextResponse.json({ error: "Invalid bundle" }, { status: 400 });
      const activePricingVariant = isPaywallPriceVariant(pricingVariant)
        ? pricingVariant
        : "control_29_49_89";
      const bundle = applyPaywallPriceVariant([baseBundle], activePricingVariant)[0];
      amount = bundle.price;
      productName = bundle.name;
      metadata.bundleId = bundle.id;
      metadata.features = bundle.features.join(",");
      metadata.pricingExperiment = pricingExperiment || PAYWALL_PRICING_EXPERIMENT;
      metadata.pricingVariant = activePricingVariant;
      metadata.bundlePriceCents = String(bundle.price);
      metadata.controlBundlePriceCents = String(baseBundle.price);
    }

    if (type === "report") {
      const report = getReportById(pricing, packageId || "");
      if (!report) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
      amount = report.price;
      productName = report.name;
      metadata.packageId = report.id;
      metadata.feature = report.feature;
      metadata.features = report.feature;
      metadata.reportPriceCents = String(report.price);
    }

    if (type === "coins") {
      const coinPkg = getCoinPackageById(pricing, packageId || "");
      if (!coinPkg) return NextResponse.json({ error: "Invalid coin package" }, { status: 400 });
      amount = coinPkg.price;
      productName = `${coinPkg.coins} Coins`;
      metadata.packageId = coinPkg.id;
      metadata.coins = String(coinPkg.coins);
    }

    if (type === "upsell") {
      // Special onboarding multi-offer handling.
      if ((bundleId || "") === "ultra-pack") {
        amount = 2400;
        productName = "Ultra Pack 3 in 1";
        metadata.bundleId = "ultra-pack";
        metadata.features = "prediction2026,birthChart,compatibilityTest";
      } else if ((bundleId || "").includes(",")) {
        const ids = (bundleId || "").split(",").map((v) => v.trim()).filter(Boolean);
        const features = ids.map((id) => OFFER_ID_TO_FEATURE[id]).filter(Boolean);
        const selectedUpsells = ids
          .map((id) => getUpsellById(pricing, id))
          .filter((upsell): upsell is NonNullable<ReturnType<typeof getUpsellById>> => Boolean(upsell));
        if (selectedUpsells.length !== ids.length) {
          return NextResponse.json({ error: "Invalid upsell selection" }, { status: 400 });
        }
        amount = selectedUpsells.reduce((sum, upsell) => sum + upsell.price, 0);
        productName = selectedUpsells.map((upsell) => upsell.name).join(" + ") || "Custom Upsell Pack";
        metadata.bundleId = bundleId || "";
        metadata.offerIds = ids.join(",");
        metadata.features = features.join(",");
      } else {
        const upsell = getUpsellById(pricing, (bundleId || packageId || "").trim());
        if (!upsell) return NextResponse.json({ error: "Invalid upsell" }, { status: 400 });
        amount = upsell.price;
        productName = upsell.name;
        metadata.bundleId = upsell.id;
        metadata.feature = upsell.feature;
        metadata.features = upsell.feature;
      }

      if (offerIds && !metadata.offerIds) {
        metadata.offerIds = offerIds;
      }
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const requestOrigin = request.nextUrl.origin;
    const appUrl = requestOrigin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const safeSuccessPath = normalizeRelativePath(successPath, "/");
    const safeCancelPath = normalizeRelativePath(cancelPath, "/");

    const successRedirectPath = appendQuery(safeSuccessPath, {
      payment: "success",
    });
    const cancelRedirectPath = appendQuery(safeCancelPath, {
      cancelled: "true",
    });

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      customer_email: normalizedEmail || undefined,
      success_url: `${appUrl}/api/stripe/success?session_id={CHECKOUT_SESSION_ID}&next=${encodeURIComponent(successRedirectPath)}`,
      cancel_url: `${appUrl}${cancelRedirectPath}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: amount,
            product_data: {
              name: productName,
              description: `PalmCosmic ${type} purchase`,
            },
          },
        },
      ],
      metadata,
    });

    await markStripePaymentStatus({
      stripeSessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id || null,
      stripeCustomerId:
        typeof session.customer === "string" ? session.customer : session.customer?.id || null,
      customerEmail: normalizedEmail || session.customer_email || null,
      metadata,
      amount: amount,
      currency: "USD",
      paymentStatus: "created",
    });

    await sendMetaConversionEvent({
      eventName: "InitiateCheckout",
      eventId: `initiate_checkout_${session.id}`,
      request,
      email: normalizedEmail || null,
      userId: userId || null,
      value: amount / 100,
      currency: "USD",
      contentName: productName,
      contentIds: [metadata.bundleId || metadata.packageId || metadata.feature || type],
      contentType: "product",
      customData: {
        payment_provider: "stripe",
        purchase_type: type,
        stripe_session_id: session.id,
      },
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      metaEventId: `initiate_checkout_${session.id}`,
      url: session.url,
      amount,
      currency: "USD",
      productName,
    });
  } catch (error) {
    console.error("Stripe checkout create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Stripe checkout" },
      { status: 500 }
    );
  }
}
