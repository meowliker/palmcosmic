import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import bcrypt from "bcryptjs";
import { reconcilePaidPaymentsForRegistration } from "@/lib/payment-fulfillment";

export async function POST(request: NextRequest) {
  try {
    const { email, password, anonId } = await request.json();

    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // A paid/demo visitor can already exist as an anonymous lead with this email.
    // If the row has no password yet, upgrade that same account instead of rejecting it.
    const { data: existingRows, error: checkError } = await supabase
      .from("users")
      .select("id,password_hash")
      .eq("email", normalizedEmail)
      .order("created_at", { ascending: false })
      .limit(1);

    if (checkError) {
      console.error("Error checking existing user:", checkError);
    }

    const existing = existingRows?.[0] || null;

    if (existing?.password_hash) {
      return NextResponse.json(
        { success: false, error: "auth/email-already-in-use", message: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Prefer preserving the paid/demo user ID so report links and entitlements stay attached.
    let uid = existing?.id || crypto.randomUUID();
    const now = new Date().toISOString();

    // If there's an anonymous user, migrate their data
    let migratedData: Record<string, any> = {};
    let hadAnonUser = false;

    if (anonId) {
      const { data: anonUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", anonId)
        .maybeSingle();

      if (anonUser) {
        hadAnonUser = true;
        if (!existing?.id) {
          uid = anonUser.id;
        }
        migratedData = {
          coins: anonUser.coins || 0,
          unlocked_features: anonUser.unlocked_features || {},
          onboarding_flow: anonUser.onboarding_flow,
          primary_flow: anonUser.primary_flow,
          primary_report: anonUser.primary_report,
          access_status: anonUser.access_status,
          subscription_status: anonUser.subscription_status,
          is_subscribed: anonUser.is_subscribed,
          purchase_type: anonUser.purchase_type,
          bundle_purchased: anonUser.bundle_purchased,
          payment_status: anonUser.payment_status,
          stripe_customer_id: anonUser.stripe_customer_id,
          stripe_subscription_id: anonUser.stripe_subscription_id,
          trial_started_at: anonUser.trial_started_at,
          trial_ends_at: anonUser.trial_ends_at,
          subscription_current_period_end: anonUser.subscription_current_period_end,
          subscription_cancel_at_period_end: anonUser.subscription_cancel_at_period_end,
          subscription_locked_at: anonUser.subscription_locked_at,
          subscription_lock_reason: anonUser.subscription_lock_reason,
          subscription_plan: anonUser.subscription_plan,
          palm_reading_report_id: anonUser.palm_reading_report_id,
          birth_chart_report_id: anonUser.birth_chart_report_id,
          soulmate_sketch_report_id: anonUser.soulmate_sketch_report_id,
          future_partner_report_id: anonUser.future_partner_report_id,
          prediction_2026_report_id: anonUser.prediction_2026_report_id,
          compatibility_report_id: anonUser.compatibility_report_id,
          scans_used: anonUser.scans_used,
          scans_allowed: anonUser.scans_allowed,
          birth_chart_timer_active: anonUser.birth_chart_timer_active,
          birth_chart_timer_started_at: anonUser.birth_chart_timer_started_at,
        };
      }

      // Migrate user_profiles
      const { data: anonProfile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("id", anonId)
        .maybeSingle();

      if (anonProfile) {
        await supabase
          .from("user_profiles")
          .upsert({ ...anonProfile, id: uid, email: normalizedEmail, updated_at: now }, { onConflict: "id" });
      }
    }

    // Create user record
    const userData: Record<string, any> = {
      id: uid,
      email: normalizedEmail,
      password_hash: passwordHash,
      created_at: existing?.id ? undefined : now,
      updated_at: now,
      ...migratedData,
    };

    // Remove null/undefined values
    Object.keys(userData).forEach(key => {
      if (userData[key] === null || userData[key] === undefined) {
        delete userData[key];
      }
    });

    const { error: insertError } = await supabase.from("users").upsert(userData, { onConflict: "id" });

    if (insertError) {
      console.error("Failed to create user:", insertError);
      return NextResponse.json(
        { success: false, error: "Failed to create account" },
        { status: 500 }
      );
    }

    const reconciliation = await reconcilePaidPaymentsForRegistration({
      userId: uid,
      email: normalizedEmail,
      anonId: anonId || null,
      skipAnonEntitlementReplay: hadAnonUser,
    });

    // Migrate related tables in background (non-blocking for faster registration)
    if (anonId && anonId !== uid) {
      (async () => {
        try {
          await Promise.all([
            supabase.from("payments").update({ user_id: uid }).eq("user_id", anonId),
            supabase.from("palm_readings").update({ id: uid }).eq("id", anonId),
            supabase.from("chat_messages").update({ user_id: uid }).eq("user_id", anonId),
            supabase.from("daily_insights").update({ id: uid }).eq("id", anonId),
            supabase.from("user_entitlements").update({ user_id: uid }).eq("user_id", anonId),
            supabase.from("onboarding_sessions").update({ user_id: uid }).eq("user_id", anonId),
            supabase.from("leads").update({ user_id: uid }).eq("user_id", anonId),
            supabase.from("soulmate_sketches").update({ user_id: uid }).eq("user_id", anonId),
            supabase.from("future_partner_reports").update({ user_id: uid }).eq("user_id", anonId),
            supabase.from("birth_chart_reports").update({ user_id: uid }).eq("user_id", anonId),
          ]);
          await supabase.from("user_profiles").delete().eq("id", anonId);
          await supabase.from("users").delete().eq("id", anonId);
        } catch (err) {
          console.error("Background migration error:", err);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      user: {
        id: uid,
        email: normalizedEmail,
        coins: migratedData.coins || 0,
        onboardingFlow: migratedData.onboarding_flow || null,
        purchaseType: migratedData.purchase_type || null,
        bundlePurchased: migratedData.bundle_purchased || null,
        unlockedFeatures: migratedData.unlocked_features || {},
        paymentReconciliation: reconciliation,
      },
    });
  } catch (error: any) {
    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to register" },
      { status: 500 }
    );
  }
}
