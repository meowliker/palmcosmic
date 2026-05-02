"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, CheckCircle2, Flashlight, FlashlightOff, ImageIcon, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackFunnelAction } from "@/lib/analytics-events";
import { pixelEvents } from "@/lib/pixel-events";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { calculateZodiacSign, generateUserId } from "@/lib/user-profile";
import { OnboardingMenuButton } from "@/components/onboarding/OnboardingMenuButton";
import { PalmReadingImagePage } from "@/components/onboarding/palm-reading/PalmReadingImagePage";
import { palmReadingScreens } from "@/components/onboarding/palm-reading/palmReadingFlow";

const PALM_READY_TEST_ID = "palm-reading-ready-scan";

function getVisitorId() {
  const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
  localStorage.setItem("astrorekha_user_id", userId);
  return userId;
}

async function trackReadyAbEvent(eventType: "impression" | "conversion" | "bounce" | "checkout_started", metadata: Record<string, unknown> = {}) {
  const variant = localStorage.getItem("palmcosmic_palm_ready_variant");
  const visitorId = localStorage.getItem("astrorekha_user_id");
  if (!variant || !visitorId) return;

  await fetch("/api/ab-test/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      testId: PALM_READY_TEST_ID,
      variant,
      eventType,
      visitorId,
      userId: visitorId,
      metadata: {
        route: "/onboarding/palm-reading/ready",
        funnel: "palm_reading",
        ...metadata,
      },
    }),
  }).catch(() => undefined);
}

function compressImageToDataUrl(source: HTMLCanvasElement, quality = 0.82) {
  const maxSide = 1400;
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(source.width * scale));
  canvas.height = Math.max(1, Math.round(source.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) return source.toDataURL("image/jpeg", quality);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export default function PalmReadingReadyPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const convertedRef = useRef(false);
  const bounceTrackedRef = useRef(false);

  const [showCamera, setShowCamera] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [palmImage, setPalmImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [variant, setVariant] = useState<"A" | "B" | null>(null);
  const [variantLoading, setVariantLoading] = useState(true);

  const { birthMonth, birthDay, birthYear } = useOnboardingStore();
  const zodiacSign = calculateZodiacSign(birthMonth, birthDay);
  const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

  useEffect(() => {
    let mounted = true;

    async function assignVariant() {
      try {
        const visitorId = getVisitorId();
        const params = new URLSearchParams({
          testId: PALM_READY_TEST_ID,
          visitorId,
          userId: visitorId,
        });
        const response = await fetch(`/api/ab-test?${params.toString()}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        const assigned = data?.variant === "B" ? "B" : "A";
        localStorage.setItem("palmcosmic_palm_ready_variant", assigned);
        localStorage.setItem("palmcosmic_palm_ready_test_id", data?.testId || PALM_READY_TEST_ID);
        if (mounted) setVariant(assigned);
        await trackReadyAbEvent("impression", {
          source: data?.cached ? "server_cached_assignment" : "server_assignment",
          page: data?.page || (assigned === "B" ? "ready-scan" : "ready-classic"),
          status: data?.test?.status || "active",
        });
      } catch (err) {
        console.error("Palm ready A/B assignment failed:", err);
        const cached = localStorage.getItem("palmcosmic_palm_ready_variant");
        const fallback = cached === "A" || cached === "B" ? cached : "A";
        localStorage.setItem("palmcosmic_palm_ready_variant", fallback);
        if (mounted) setVariant(fallback);
      } finally {
        if (mounted) setVariantLoading(false);
      }
    }

    assignVariant();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!variant) return;

    const sendBounce = () => {
      if (convertedRef.current || bounceTrackedRef.current) return;
      const visitorId = localStorage.getItem("astrorekha_user_id");
      if (!visitorId) return;

      bounceTrackedRef.current = true;
      const payload = JSON.stringify({
        testId: PALM_READY_TEST_ID,
        variant,
        eventType: "bounce",
        visitorId,
        userId: visitorId,
        metadata: {
          route: "/onboarding/palm-reading/ready",
          funnel: "palm_reading",
          action: variant === "B" ? "left_before_palm_scan_saved" : "left_before_classic_continue",
        },
      });

      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/ab-test/event", new Blob([payload], { type: "application/json" }));
        return;
      }

      fetch("/api/ab-test/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => undefined);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") sendBounce();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", sendBounce);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", sendBounce);
    };
  }, [variant]);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setTorchEnabled(false);
    setTorchSupported(false);
    setShowCamera(false);
  };

  const startCamera = async () => {
    setError(null);
    setShowCamera(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 1600 },
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const [track] = stream.getVideoTracks();
      const capabilities = (track?.getCapabilities?.() || {}) as { torch?: boolean };
      setTorchSupported(!!capabilities.torch);

      trackFunnelAction("palm_scan_camera_opened", {
        funnel: "palm_reading",
        route: "/onboarding/palm-reading/ready",
        step_id: "palm_ready",
      });
    } catch (err) {
      console.error("Palm scan camera error:", err);
      setError("Could not access your camera. Please allow camera permission or upload a palm photo.");
      setShowCamera(false);
    }
  };

  const toggleTorch = async () => {
    const [track] = streamRef.current?.getVideoTracks?.() || [];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled } as MediaTrackConstraintSet],
      });
      setTorchEnabled((value) => !value);
    } catch {
      setError("Flashlight is not supported on this device/browser.");
    }
  };

  const savePalmImage = async (imageData: string) => {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
      localStorage.setItem("astrorekha_user_id", userId);
      localStorage.setItem("astrorekha_palm_image", imageData);
      localStorage.setItem("palmcosmic_palm_image_saved", "true");

      const response = await fetch("/api/palm-reading/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          imageData,
          birthDate,
          birthMonth,
          birthDay,
          birthYear,
          zodiacSign,
          email: localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || null,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to save palm image");
      }

      setSaved(true);
      convertedRef.current = true;
      await trackReadyAbEvent("conversion", {
        action: "palm_scan_saved",
        source: showCamera ? "camera" : "upload",
      });
      trackFunnelAction("palm_scan_saved", {
        funnel: "palm_reading",
        route: "/onboarding/palm-reading/ready",
        step_id: "palm_ready",
        source: showCamera ? "camera" : "upload",
      });
      pixelEvents.viewContent("Palm Scan Completed", "palm_image");
    } catch (err: any) {
      console.error("Palm image save failed:", err);
      setError(err?.message || "Could not save your palm image. Please try again.");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);
    const imageData = compressImageToDataUrl(canvas);
    setPalmImage(imageData);
    stopCamera();
    await savePalmImage(imageData);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload a palm image file.");
      return;
    }

    const img = new Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Could not read this image. Please try another photo.");
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = compressImageToDataUrl(canvas);
      URL.revokeObjectURL(img.src);
      setPalmImage(imageData);
      await savePalmImage(imageData);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      setError("Could not read this image. Please try another photo.");
    };
    img.src = URL.createObjectURL(file);
  };

  const continueToEmail = () => {
    if (!saved) {
      setError("Please scan or upload your palm first.");
      return;
    }

    router.push("/onboarding/palm-reading/email");
  };

  if (variantLoading || !variant) {
    return (
      <main className="flex min-h-[100svh] items-center justify-center bg-[#061525] text-white">
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-9 w-9 animate-spin text-[#38bdf8]" />
          <p className="text-sm text-[#b8c7da]">Preparing your palm reading...</p>
        </div>
      </main>
    );
  }

  if (variant === "A") {
    return (
      <PalmReadingImagePage
        screen={palmReadingScreens.ready}
        onContinue={() => {
          convertedRef.current = true;
          trackReadyAbEvent("conversion", {
            action: "classic_continue_clicked",
            next_route: "/onboarding/palm-reading/email",
          });
        }}
      />
    );
  }

  if (showCamera) {
    return (
      <main className="min-h-[100svh] bg-black text-white">
        <div className="mx-auto flex min-h-[100svh] max-w-[30rem] flex-col bg-black">
          <div className="relative flex-1 overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <img
                src="/palmoutline.png"
                alt=""
                className="h-[68vh] max-h-[34rem] object-contain opacity-70"
                style={{ transform: "scaleX(-1) scale(1.08)" }}
              />
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,0.55)_78%)]" />
            <button onClick={stopCamera} className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/45">
              <ArrowLeft className="h-5 w-5" />
            </button>
            {(torchSupported || !!streamRef.current) && (
              <button onClick={toggleTorch} className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/45">
                {torchEnabled ? <FlashlightOff className="h-5 w-5" /> : <Flashlight className="h-5 w-5" />}
              </button>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="bg-[#061525] px-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-5 text-center">
            <p className="mb-4 text-sm text-[#b8c7da]">Place your open palm inside the outline in bright light.</p>
            <button onClick={capturePhoto} disabled={saving} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#38bdf8]/30 bg-[#38bdf8] shadow-lg shadow-[#38bdf8]/20 disabled:opacity-60">
              {saving ? <Loader2 className="h-7 w-7 animate-spin text-black" /> : <div className="h-11 w-11 rounded-full bg-[#38bdf8]" />}
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100svh] bg-[#061525] text-white">
      <section className="sticky top-0 z-20 border-b border-[#38bdf8]/15 bg-[#071a2b]/95 px-5 py-3 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[28rem] items-center justify-between gap-4">
          <button onClick={() => router.back()} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center leading-tight">
            <p className="text-xl font-semibold text-[#38bdf8]">Palm scan</p>
          </div>
          <OnboardingMenuButton className="-mr-2 shrink-0" />
        </div>
      </section>

      <div className="mx-auto flex min-h-[calc(100svh-4.25rem)] max-w-[30rem] flex-col px-5 pb-8 pt-6">
        <div className="flex-1">
          <div className="mb-5 rounded-[1.75rem] border border-[#173653] bg-[#0b2338] p-3">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.25rem] bg-[#061525]">
              {palmImage ? (
                <img src={palmImage} alt="Your scanned palm" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                  <div className="mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#38bdf8]/12 text-[#38bdf8]">
                    <Camera className="h-11 w-11" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">Scan your palm</h1>
                  <p className="mt-3 text-sm leading-relaxed text-[#b8c7da]">
                    Use a clear photo of your palm with good lighting.
                  </p>
                </div>
              )}

              {saved && (
                <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-[#03111f]">
                  <CheckCircle2 className="h-4 w-4" />
                  Palm image saved
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={startCamera} disabled={saving} className="h-14 rounded-2xl bg-[#38bdf8] font-bold !text-black hover:bg-[#7dd3fc]">
              <Camera className="mr-2 h-4 w-4 text-black" />
              Scan
            </Button>
            <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl border border-[#173653] bg-white/5 text-sm font-bold text-white transition-colors hover:bg-white/10">
              <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              <ImageIcon className="mr-2 h-4 w-4" />
              Upload
            </label>
          </div>

          {palmImage && (
            <button
              onClick={() => {
                setPalmImage(null);
                setSaved(false);
                setError(null);
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#173653] px-4 py-3 text-sm font-semibold text-[#b8c7da]"
            >
              <RotateCcw className="h-4 w-4" />
              Retake palm image
            </button>
          )}
        </div>

        <Button onClick={continueToEmail} disabled={!saved || saving} className="mt-6 h-14 rounded-2xl bg-[#38bdf8] text-base font-bold !text-black hover:bg-[#7dd3fc] disabled:opacity-50">
          {saving ? <Loader2 className="mr-2 h-5 w-5 animate-spin text-black" /> : null}
          Continue
        </Button>
      </div>
    </main>
  );
}
