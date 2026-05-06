"use client";

import { motion } from "framer-motion";

interface ZodiacWheelProps {
  isAnimating?: boolean;
  size?: number;
}

export function ZodiacWheel({ isAnimating = true, size = 200 }: ZodiacWheelProps) {
  const zodiacSymbols = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full bg-[#38bdf8]/18 blur-3xl" />

      <motion.div
        className="relative flex items-center justify-center rounded-full border-2 border-white/18"
        style={{ width: size, height: size }}
        animate={isAnimating ? { rotate: 360 } : {}}
        transition={isAnimating ? { duration: 30, repeat: Infinity, ease: "linear" } : {}}
      >
        <div className="absolute rounded-full border border-[#38bdf8]/18" style={{ width: size * 0.85, height: size * 0.85 }} />
        <div className="absolute rounded-full border border-[#38bdf8]/14" style={{ width: size * 0.6, height: size * 0.6 }} />
        <div className="absolute rounded-full bg-gradient-to-br from-[#061525] via-[#082035] to-[#0b2338]" style={{ width: size * 0.35, height: size * 0.35 }} />

        {zodiacSymbols.map((symbol, index) => {
          const angle = (index * 30 - 90) * (Math.PI / 180);
          const radius = size * 0.38;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;

          return (
            <motion.div
              key={symbol}
              className="absolute text-xs text-white/65"
              style={{ transform: `translate(${x}px, ${y}px)` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              {symbol}
            </motion.div>
          );
        })}

        {[0, 1, 2, 3, 4, 5].map((index) => {
          const angle = (index * 60 - 90) * (Math.PI / 180);
          const innerRadius = size * 0.18;
          const outerRadius = size * 0.28;
          const radius = innerRadius + (outerRadius - innerRadius) * (index % 2);

          return (
            <motion.div
              key={`planet-${index}`}
              className="absolute h-2 w-2 rounded-full bg-[#38bdf8]/70"
              style={{
                left: "50%",
                top: "50%",
                marginLeft: -4,
                marginTop: -4,
                transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5 + index * 0.15 }}
            />
          );
        })}

        <svg className="absolute inset-0" viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
          {[0, 1, 2].map((index) => {
            const startAngle = (index * 120 + 30) * (Math.PI / 180);
            const endAngle = ((index + 1) * 120 + 30) * (Math.PI / 180);
            const radius = size * 0.22;
            const center = size / 2;

            return (
              <motion.path
                key={`line-${index}`}
                d={`M ${center + Math.cos(startAngle) * radius} ${center + Math.sin(startAngle) * radius} L ${center + Math.cos(endAngle) * radius} ${center + Math.sin(endAngle) * radius}`}
                stroke="rgba(56,189,248,0.28)"
                strokeWidth="1"
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 1 + index * 0.2, duration: 0.5 }}
              />
            );
          })}
        </svg>
      </motion.div>
    </div>
  );
}
