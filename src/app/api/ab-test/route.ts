import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { DEFAULT_LAYOUT_B_CONFIG, normalizeLayoutBConfig } from "@/lib/layout-b-funnel";
import {
  PAYWALL_PRICING_EXPERIMENT,
  PAYWALL_PRICE_VARIANTS,
} from "@/lib/paywall-pricing-experiment";

// A/B Test configuration API
// Handles getting assigned variant for a user and managing test configs
const SETTINGS_KEY = "funnel_layout_b_config";
const AB_TESTS_LIVE = false;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function getNormalizedVariants(testData: any, isOnboardingLayoutTest: boolean) {
  const isPalmReadyTest = String(testData?.id || "").startsWith("palm-reading-ready");
  const isPaywallPricingTest = String(testData?.id || "") === PAYWALL_PRICING_EXPERIMENT;
  const defaults = isPalmReadyTest
    ? { pageA: "ready-classic", pageB: "ready-scan" }
    : isPaywallPricingTest
    ? { pageA: PAYWALL_PRICE_VARIANTS[0], pageB: PAYWALL_PRICE_VARIANTS[1] }
    : isOnboardingLayoutTest
    ? { pageA: "bundle-pricing", pageB: "bundle-pricing-b" }
    : { pageA: "step-17", pageB: "a-step-17" };

  const configA = Number(testData?.variants?.A?.weight);
  const configB = Number(testData?.variants?.B?.weight);
  let aWeight = Number.isFinite(configA) ? clampPercent(configA) : NaN;
  let bWeight = Number.isFinite(configB) ? clampPercent(configB) : NaN;

  if (!Number.isFinite(aWeight) || !Number.isFinite(bWeight) || aWeight + bWeight !== 100) {
    const rawSplit = Number(testData?.traffic_split);
    if (Number.isFinite(rawSplit)) {
      const b = rawSplit <= 1 ? rawSplit * 100 : rawSplit;
      bWeight = clampPercent(b);
      aWeight = 100 - bWeight;
    } else {
      aWeight = 50;
      bWeight = 50;
    }
  }

  return {
    A: { weight: aWeight, page: testData?.variants?.A?.page || defaults.pageA },
    B: { weight: bWeight, page: testData?.variants?.B?.page || defaults.pageB },
  };
}

async function resolveDefaultTestId(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();

  return normalizeLayoutBConfig(data?.value).testId || DEFAULT_LAYOUT_B_CONFIG.testId;
}

async function persistUserFlowVariant(params: {
  supabase: ReturnType<typeof getSupabaseAdmin>;
  userId: string | null;
  variant: string;
  isOnboardingLayoutTest: boolean;
}) {
  const { supabase, userId, variant, isOnboardingLayoutTest } = params;
  if (!userId) return;

  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    id: userId,
    ab_variant: variant,
    updated_at: nowIso,
  };

  if (isOnboardingLayoutTest) {
    payload.onboarding_flow = variant === "B" ? "flow-b" : "flow-a";
  }

  const { error } = await supabase.from("users").upsert(payload, { onConflict: "id" });
  if (error) {
    console.error("[ab-test] failed to persist user variant", {
      userId,
      variant,
      isOnboardingLayoutTest,
      error,
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTestId = searchParams.get("testId");
    const visitorId = searchParams.get("visitorId");
    const userIdFromQuery = searchParams.get("userId")?.trim() || null;

    const supabase = getSupabaseAdmin();
    const testId = requestedTestId || await resolveDefaultTestId(supabase);
    const isOnboardingLayoutTest = testId.startsWith("onboarding-layout");
    const isPalmReadyTest = testId.startsWith("palm-reading-ready");
    const isPaywallPricingTest = testId === PAYWALL_PRICING_EXPERIMENT;

    if (isPalmReadyTest) {
      return NextResponse.json({
        testId,
        variant: "B",
        page: "ready-scan",
        test: {
          id: testId,
          name: "Palm Reading Ready Scan A/B (retired)",
          status: "closed",
          traffic_split: 1,
          variants: {
            A: { weight: 0, page: "ready-classic" },
            B: { weight: 100, page: "ready-scan" },
          },
        },
        message: "Palm ready A/B test is retired; defaulting to scan page",
      });
    }

    if (!AB_TESTS_LIVE) {
      const disabledVariant = isPaywallPricingTest ? "B" : "A";
      const disabledPage = isPaywallPricingTest
        ? PAYWALL_PRICE_VARIANTS[1]
        : isOnboardingLayoutTest
        ? "bundle-pricing"
        : "step-17";
      return NextResponse.json({
        testId,
        variant: disabledVariant,
        page: disabledPage,
        test: {
          id: testId,
          name: isPaywallPricingTest
            ? "Paywall Bundle Price A/B (closed)"
            : isOnboardingLayoutTest
            ? "Onboarding Layout A/B (closed)"
            : "Pricing Page A/B Test (closed)",
          status: "closed",
          traffic_split: isPaywallPricingTest ? 1 : 0,
          variants: isPaywallPricingTest
            ? {
                A: { weight: 0, page: PAYWALL_PRICE_VARIANTS[0] },
                B: { weight: 100, page: PAYWALL_PRICE_VARIANTS[1] },
              }
            : isOnboardingLayoutTest
            ? {
                A: { weight: 100, page: "bundle-pricing" },
                B: { weight: 0, page: "bundle-pricing-b" },
              }
            : {
                A: { weight: 100, page: "step-17" },
                B: { weight: 0, page: "a-step-17" },
              },
        },
        message: "A/B tests are closed; defaulting to the normal flow",
      });
    }

    const defaultTest = {
      id: testId,
      name: isPalmReadyTest
        ? "Palm Reading Ready Scan A/B"
        : isPaywallPricingTest
        ? "Paywall Bundle Price A/B"
        : isOnboardingLayoutTest
        ? "Onboarding Layout A/B (QA)"
        : "Pricing Page A/B Test",
      status: "active",
      traffic_split: 0.5,
      variants: isPalmReadyTest
        ? {
            A: { weight: 50, page: "ready-classic" },
            B: { weight: 50, page: "ready-scan" },
          }
        : isPaywallPricingTest
        ? {
            A: { weight: 50, page: PAYWALL_PRICE_VARIANTS[0] },
            B: { weight: 50, page: PAYWALL_PRICE_VARIANTS[1] },
          }
        : isOnboardingLayoutTest
        ? {
            A: { weight: 50, page: "bundle-pricing" },
            B: { weight: 50, page: "bundle-pricing-b" },
          }
        : {
            A: { weight: 50, page: "step-17" },
            B: { weight: 50, page: "a-step-17" },
          },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const defaultTestInsertRow = {
      id: testId,
      name: defaultTest.name,
      status: defaultTest.status,
      traffic_split: defaultTest.traffic_split,
      created_at: defaultTest.created_at,
      updated_at: defaultTest.updated_at,
    };

    const pageForVariant = (variant: string, test: any): string => {
      const configured = test?.variants?.[variant]?.page;
      if (configured && typeof configured === "string") {
        return configured;
      }
      if (isPaywallPricingTest) {
        return variant === "A" ? PAYWALL_PRICE_VARIANTS[0] : PAYWALL_PRICE_VARIANTS[1];
      }
      if (isOnboardingLayoutTest) {
        return variant === "A" ? "bundle-pricing" : "bundle-pricing-b";
      }
      if (isPalmReadyTest) {
        return variant === "A" ? "ready-classic" : "ready-scan";
      }
      return variant === "A" ? "step-17" : "a-step-17";
    };

    // Get test configuration
    const { data: testData, error: testDataError } = await supabase
      .from("ab_tests")
      .select("*")
      .eq("id", testId)
      .single();
    if (testDataError && testDataError.code !== "PGRST116") {
      console.error("[ab-test] failed to fetch test config", { testId, error: testDataError });
    }
    
    if (!testData) {
      // Create default test if it doesn't exist
      const { error: insertDefaultTestError } = await supabase.from("ab_tests").insert(defaultTestInsertRow);
      if (insertDefaultTestError) {
        console.error("[ab-test] failed to create default test", {
          testId,
          error: insertDefaultTestError,
        });
      }
      
      const variant = isPaywallPricingTest ? "B" : "A";
      
      return NextResponse.json({
        testId,
        variant,
        page: pageForVariant(variant, defaultTest),
        test: defaultTest,
      });
    }

    // Check if test is active
    if (testData.status !== "active") {
      return NextResponse.json({
        testId,
        variant: "A",
        page: pageForVariant("A", testData),
        test: testData,
        message: "Test is not active, defaulting to variant A",
      });
    }

    const variants = getNormalizedVariants(testData, isOnboardingLayoutTest);

    // Check if visitor already has an assigned variant
    if (visitorId) {
      const { data: assignment, error: assignmentLookupError } = await supabase
        .from("ab_test_assignments")
        .select("variant")
        .eq("id", `${testId}_${visitorId}`)
        .maybeSingle();
      if (assignmentLookupError && assignmentLookupError.code !== "PGRST116") {
        console.error("[ab-test] failed to read assignment", {
          testId,
          visitorId,
          error: assignmentLookupError,
        });
      }
      
      if (assignment) {
        const assignedVariant = String(assignment.variant || "A");
        const assignedWeight = Number((variants as Record<string, { weight: number }>)[assignedVariant]?.weight || 0);
        if (assignedWeight <= 0) {
          await supabase
            .from("ab_test_assignments")
            .delete()
            .eq("id", `${testId}_${visitorId}`);
        } else {
          await persistUserFlowVariant({
            supabase,
            userId: userIdFromQuery || visitorId,
            variant: assignedVariant,
            isOnboardingLayoutTest,
          });

          return NextResponse.json({
            testId,
            variant: assignedVariant,
            page: pageForVariant(assignedVariant, { ...testData, variants }),
            test: { ...testData, variants },
            cached: true,
          });
        }
      }
    }

    // Assign variant based on weights
    const totalWeight = Object.values(variants).reduce(
      (sum: number, v: any) => sum + (v.weight || 0),
      0
    );
    
    let random = Math.random() * totalWeight;
    let assignedVariant = "A";
    
    for (const [key, value] of Object.entries(variants)) {
      random -= (value as any).weight || 0;
      if (random <= 0) {
        assignedVariant = key;
        break;
      }
    }

    // Save assignment if visitor ID provided
    if (visitorId) {
      const assignmentPayload = {
        id: `${testId}_${visitorId}`,
        test_id: testId,
        visitor_id: visitorId,
        variant: assignedVariant,
        created_at: new Date().toISOString(),
      };
      const { error: assignmentUpsertError } = await supabase
        .from("ab_test_assignments")
        .upsert(assignmentPayload, { onConflict: "id" });
      if (assignmentUpsertError) {
        console.error("[ab-test] failed to persist assignment", {
          testId,
          visitorId,
          variant: assignedVariant,
          error: assignmentUpsertError,
        });
      }
    }

    await persistUserFlowVariant({
      supabase,
      userId: userIdFromQuery || visitorId,
      variant: assignedVariant,
      isOnboardingLayoutTest,
    });

    return NextResponse.json({
      testId,
      variant: assignedVariant,
      page: pageForVariant(assignedVariant, { ...testData, variants }),
      test: { ...testData, variants },
    });
  } catch (error) {
    console.error("A/B test error:", error);
    return NextResponse.json({
      testId: DEFAULT_LAYOUT_B_CONFIG.testId,
      variant: "A",
      page: "bundle-pricing",
      error: "Failed to get A/B test assignment",
    });
  }
}

// Update test configuration (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testId, variants, status, name } = body;

    if (!testId) {
      return NextResponse.json({ error: "testId is required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    let nextTrafficSplit: number | null = null;
    if (variants) {
      const totalWeight = Object.values(variants).reduce(
        (sum: number, v: any) => sum + (v.weight || 0),
        0
      );
      
      if (totalWeight !== 100) {
        return NextResponse.json(
          { error: "Variant weights must sum to 100" },
          { status: 400 }
        );
      }
      const bWeight = clampPercent(Number((variants as any)?.B?.weight ?? 50));
      nextTrafficSplit = bWeight / 100;
    }

    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (nextTrafficSplit !== null) updateData.traffic_split = nextTrafficSplit;
    if (status) updateData.status = status;
    if (name) updateData.name = name;

    await supabase.from("ab_tests").upsert({ id: testId, ...updateData }, { onConflict: "id" });

    const { data: updatedTest } = await supabase.from("ab_tests").select("*").eq("id", testId).single();

    return NextResponse.json({
      success: true,
      test: updatedTest,
    });
  } catch (error) {
    console.error("A/B test update error:", error);
    return NextResponse.json(
      { error: "Failed to update A/B test" },
      { status: 500 }
    );
  }
}
