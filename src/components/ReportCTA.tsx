"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import ReportDisclaimer from "@/components/ReportDisclaimer";

export default function ReportCTA() {
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-[#0b2338] rounded-2xl p-4 border border-[#173653]"
    >
      <div className="h-px w-full bg-[#173653] mb-4" />

      <h3 className="text-white text-lg font-semibold mb-1">Want a deeper reading?</h3>
      <p className="text-white/60 text-sm leading-relaxed mb-4">
        Get your personalized 10-section birth chart report — life predictions,
        career, relationships, current dasha and more.
      </p>

      <button
        type="button"
        onClick={() => router.push("/birth-chart/report")}
        className="w-full rounded-xl px-4 py-3 bg-[#38bdf8] text-black font-semibold text-sm hover:bg-[#7dd3fc]"
      >
        Get Detailed Report →
      </button>

      <ReportDisclaimer className="mt-4" />
    </motion.div>
  );
}
