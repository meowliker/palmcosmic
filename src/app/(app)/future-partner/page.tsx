"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { ArrowLeft, Heart, Loader2, Sparkles, CalendarDays, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toMaskedPartnerInitial } from "@/lib/future-partner-format";
import { useUserStore } from "@/lib/user-store";
import type { FuturePartnerReportData } from "@/lib/future-partner-report";
import ReportDisclaimer from "@/components/ReportDisclaimer";

interface FuturePartnerStatusResponse {
  status: "not_started" | "pending" | "generating" | "complete" | "failed";
  report?: FuturePartnerReportData | null;
  generated_at?: string | null;
}

export default function FuturePartnerPage() {
  const router = useRouter();
  const { unlockedFeatures } = useUserStore();

  const [status, setStatus] = useState<FuturePartnerStatusResponse["status"]>("not_started");
  const [report, setReport] = useState<FuturePartnerReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");

  const fetchStatus = useCallback(
    async (uid: string) => {
      const response = await fetch(`/api/future-partner-report/status?userId=${encodeURIComponent(uid)}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to check report status right now.");
      }

      const json = (await response.json()) as FuturePartnerStatusResponse;
      setStatus(json.status);
      setReport(json.report || null);
      return json;
    },
    []
  );

  const generateReport = useCallback(
    async (uid: string) => {
      setError("");
      setIsGenerating(true);
      setStatus("generating");

      try {
        const response = await fetch(`/api/future-partner-report/generate?userId=${encodeURIComponent(uid)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.message || "Failed to generate report.");
        }

        const nextReport = (json?.report || null) as FuturePartnerReportData | null;
        setStatus("complete");
        setReport(nextReport);
      } catch (err: any) {
        setStatus("failed");
        setError(err?.message || "Unable to generate this report right now.");
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  useEffect(() => {
    const boot = async () => {
      try {
        setLoading(true);
        const localUserId = localStorage.getItem("astrorekha_user_id") || "";
        setUserId(localUserId);

        if (!localUserId) {
          setError("Please login again to continue.");
          return;
        }

        const currentStatus = await fetchStatus(localUserId);
        if (currentStatus.status !== "complete") {
          await generateReport(localUserId);
        }
      } catch (err: any) {
        setError(err?.message || "Unable to load this report.");
      } finally {
        setLoading(false);
      }
    };

    boot();
  }, [fetchStatus, generateReport]);

  if (!unlockedFeatures.futurePartnerReport) {
    return (
      <div className="min-h-screen bg-[#061525] px-4 py-5 text-white">
        <div className="mx-auto w-full max-w-md">
          <button
            onClick={() => router.push("/reports")}
            className="mb-4 inline-flex items-center gap-2 text-sm text-[#b8c7da] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Reports
          </button>

          <div className="rounded-3xl border border-[#173653] bg-[#0b2338] p-5 text-center shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#38bdf8]/25 bg-[#38bdf8]/10">
              <Heart className="h-7 w-7 text-[#38bdf8]" />
            </div>
            <h1 className="text-xl font-semibold text-white">Future Partner Report is locked</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#b8c7da]">
              Unlock it from Reports to access this prediction.
            </p>
            <Button
              onClick={() => router.push("/reports")}
              className="mt-5 h-12 w-full rounded-xl bg-[#38bdf8] font-semibold text-black hover:bg-[#7dd3fc]"
            >
              Back to Reports
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#061525] px-4 py-5 text-white">
      <div className="mx-auto w-full max-w-md">
        <button
          onClick={() => router.push("/reports")}
          className="mb-4 inline-flex items-center gap-2 text-sm text-[#b8c7da] transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Reports
        </button>

        <div className="rounded-3xl border border-[#173653] bg-[#0b2338] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl border border-[#38bdf8]/25 bg-[#38bdf8]/10 p-3">
              <Heart className="h-5 w-5 text-[#38bdf8]" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Future Partner Report</h1>
              <p className="text-xs leading-relaxed text-[#8fa3b8]">
                Entertainment-only cosmic prediction for your marriage journey
              </p>
            </div>
          </div>

          {loading || isGenerating ? (
            <div className="rounded-2xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 p-6 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#38bdf8]" />
              <p className="mt-3 text-[#d8e5f3]">Reading your chart for marriage timeline and partner clues...</p>
              <p className="mt-1 text-xs text-[#8fa3b8]">This usually takes around 10-20 seconds.</p>
            </div>
          ) : null}

          {!loading && !isGenerating && error ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-300">{error}</p>
              <Button
                onClick={() => userId && generateReport(userId)}
                className="mt-3 h-11 w-full rounded-xl bg-[#38bdf8] font-semibold text-black hover:bg-[#7dd3fc]"
              >
                Try Again
              </Button>
            </div>
          ) : null}

          {!loading && !isGenerating && report ? (
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="rounded-2xl border border-[#38bdf8]/25 bg-[#061525] p-4 shadow-[0_16px_38px_rgba(0,0,0,0.22)]">
                <p className="text-xs uppercase tracking-wide text-[#8fa3b8]">Predicted Partner Initial</p>
                <p className="mt-1 text-2xl font-bold text-white tracking-[0.18em]">
                  {toMaskedPartnerInitial(report.partnerName)}
                </p>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-[#173653] bg-[#0b2338] p-2">
                    <CalendarDays className="mx-auto h-4 w-4 text-[#7dd3fc]" />
                    <p className="mt-1 text-xs text-[#8fa3b8]">Marriage Year</p>
                    <p className="text-sm font-semibold text-white">{report.marriageYear}</p>
                  </div>
                  <div className="rounded-xl border border-[#173653] bg-[#0b2338] p-2">
                    <UserRound className="mx-auto h-4 w-4 text-[#7dd3fc]" />
                    <p className="mt-1 text-xs text-[#8fa3b8]">Partner Age</p>
                    <p className="text-sm font-semibold text-white">{report.partnerAgeAtMarriage}</p>
                  </div>
                  <div className="rounded-xl border border-[#173653] bg-[#0b2338] p-2">
                    <Sparkles className="mx-auto h-4 w-4 text-amber-300" />
                    <p className="mt-1 text-xs text-[#8fa3b8]">Compat.</p>
                    <p className="text-sm font-semibold text-white">{report.compatibilityScore}%</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#173653] bg-[#061525] p-4">
                <p className="text-xs uppercase tracking-wide text-[#8fa3b8]">Relationship Theme</p>
                <p className="mt-1 text-white">{report.relationshipTheme}</p>
              </div>

              <div className="rounded-2xl border border-[#173653] bg-[#061525] p-4">
                <p className="text-xs uppercase tracking-wide text-[#8fa3b8]">Marriage Outlook</p>
                <p className="mt-1 text-sm leading-relaxed text-[#d8e5f3]">{report.marriageOutlook}</p>
              </div>

              <div className="rounded-2xl border border-[#173653] bg-[#061525] p-4">
                <p className="text-xs uppercase tracking-wide text-[#8fa3b8]">Compatibility Summary</p>
                <p className="mt-1 text-sm leading-relaxed text-[#d8e5f3]">{report.compatibilitySummary}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-300">Strengths</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-emerald-100/90">
                    {report.strengths.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-amber-300">Growth Areas</p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-100/90">
                    {report.growthAreas.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-[#173653] bg-[#061525] p-4">
                <p className="text-xs uppercase tracking-wide text-[#8fa3b8]">Guidance</p>
                <p className="mt-1 text-sm leading-relaxed text-[#d8e5f3]">{report.guidance}</p>
              </div>

            </motion.div>
          ) : null}

          <ReportDisclaimer className="border-[#173653] bg-[#061525] text-[#8fa3b8]" />
        </div>
      </div>
    </div>
  );
}
