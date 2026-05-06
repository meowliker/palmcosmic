"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface ForecastSphereProps {
  targetPercentage?: number;
  startPercentage?: number;
  duration?: number;
  size?: number;
}

export function ForecastSphere({
  targetPercentage = 34,
  startPercentage = 0,
  duration = 3,
  size = 180,
}: ForecastSphereProps) {
  const [percentage, setPercentage] = useState(startPercentage);

  useEffect(() => {
    const startTime = Date.now();
    const range = targetPercentage - startPercentage;
    let frameId = 0;

    const animate = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setPercentage(Math.round(startPercentage + eased * range));

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [duration, startPercentage, targetPercentage]);

  const waterHeight = (percentage / 100) * size;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-[#38bdf8]/16 blur-2xl" />

      <div className="relative overflow-hidden rounded-full border-2 border-white/18" style={{ width: size, height: size }}>
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b2338]/70 via-[#071a2b]/90 to-[#061525]" />

        <motion.div
          className="absolute bottom-0 left-0 right-0"
          initial={{ height: (startPercentage / 100) * size }}
          animate={{ height: waterHeight }}
          transition={{ duration, ease: "easeOut" }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-[#38bdf8]/70 via-[#7dd3fc]/42 to-[#bae6fd]/20" />

          <motion.div
            className="absolute left-0 right-0 top-0 h-4"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.34) 0%, transparent 100%)",
              borderRadius: "50% 50% 0 0 / 100% 100% 0 0",
            }}
            animate={{
              scaleX: [1, 1.02, 1],
              y: [-2, 0, -2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </motion.div>

        <div className="absolute inset-0 flex items-center justify-center">
          <motion.span
            className="text-4xl font-bold text-white drop-shadow-lg"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
          >
            {percentage}%
          </motion.span>
        </div>

        <div className="absolute right-4 top-2 h-2 w-2 rounded-full bg-white/30 blur-sm" />
      </div>
    </div>
  );
}
