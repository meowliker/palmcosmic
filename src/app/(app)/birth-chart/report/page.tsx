"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import ReportLoadingState from "@/components/ReportLoadingState";
import ReportViewer from "@/components/ReportViewer";

interface ReportRow {
  id: string;
  status: "pending" | "generating" | "complete" | "failed";
  sections: Record<string, string>;
  generated_at?: string;
  chart_details?: {
    basic_details?: Array<{ label: string; value: string }>;
    astro_details?: Array<{ label: string; value: string }>;
    planetary_positions?: Array<{
      planet: string;
      sign: string;
      house: string;
      nakshatra: string;
      pada: string;
    }>;
    planetary_columns?: Array<"sign" | "house" | "nakshatra" | "pada">;
    lagna_chart_svg?: string | null;
    navamsa_chart_svg?: string | null;
  };
}

type ScreenState = "loading" | "ready" | "needs_birth_chart" | "needs_birth_time" | "setup_required" | "error";

function getUserId(): string {
  if (typeof window === "undefined") return "";
  return (
    localStorage.getItem("astrorekha_user_id") ||
    localStorage.getItem("palmcosmic_user_id") ||
    localStorage.getItem("astrorekha_anon_id") ||
    localStorage.getItem("palmcosmic_anon_id") ||
    ""
  );
}

export default function BirthChartReportPage() {
  const router = useRouter();

  const [screenState, setScreenState] = useState<ScreenState>("loading");
  const [report, setReport] = useState<ReportRow | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const isFetchingRef = useRef(false);

  const userId = useMemo(() => getUserId(), []);

  const getRequestHeaders = useCallback(() => ({
    "Content-Type": "application/json",
    ...(userId ? { "x-user-id": userId } : {}),
  }), [userId]);

  const fetchFullReport = useCallback(async (reportId: string): Promise<ReportRow | null> => {
    const reportUrl = userId
      ? `/api/birth-chart-report/${reportId}?userId=${encodeURIComponent(userId)}`
      : `/api/birth-chart-report/${reportId}`;

    const response = await fetch(reportUrl, {
      method: "GET",
      headers: getRequestHeaders(),
      credentials: "include",
      cache: "no-store",
    });

    if (response.status === 400) {
      const payload = await response.json().catch(() => ({}));
      if (payload?.error === "birth_time_required") {
        setScreenState("needs_birth_time");
        setIsPolling(false);
      }
      return null;
    }

    if (!response.ok) return null;

    const data = (await response.json()) as ReportRow;
    return data;
  }, [getRequestHeaders, userId]);

  const checkStatus = useCallback(async (): Promise<{
    status: string;
    report_id?: string;
    error?: string;
  } | null> => {
    const statusUrl = userId
      ? `/api/birth-chart-report/status?userId=${encodeURIComponent(userId)}`
      : "/api/birth-chart-report/status";

    const response = await fetch(statusUrl, {
      method: "GET",
      headers: getRequestHeaders(),
      credentials: "include",
      cache: "no-store",
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { status: string; report_id?: string; error?: string };
    return data;
  }, [getRequestHeaders, userId]);

  const generateReport = useCallback(async () => {
    const response = await fetch("/api/birth-chart-report/generate", {
      method: "POST",
      headers: getRequestHeaders(),
      credentials: "include",
      body: JSON.stringify({ userId }),
    });

    if (response.status === 404) {
      const payload = await response.json().catch(() => ({}));
      if (payload?.error === "no_birth_chart_found") {
        setScreenState("needs_birth_chart");
        setIsPolling(false);
        return null;
      }
    }

    if (response.status === 400) {
      const payload = await response.json().catch(() => ({}));
      if (payload?.error === "birth_time_required") {
        setScreenState("needs_birth_time");
        setIsPolling(false);
        return null;
      }
    }

    if (!response.ok) {
      setErrorMessage("Failed to generate report. Please try again.");
      setScreenState("error");
      setIsPolling(false);
      return null;
    }

    const payload = (await response.json()) as {
      report_id: string;
      status: "pending" | "generating" | "complete" | "failed";
      sections?: Record<string, string>;
      generated_at?: string;
    };

    if (payload.status === "complete" && payload.sections) {
      const fullReport = await fetchFullReport(payload.report_id);
      if (fullReport) {
        setReport(fullReport);
      } else {
        setReport({
          id: payload.report_id,
          status: "complete",
          sections: payload.sections,
          generated_at: payload.generated_at,
        });
      }
      setScreenState("ready");
      setIsPolling(false);
      return payload;
    }

    setScreenState("loading");
    setIsPolling(true);
    return payload;
  }, [fetchFullReport, getRequestHeaders, userId]);

  const bootstrap = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      setScreenState("loading");
      const status = await checkStatus();

      if (!status) {
        setErrorMessage("Unable to check report status. Please try again.");
        setScreenState("error");
        return;
      }

      if (status.status === "complete" && status.report_id) {
        const fullReport = await fetchFullReport(status.report_id);
        if (fullReport) {
          setReport(fullReport);
          setScreenState("ready");
          setIsPolling(false);
          return;
        }
      }

      if (status.status === "pending" || status.status === "generating") {
        await generateReport();
        return;
      }

      if (status.status === "needs_birth_time" || status.error === "birth_time_required") {
        setScreenState("needs_birth_time");
        setIsPolling(false);
        return;
      }

      if (status.status === "setup_required" || status.error === "birth_chart_reports_missing") {
        setScreenState("setup_required");
        setIsPolling(false);
        return;
      }

      if (status.status === "not_started" || status.status === "failed") {
        await generateReport();
        return;
      }

      setErrorMessage("Unable to load report status. Please try again.");
      setScreenState("error");
    } finally {
      isFetchingRef.current = false;
    }
  }, [checkStatus, fetchFullReport, generateReport]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isPolling) return;

    const interval = window.setInterval(async () => {
      const status = await checkStatus();
      if (!status) return;

      if (status.status === "complete" && status.report_id) {
        const fullReport = await fetchFullReport(status.report_id);
        if (fullReport) {
          setReport(fullReport);
          setScreenState("ready");
          setIsPolling(false);
        }
        return;
      }

      if (status.status === "failed") {
        setIsPolling(false);
        setScreenState("error");
        setErrorMessage("Report generation failed. Please try again.");
      }
    }, 3000);

    return () => window.clearInterval(interval);
  }, [checkStatus, fetchFullReport, isPolling]);

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/50 flex flex-col">
        <div className="sticky top-0 z-40 bg-[#061525]/95 backdrop-blur-sm border-b border-[#173653]">
          <div className="flex items-center gap-3 px-4 py-3">
            <button
              type="button"
              onClick={() => router.push("/birth-chart")}
              className="text-white/90 hover:text-white text-sm flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Birth Chart
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {screenState === "loading" && <ReportLoadingState />}

          {screenState === "ready" && report && (
            <ReportViewer
              report={{
                report_id: report.id,
                id: report.id,
                sections: report.sections,
                generated_at: report.generated_at,
                chart_details: report.chart_details,
              }}
            />
          )}

          {screenState === "needs_birth_chart" && (
            <div className="bg-[#0b2338] rounded-2xl border border-[#173653] p-6 text-center">
              <p className="text-white mb-4">Please complete your birth chart first</p>
              <button
                type="button"
                onClick={() => router.push("/birth-chart")}
                className="rounded-xl px-4 py-2 bg-[#38bdf8] text-black font-semibold hover:bg-[#7dd3fc]"
              >
                Go to Birth Chart
              </button>
            </div>
          )}

          {screenState === "needs_birth_time" && (
            <div className="bg-[#0b2338] rounded-2xl border border-[#173653] p-6 text-center">
              <p className="text-white mb-2 font-semibold">Birth time required</p>
              <p className="text-[#8fa3b8] text-sm mb-4">
                Enter your birth time first so your detailed birth chart report can be generated accurately.
              </p>
              <button
                type="button"
                onClick={() => router.push("/birth-chart")}
                className="rounded-xl px-4 py-2 bg-[#38bdf8] text-black font-semibold hover:bg-[#7dd3fc]"
              >
                Enter Birth Time
              </button>
            </div>
          )}

          {screenState === "setup_required" && (
            <div className="bg-[#0b2338] rounded-2xl border border-amber-400/30 p-6 text-center">
              <p className="text-white mb-2 font-semibold">Detailed report table missing</p>
              <p className="text-[#8fa3b8] text-sm">
                Apply the `202604280006_birth_chart_reports.sql` Supabase migration, then retry.
              </p>
            </div>
          )}

          {screenState === "error" && (
            <div className="bg-[#0b2338] rounded-2xl border border-red-400/30 p-6 text-center">
              <p className="text-red-300 mb-4">{errorMessage || "Something went wrong."}</p>
              <button
                type="button"
                onClick={() => void bootstrap()}
                className="rounded-xl px-4 py-2 bg-[#38bdf8] text-black font-semibold hover:bg-[#7dd3fc]"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
