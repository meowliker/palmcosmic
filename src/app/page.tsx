"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { trackFunnelAction, trackFunnelStepView } from "@/lib/analytics-events";

export default function HomePage() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const seedDefaultFlow = () => {
    try {
      localStorage.setItem("astrorekha_onboarding_flow", "flow-a");
      localStorage.setItem("astrorekha_layout_variant", "A");
      localStorage.removeItem("astrorekha_ab_test_id");
    } catch (error) {
      console.error("Failed to seed default onboarding flow:", error);
    }
  };

  useEffect(() => {
    let cancelled = false;

    trackFunnelStepView({
      route: "/",
      stepId: "welcome",
      stepName: "Welcome",
      funnel: "welcome",
      progress: 0,
    });

    const routeUser = () => {
      seedDefaultFlow();

      const hasCompletedPayment = localStorage.getItem("astrorekha_payment_completed") === "true";
      const hasCompletedRegistration = localStorage.getItem("astrorekha_registration_completed") === "true";

      if (cancelled) return;

      if (hasCompletedRegistration) {
        router.replace("/dashboard");
        return;
      }

      if (hasCompletedPayment) {
        const flow = localStorage.getItem("palmcosmic_active_flow") || "future_prediction";
        if (flow === "palm_reading") {
          router.replace("/registration?flow=palm_reading&recovered=true");
          return;
        }
        router.replace(`/onboarding/create-password?flow=${encodeURIComponent(flow)}`);
        return;
      }

      if (window.location.search) {
        router.replace("/");
      }
    };

    routeUser();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    interface Star {
      x: number;
      y: number;
      size: number;
      opacity: number;
      twinkleSpeed: number;
      twinkleOffset: number;
    }

    interface Constellation {
      stars: { x: number; y: number }[];
      connections: [number, number][];
      rotation: number;
      rotationSpeed: number;
      centerX: number;
      centerY: number;
    }

    const stars: Star[] = [];
    const starCount = 150;

    for (let i = 0; i < starCount; i += 1) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    const constellations: Constellation[] = [
      {
        stars: [
          { x: 0.7, y: 0.15 },
          { x: 0.75, y: 0.2 },
          { x: 0.8, y: 0.18 },
          { x: 0.85, y: 0.25 },
          { x: 0.78, y: 0.28 },
        ],
        connections: [[0, 1], [1, 2], [2, 3], [1, 4]],
        rotation: 0,
        rotationSpeed: 0.0002,
        centerX: 0.77,
        centerY: 0.21,
      },
      {
        stars: [
          { x: 0.15, y: 0.7 },
          { x: 0.2, y: 0.75 },
          { x: 0.25, y: 0.72 },
          { x: 0.18, y: 0.8 },
          { x: 0.28, y: 0.78 },
          { x: 0.22, y: 0.85 },
        ],
        connections: [[0, 1], [1, 2], [1, 3], [2, 4], [3, 5]],
        rotation: 0,
        rotationSpeed: 0.00015,
        centerX: 0.21,
        centerY: 0.77,
      },
      {
        stars: [
          { x: 0.1, y: 0.2 },
          { x: 0.15, y: 0.15 },
          { x: 0.2, y: 0.22 },
          { x: 0.12, y: 0.28 },
        ],
        connections: [[0, 1], [1, 2], [0, 3]],
        rotation: 0,
        rotationSpeed: -0.00018,
        centerX: 0.14,
        centerY: 0.21,
      },
    ];

    let animationId: number;
    let time = 0;

    const animate = () => {
      ctx.fillStyle = "#061525";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      time += 1;

      stars.forEach((star) => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity * twinkle})`;
        ctx.fill();
      });

      constellations.forEach((constellation) => {
        constellation.rotation += constellation.rotationSpeed;

        const centerX = constellation.centerX * canvas.width;
        const centerY = constellation.centerY * canvas.height;
        const rotatedStars = constellation.stars.map((star) => {
          const x = star.x * canvas.width - centerX;
          const y = star.y * canvas.height - centerY;
          const cos = Math.cos(constellation.rotation);
          const sin = Math.sin(constellation.rotation);
          return {
            x: x * cos - y * sin + centerX,
            y: x * sin + y * cos + centerY,
          };
        });

        ctx.strokeStyle = "rgba(56, 189, 248, 0.32)";
        ctx.lineWidth = 1;
        constellation.connections.forEach(([from, to]) => {
          ctx.beginPath();
          ctx.moveTo(rotatedStars[from].x, rotatedStars[from].y);
          ctx.lineTo(rotatedStars[to].x, rotatedStars[to].y);
          ctx.stroke();
        });

        rotatedStars.forEach((star) => {
          const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, 8);
          gradient.addColorStop(0, "rgba(56, 189, 248, 0.82)");
          gradient.addColorStop(0.5, "rgba(56, 189, 248, 0.22)");
          gradient.addColorStop(1, "rgba(56, 189, 248, 0)");
          ctx.beginPath();
          ctx.arc(star.x, star.y, 8, 0, Math.PI * 2);
          ctx.fillStyle = gradient;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(star.x, star.y, 2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.fill();
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#061525]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#061525]/20 via-transparent to-[#061525]/85" />

      <div className="relative z-10 flex h-screen w-full max-w-md flex-col overflow-hidden bg-[#061525] shadow-2xl shadow-black/50">
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="mb-16 flex flex-col items-center"
          >
            <div className="relative mb-6">
              <div className="absolute inset-0 scale-150 rounded-full bg-[#38bdf8]/25 blur-2xl" />
              <div className="relative h-28 w-28">
                <Image
                  src="/logo.png"
                  alt="PalmCosmic"
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
            </div>

            <motion.h1
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-4xl font-bold tracking-wide text-white"
            >
              PalmCosmic
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mt-2 text-center text-sm text-white/60"
            >
              Discover your cosmic destiny
            </motion.p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.6 }}
            className="w-full space-y-4"
          >
            <button
              onClick={() => {
                seedDefaultFlow();
                trackFunnelAction("begin_journey_clicked", {
                  route: "/",
                  next_route: "/onboarding/gender",
                  funnel: "welcome",
                });
                router.push("/onboarding/gender");
              }}
              className="w-full rounded-2xl bg-[#38bdf8] py-4 text-lg font-semibold text-black shadow-lg shadow-[rgba(56,189,248,0.24)] transition-all duration-300 hover:scale-[1.02] hover:bg-[#0284c7] hover:shadow-xl hover:shadow-[rgba(56,189,248,0.32)] active:scale-[0.98]"
            >
              Begin Your Journey
            </button>

            <div className="pt-4 text-center">
              <p className="text-sm text-white/50">
                Already have an account?{" "}
                <button
                  onClick={() => {
                    trackFunnelAction("login_clicked", {
                      route: "/",
                      next_route: "/login",
                      funnel: "welcome",
                    });
                    router.push("/login");
                  }}
                  className="font-medium text-[#38bdf8] underline underline-offset-2 transition-colors hover:text-[#7dd3fc]"
                >
                  Login
                </button>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="flex items-center justify-center gap-2 pb-8 text-xs text-white/30"
          >
            <span>✦</span>
            <span>Your stars await</span>
            <span>✦</span>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
