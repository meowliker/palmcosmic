"use client";

import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flashlight, FlashlightOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingHeader } from "@/components/onboarding/OnboardingHeader";
import { PalmAnalysis } from "@/components/onboarding/PalmAnalysis";
import { detectPalmFeatures as detectPalmFeaturesFromImage } from "@/lib/palm-detection";
import { fadeUp } from "@/lib/motion";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { calculateZodiacSign, generateUserId } from "@/lib/user-profile";
import { pixelEvents, customEvents } from "@/lib/pixel-events";
import { trackFunnelAction } from "@/lib/analytics-events";

type PageState = "intro" | "camera" | "preview" | "analysis";

const fakeEmails = [
  { name: "Brian", email: "Brian***@aol.com" },
  { name: "Kevin", email: "Kevin***@protonmail.com" },
  { name: "Alice", email: "Alice***@zoho.com" },
  { name: "Sarah", email: "Sarah***@gmail.com" },
  { name: "Emily", email: "Emily***@yahoo.com" },
  { name: "Emma", email: "Emma***@yahoo.com" },
];

function compressCanvasToDataUrl(source: HTMLCanvasElement, quality = 0.86) {
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

export default function Step14Page() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pageState, setPageState] = useState<PageState>("intro");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isPalmValid, setIsPalmValid] = useState<boolean | null>(null);
  const [isValidatingPalm, setIsValidatingPalm] = useState(false);
  const [isSavingPalm, setIsSavingPalm] = useState(false);
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [hasCamera, setHasCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);

  const onboarding = useOnboardingStore();
  const zodiacSign = calculateZodiacSign(onboarding.birthMonth, onboarding.birthDay);
  const birthDate =
    onboarding.birthYear && onboarding.birthMonth && onboarding.birthDay
      ? `${onboarding.birthYear}-${onboarding.birthMonth}-${onboarding.birthDay}`
      : null;

  useEffect(() => {
    pixelEvents.viewContent("Palm Scan Step", "onboarding_step");
    trackFunnelAction("palm_scan_step_viewed", {
      route: "/onboarding/step-14",
      step_id: "palm_scan",
    });
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentEmailIndex((prev) => (prev + 1) % fakeEmails.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pageState !== "camera") return;

    let mounted = true;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 1600 } },
        });

        if (!mounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasCamera(true);
          setCameraError(null);
          const [track] = stream.getVideoTracks();
          const capabilities = (track?.getCapabilities?.() || {}) as { torch?: boolean };
          setTorchSupported(!!capabilities.torch);
          setTorchEnabled(false);
          trackFunnelAction("palm_scan_camera_opened", {
            route: "/onboarding/step-14",
            step_id: "palm_scan",
          });
        }
      } catch (error) {
        console.error("[step-14] camera error:", error);
        setHasCamera(false);
        setCameraError("Camera access denied. Please use upload instead.");
        trackFunnelAction("palm_scan_camera_failed", {
          route: "/onboarding/step-14",
          step_id: "palm_scan",
          error: error instanceof Error ? error.message : "camera_failed",
        });
      }
    };

    startCamera();

    return () => {
      mounted = false;
      stopCamera();
    };
  }, [pageState]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (pageState !== "preview" || !capturedImage) return;

    let cancelled = false;

    const validatePalmImage = async () => {
      try {
        setIsValidatingPalm(true);
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.src = capturedImage;

        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("Failed to load image"));
        });

        const detected = await detectPalmFeaturesFromImage(img);
        const fingertipCount = detected?.fingertips?.length || 0;
        const ok = fingertipCount >= 3;

        if (cancelled) return;
        setIsPalmValid(ok);
        setScanError(ok ? null : "No palm detected. Please upload a clear photo of your left palm.");
        trackFunnelAction("palm_scan_validation_completed", {
          route: "/onboarding/step-14",
          step_id: "palm_scan",
          fingertip_count: fingertipCount,
          valid: ok,
        });
      } catch (error) {
        if (cancelled) return;
        setIsPalmValid(false);
        setScanError("Could not analyze the photo. Please try again with better lighting.");
        trackFunnelAction("palm_scan_validation_failed", {
          route: "/onboarding/step-14",
          step_id: "palm_scan",
          error: error instanceof Error ? error.message : "validation_failed",
        });
      } finally {
        if (!cancelled) setIsValidatingPalm(false);
      }
    };

    validatePalmImage();

    return () => {
      cancelled = true;
    };
  }, [pageState, capturedImage]);

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setTorchEnabled(false);
    setTorchSupported(false);
    setHasCamera(false);
  };

  const persistPalmImage = async (imageData: string, source: "camera" | "upload") => {
    setIsSavingPalm(true);
    setScanError(null);

    const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
    localStorage.setItem("astrorekha_user_id", userId);
    localStorage.setItem("palmcosmic_user_id", userId);
    localStorage.setItem("astrorekha_palm_image", imageData);
    localStorage.setItem("palmcosmic_palm_image_saved", "true");

    try {
      const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || null;
      const imageResponse = await fetch("/api/palm-reading/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email,
          imageData,
          birthDate,
          birthMonth: onboarding.birthMonth,
          birthDay: onboarding.birthDay,
          birthYear: onboarding.birthYear,
          zodiacSign,
        }),
      });

      const imageResult = await imageResponse.json().catch(() => null);
      if (!imageResponse.ok || !imageResult?.success) {
        throw new Error(imageResult?.error || "Unable to save palm image");
      }

      await fetch("/api/onboarding/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: email || undefined,
          currentRoute: "/onboarding/step-14",
          currentStep: "palm_scan",
          answers: {
            palmImageSaved: true,
            palmImageSource: source,
          },
          onboardingData: {
            gender: onboarding.gender,
            birthMonth: onboarding.birthMonth,
            birthDay: onboarding.birthDay,
            birthYear: onboarding.birthYear,
            birthHour: onboarding.birthHour,
            birthMinute: onboarding.birthMinute,
            birthPeriod: onboarding.birthPeriod,
            birthPlace: onboarding.birthPlace,
            knowsBirthTime: onboarding.knowsBirthTime,
            sunSign: onboarding.sunSign?.name || null,
            moonSign: onboarding.moonSign?.name || null,
            ascendantSign: onboarding.ascendantSign?.name || null,
            modality: onboarding.modality,
            polarity: onboarding.polarity,
            zodiacSign,
            palmImageSaved: true,
          },
          source: "palm_scan_page",
        }),
      }).catch((error) => {
        console.error("[step-14] onboarding snapshot failed:", error);
      });

      customEvents.palmScanComplete();
      pixelEvents.viewContent("Palm Scan Completed", "palm_image");
      trackFunnelAction("palm_scan_image_saved", {
        route: "/onboarding/step-14",
        step_id: "palm_scan",
        source,
        user_id: userId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "save_failed";
      setScanError(message);
      trackFunnelAction("palm_scan_image_save_failed", {
        route: "/onboarding/step-14",
        step_id: "palm_scan",
        source,
        error: message,
      });
    } finally {
      setIsSavingPalm(false);
    }
  };

  const handleTakePhoto = () => {
    setScanError(null);
    setIsPalmValid(null);
    setPageState("camera");
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setScanError("Please upload a palm image file.");
      return;
    }

    const img = new window.Image();
    img.onload = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setScanError("Could not read this image. Please try another photo.");
        URL.revokeObjectURL(img.src);
        return;
      }

      ctx.drawImage(img, 0, 0);
      const imageData = compressCanvasToDataUrl(canvas);
      URL.revokeObjectURL(img.src);
      setCapturedImage(imageData);
      setScanError(null);
      setIsPalmValid(null);
      setPageState("preview");
      await persistPalmImage(imageData, "upload");
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      setScanError("Could not read this image. Please try another photo.");
    };
    img.src = URL.createObjectURL(file);
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = compressCanvasToDataUrl(canvas);

    stopCamera();
    setCapturedImage(imageData);
    setScanError(null);
    setIsPalmValid(null);
    setPageState("preview");
    await persistPalmImage(imageData, "camera");
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScanError(null);
    setIsPalmValid(null);
    setPageState("camera");
  };

  const handleProceed = () => {
    if (isPalmValid === false || isSavingPalm) return;
    trackFunnelAction("palm_scan_analysis_started", {
      route: "/onboarding/step-14",
      step_id: "palm_scan",
    });
    setPageState("analysis");
  };

  const handleCameraBack = () => {
    stopCamera();
    setPageState("intro");
  };

  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const [track] = stream?.getVideoTracks?.() || [];
    if (!track) return;

    try {
      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled } as MediaTrackConstraintSet],
      });
      setTorchEnabled((prev) => !prev);
      setScanError(null);
    } catch (error) {
      console.error("[step-14] torch toggle failed:", error);
      setScanError("Flashlight is not supported on this device/browser.");
    }
  };

  const handleAnalysisComplete = () => {
    trackFunnelAction("palm_scan_analysis_completed", {
      route: "/onboarding/step-14",
      step_id: "palm_scan",
      next_route: "/onboarding/step-15",
    });
    router.push("/onboarding/step-15");
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} className="flex min-h-screen flex-1 flex-col bg-[#061525] text-white">
      {pageState === "intro" ? (
        <>
          <OnboardingHeader showBack currentStep={14} totalSteps={14} />
          <div className="px-6 pb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
              <div className="h-full w-full rounded-full bg-[#38bdf8]" />
            </div>
          </div>

          <div className="flex flex-col items-center px-6 pb-5 pt-3">
            <div className="flex flex-col items-center">
              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 text-center text-xl font-bold md:text-2xl">
                Take a photo of your left palm
              </motion.h1>

              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                <div className="h-[240px] w-[240px] overflow-hidden rounded-2xl bg-[#061525]">
                  <video
                    src="/palmscanner.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-full bg-[#061525]"
                  />
                </div>
              </motion.div>
            </div>

            <div className="mt-5 flex w-full max-w-sm flex-col items-center gap-4">
              <p className="text-center text-xs text-[#b8c7da]">
                These readings are for entertainment purposes only and should not be taken as 100% accurate
              </p>
              <p className="text-center text-xs text-[#b8c7da]">
                Privacy is a priority for us. We only process non-identifiable data to ensure anonymity
              </p>

              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#38bdf8]/20 text-xs font-medium text-[#38bdf8]">
                    {fakeEmails[currentEmailIndex].name.charAt(0)}
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={currentEmailIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3 }}
                      className="text-sm text-[#38bdf8]"
                    >
                      {fakeEmails[currentEmailIndex].email}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span className="text-xs text-[#b8c7da]">just got predictions</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-6 pb-5">
            <Button onClick={handleTakePhoto} className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0284c7]" size="lg">
              Take a photo
            </Button>
            <button onClick={handleUploadClick} className="w-full text-sm font-medium text-[#38bdf8] hover:underline">
              Upload palm photo
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        </>
      ) : null}

      {pageState === "camera" ? (
        <div className="flex flex-1 flex-col">
          <div className="relative flex-1 bg-black">
            {cameraError ? (
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <p className="text-center text-sm text-white">{cameraError}</p>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            )}

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Image src="/palmoutline.png" alt="Palm outline" width={380} height={470} className="object-contain opacity-70" style={{ transform: "scaleX(-1) scale(1.15)" }} />
            </div>

            <button onClick={handleCameraBack} className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/35">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>

            {hasCamera && torchSupported && !cameraError ? (
              <button onClick={toggleTorch} aria-label={torchEnabled ? "Turn torch off" : "Turn torch on"} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white">
                {torchEnabled ? <FlashlightOff className="h-4 w-4" /> : <Flashlight className="h-4 w-4" />}
              </button>
            ) : null}

            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex flex-col items-center gap-4 bg-[#061525] px-6 pb-[calc(env(safe-area-inset-bottom)+5.25rem)] pt-4">
            <p className="text-center text-sm text-[#b8c7da]">Place left palm inside outline and take a photo</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={capturePhoto}
              disabled={!hasCamera || isSavingPalm}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-[#38bdf8]/30 bg-[#38bdf8] disabled:opacity-50"
            >
              <div className="h-12 w-12 rounded-full bg-[#38bdf8]" />
            </motion.button>
          </div>
        </div>
      ) : null}

      {pageState === "preview" && capturedImage ? (
        <div className="flex flex-1 flex-col">
          <OnboardingHeader showBack currentStep={14} totalSteps={14} onBack={handleRetake} />
          <div className="px-6 pb-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#15314d]">
              <div className="h-full w-full rounded-full bg-[#38bdf8]" />
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center px-6 pb-2 pt-6">
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 text-center text-xl font-bold">
              Review your palm photo
            </motion.h2>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-4 h-[52vh] w-full max-w-sm overflow-hidden rounded-2xl border border-[#173653]">
              {/* eslint-disable-next-line @next/next/no-img-element -- Captured/uploaded data URLs are not suitable for next/image optimization. */}
              <img src={capturedImage} alt="Captured palm" className="h-full w-full object-cover" />
            </motion.div>

            {scanError ? <p className="mb-2 text-center text-sm text-red-300">{scanError}</p> : null}
            {isValidatingPalm ? <p className="mb-2 text-center text-sm text-[#b8c7da]">Checking photo...</p> : null}
            {isSavingPalm ? <p className="mb-2 text-center text-sm text-[#b8c7da]">Saving palm image...</p> : null}

            <p className="mb-6 text-center text-sm text-[#b8c7da]">
              Make sure your palm is clearly visible with good lighting
            </p>
          </div>

          <div className="space-y-3 px-6 pb-6">
            <Button
              onClick={handleProceed}
              disabled={isValidatingPalm || isSavingPalm || isPalmValid === false}
              className="h-14 w-full rounded-xl bg-[#38bdf8] text-lg font-semibold text-black hover:bg-[#0284c7] disabled:bg-[#15314d] disabled:text-[#b8c7da]"
              size="lg"
            >
              Proceed
            </Button>
            <button onClick={handleRetake} className="w-full text-sm font-medium text-[#38bdf8] hover:underline">
              Capture again
            </button>
          </div>
        </div>
      ) : null}

      {pageState === "analysis" && capturedImage ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-6">
          <PalmAnalysis imageData={capturedImage} onComplete={handleAnalysisComplete} />
        </div>
      ) : null}
    </motion.div>
  );
}
