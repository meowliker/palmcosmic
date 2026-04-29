"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Coins, Send, HelpCircle, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { useOnboardingStore } from "@/lib/onboarding-store";
import { useUserStore } from "@/lib/user-store";
import { generateUserId } from "@/lib/user-profile";
import { usePricing } from "@/hooks/usePricing";
import { DEFAULT_PRICING } from "@/lib/pricing";
import { startStripeCheckout } from "@/lib/stripe-checkout";
import { trackAnalyticsEvent } from "@/lib/analytics-events";
import { pixelEvents, trackPixelEvent } from "@/lib/pixel-events";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date | string;
  palmImage?: string;
  traits?: Array<{ name: string; value: number; color: string }>;
}

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  palmImage?: string;
  traits?: Array<{ name: string; value: number; color: string }>;
}

const suggestedQuestions = [
  "What does my palm say about my future?",
  "What are my career prospects this year?",
  "How can I improve my relationships?",
];

function formatMessage(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function formatUsdFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format((cents || 0) / 100);
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);
  const [palmImage, setPalmImage] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchasingPackage, setPurchasingPackage] = useState<number | null>(null);
  const [palmReading, setPalmReading] = useState<any>(null);
  const [natalChart, setNatalChart] = useState<any>(null);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [showLowBalanceBubble, setShowLowBalanceBubble] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get coins from user store
  const { coins, deductCoins } = useUserStore();
  
  // Get dynamic pricing from API
  const { pricing } = usePricing();
  
  // Build coin packages from dynamic pricing or use defaults
  const coinPackages = pricing?.coinPackages?.filter(p => p.active).map((p, i) => ({
    id: i + 1,
    coins: p.coins,
    price: p.displayPrice || p.price,
    discount: p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : null,
    popular: i === 1, // Second package is popular
    packageId: p.id,
  })) || DEFAULT_PRICING.coinPackages.filter(p => p.active).map((p, i) => ({
    id: i + 1,
    coins: p.coins,
    price: p.displayPrice || p.price,
    discount: p.originalPrice > p.price ? Math.round((1 - p.price / p.originalPrice) * 100) : null,
    popular: i === 1,
    packageId: p.id,
  }));

  useEffect(() => {
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || "";
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
    pixelEvents.viewContent("Elysia Chat", "chat");
    trackAnalyticsEvent("ElysiaChatViewed", {
      route: "/chat",
      user_id: userId,
      email,
      coins,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCoinPricing = (source: string) => {
    setShowPricing(true);
    trackAnalyticsEvent("ElysiaCoinPricingOpened", {
      route: "/chat",
      source,
      coins,
      package_count: coinPackages.length,
    });
    trackPixelEvent("ViewContent", {
      content_name: "Elysia Coin Packages",
      content_type: "coin_packages",
      currency: "USD",
    });
  };

  const handlePurchaseCoins = async (pkg: typeof coinPackages[0]) => {
    setPurchaseError("");
    setPurchasingPackage(pkg.id);
    const userId = localStorage.getItem("astrorekha_user_id") || localStorage.getItem("palmcosmic_user_id") || generateUserId();
    const email = localStorage.getItem("palmcosmic_email") || localStorage.getItem("astrorekha_email") || "";
    const firstName = localStorage.getItem("palmcosmic_name") || localStorage.getItem("astrorekha_name") || "Customer";
    const value = pkg.price / 100;

    trackAnalyticsEvent("ElysiaCoinCheckoutStarted", {
      route: "/chat",
      payment_provider: "stripe",
      package_id: pkg.packageId,
      coins: pkg.coins,
      value,
      currency: "USD",
      user_id: userId,
      email,
    });
    trackPixelEvent("InitiateCheckout", {
      value,
      currency: "USD",
      content_ids: [pkg.packageId],
      content_name: `${pkg.coins} Coins`,
      content_type: "product",
      num_items: 1,
    });

    try {
      await startStripeCheckout({
        type: "coins",
        packageId: pkg.packageId,
        userId,
        email,
        firstName,
        successPath: "/chat",
        cancelPath: "/chat",
      });
    } catch (error) {
      console.error("Coin purchase error:", error);
      const message = error instanceof Error ? error.message : "Unable to start Stripe checkout. Please try again.";
      setPurchaseError(message);
      setPurchasingPackage(null);
      trackAnalyticsEvent("ElysiaCoinCheckoutFailed", {
        route: "/chat",
        payment_provider: "stripe",
        package_id: pkg.packageId,
        coins: pkg.coins,
        value,
        currency: "USD",
        error: message,
      });
    }
  };

  // Get user data from onboarding store
  const {
    gender,
    birthMonth,
    birthDay,
    birthYear,
    birthPlace,
    birthHour,
    birthMinute,
    birthPeriod,
    relationshipStatus,
    goals,
    sunSign,
    moonSign,
    ascendantSign,
  } = useOnboardingStore();

  // Initialize welcome message and load palm reading + chat history from Supabase
  useEffect(() => {
    setIsClient(true);
    
    // Load palm image from localStorage
    const savedPalmImage = localStorage.getItem("astrorekha_palm_image");
    if (savedPalmImage) {
      setPalmImage(savedPalmImage);
    }

    const loadData = async () => {
      const userId = localStorage.getItem("astrorekha_user_id") || generateUserId();
      setCurrentUserId(userId);
      const anonId = localStorage.getItem("astrorekha_anon_id") || "";
      const stateResponse = await fetch(
        `/api/chat/state?userId=${encodeURIComponent(userId)}${anonId ? `&anonId=${encodeURIComponent(anonId)}` : ""}`,
        { cache: "no-store" }
      );
      const state = await stateResponse.json().catch(() => null);

      // Load palm reading from Supabase
      try {
        const palmData = stateResponse.ok && state?.success ? state.palmReading : null;
        if (palmData) {
          setPalmReading(palmData.reading);
          if (palmData.palm_image_url) setPalmImage(palmData.palm_image_url);
        }
      } catch (err) {
        console.error("[Chat] Failed to load palm reading:", err);
      }

      // Load natal chart from Supabase (calculated by astro-engine)
      try {
        const chartData = stateResponse.ok && state?.success ? state.natalChart : null;
        if (chartData) {
          setNatalChart(chartData);
        } else {
          // No chart saved yet — calculate it now via astro-engine
          try {
            const signsResponse = await fetch("/api/astrology/signs", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": userId,
              },
              body: JSON.stringify({
                birthMonth,
                birthDay,
                birthYear,
                birthHour,
                birthMinute,
                birthPeriod,
                birthPlace,
              }),
            });
            if (signsResponse.ok) {
              const chartReloadResponse = await fetch(`/api/chat/state?userId=${encodeURIComponent(userId)}`, { cache: "no-store" });
              const chartReload = await chartReloadResponse.json().catch(() => null);
              const newChart = chartReloadResponse.ok && chartReload?.success ? chartReload.natalChart : null;
              if (newChart) {
                setNatalChart(newChart);
              }
            }
          } catch (calcErr) {
            console.error("[Chat] Failed to calculate natal chart:", calcErr);
          }
        }
      } catch (err) {
        console.error("[Chat] Failed to load natal chart:", err);
      }

      // Load chat history from Supabase
      try {
        const chatDoc = stateResponse.ok && state?.success ? state.chat : null;

        if (chatDoc?.messages && chatDoc.messages.length > 0) {
          const loadedMessages: Message[] = chatDoc.messages.map((m: StoredMessage) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          }));
          setMessages(loadedMessages);
          setChatLoaded(true);
          return;
        }
      } catch (err) {
        console.error("[Chat] Failed to load chat history:", err);
      }

      // No saved chat - show welcome message
      const greeting = ascendantSign?.name 
        ? `Hey there! I'm Elysia. I can see you're a ${ascendantSign.name} rising - that's fascinating! I've got your birth chart and palm reading ready. What's on your mind today?`
        : `Hey! I'm Elysia, your cosmic guide. I've got access to your birth chart and palm reading. What would you like to explore today?`;
      
      setMessages([
        {
          role: "assistant",
          content: greeting,
          timestamp: new Date(),
        },
      ]);
      setChatLoaded(true);
    };

    loadData();
  }, []);

  // Show low balance bubble when coins < 3
  useEffect(() => {
    if (coins < 3) {
      setShowLowBalanceBubble(true);
    }
  }, [coins]);

  // Save chat messages to Supabase whenever they change
  useEffect(() => {
    // Only save if we have loaded chat, have a userId, and user has sent at least one message
    const hasUserMessage = messages.some(m => m.role === "user");
    if (!chatLoaded || messages.length === 0 || !currentUserId || !hasUserMessage) {
      return;
    }

    const saveChat = async () => {
      try {
        // Filter out undefined fields
        const storedMessages: StoredMessage[] = messages.map((m) => {
          const msg: StoredMessage = {
            role: m.role,
            content: m.content,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
          };
          // Only add optional fields if they exist
          if (m.palmImage) msg.palmImage = m.palmImage;
          if (m.traits) msg.traits = m.traits;
          return msg;
        });
        
        await fetch("/api/chat/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: currentUserId, messages: storedMessages }),
        });
      } catch (err: any) {
        console.error("[Chat] Failed to save chat:", err);
        console.error("[Chat] Error code:", err?.code);
        console.error("[Chat] Error message:", err?.message);
      }
    };

    // Debounce save to avoid too many writes
    const timeoutId = setTimeout(saveChat, 500);
    return () => clearTimeout(timeoutId);
  }, [messages, chatLoaded, currentUserId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (messageText?: string) => {
    const textToSend = messageText || input;
    if (!textToSend.trim() || isLoading) return;

    // Check if user has enough coins (3 coins per message)
    if (coins < 3) {
      openCoinPricing("insufficient_coins_message_send");
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    trackAnalyticsEvent("ElysiaMessageSent", {
      route: "/chat",
      source: messageText ? "suggested_question" : "typed_message",
      coins_before: coins,
      cost_coins: 3,
    });

    try {
      // Build user profile for personalized responses
      const userProfile = {
        gender,
        birthDate: `${birthMonth} ${birthDay}, ${birthYear}`,
        birthTime: birthHour && birthPeriod ? `${birthHour}:${birthMinute} ${birthPeriod}` : null,
        birthPlace,
        relationshipStatus,
        goals,
        sunSign: sunSign?.name,
        moonSign: moonSign?.name,
        ascendantSign: ascendantSign?.name,
        hasPalmImage: !!palmImage,
      };

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: textToSend,
          userProfile,
          palmImageBase64: palmImage,
          palmReading: palmReading,
          natalChart: natalChart,
          context: {
            previousMessages: messages.slice(-20),
          },
        }),
      });

      const data = await response.json();

      if (data.reply) {
        const assistantMessage: Message = {
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        deductCoins(3); // Deduct 3 coins per message

        try {
          const userId = generateUserId();
          await fetch("/api/chat/state", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, action: "deduct_coins", amount: 3 }),
          });
        } catch (err) {
          console.error("Failed to persist coin deduction:", err);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-[#061525] flex items-center justify-center">
      <div className="w-full max-w-md h-screen bg-[#061525] overflow-hidden shadow-2xl shadow-black/30 flex flex-col">
        {/* Header */}
        <div className="bg-[#061525]/95 px-4 py-3 flex items-center justify-between border-b border-[#173653] backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/reports")}
            className="w-10 h-10 rounded-lg bg-[#0b2338] border border-[#173653] flex items-center justify-center hover:border-[#38bdf8]/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-[#082035] border border-[#38bdf8]/30 flex items-center justify-center overflow-hidden shadow-lg shadow-[#38bdf8]/15">
              <Image
                src="/elysia.png"
                alt="Elysia"
                width={48}
                height={48}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div>
              <h1 className="text-white font-semibold">Elysia</h1>
              <p className="text-[#38bdf8] text-xs">online</p>
            </div>
          </div>
        </div>

        {/* Header actions */}
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => {
              const next = !showChatInfo;
              setShowChatInfo(next);
              setShowWallet(false);
              if (next) {
                trackAnalyticsEvent("ElysiaChatInfoOpened", {
                  route: "/chat",
                });
              }
            }}
            className="w-10 h-10 rounded-lg bg-[#0b2338] border border-[#173653] flex items-center justify-center hover:border-[#38bdf8]/60 transition-colors"
            aria-label="Chat disclaimer"
            title="Chat disclaimer"
          >
            <HelpCircle className="w-5 h-5 text-[#b8c7da]" />
          </button>

          <AnimatePresence>
            {showChatInfo && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowChatInfo(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-72 rounded-lg bg-[#061525] shadow-2xl shadow-black/40 border border-[#38bdf8]/25 p-4 z-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-white text-sm font-semibold">About Elysia Chat</p>
                      <p className="mt-2 text-xs leading-5 text-[#b8c7da]">
                        Elysia&apos;s chat replies are AI-generated for spiritual entertainment only, not professional advice.
                        PalmCosmic assumes no liability for decisions or outcomes based on chat responses.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowChatInfo(false)}
                      className="w-6 h-6 rounded-md bg-[#0b2338] border border-[#173653] flex items-center justify-center hover:border-[#38bdf8]/60 transition-colors shrink-0"
                      aria-label="Close chat disclaimer"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          <button
            onClick={() => {
              const next = !showWallet;
              setShowWallet(next);
              setShowChatInfo(false);
              if (next) {
                trackAnalyticsEvent("ElysiaWalletOpened", {
                  route: "/chat",
                  coins,
                });
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0b2338] border border-[#173653] hover:border-[#38bdf8]/60 transition-colors"
          >
            <span className="text-white font-semibold">{coins}</span>
            <div className="w-6 h-6 rounded-md bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center">
              <Coins className="w-3.5 h-3.5 text-[#38bdf8]" />
            </div>
          </button>

          {/* Wallet Dropdown */}
          <AnimatePresence>
            {showWallet && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowWallet(false)}
                />
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className="absolute right-0 top-full mt-2 w-64 rounded-lg bg-[#061525] shadow-2xl shadow-black/40 border border-[#38bdf8]/25 p-4 z-50"
                >
                  <button
                    onClick={() => setShowWallet(false)}
                    className="absolute top-2 right-2 w-6 h-6 rounded-md bg-[#0b2338] border border-[#173653] flex items-center justify-center hover:border-[#38bdf8]/60 transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="mb-4">
                    <p className="text-[#8fa3b8] text-sm mb-1">Wallet Balance</p>
                    <div className="flex items-center gap-2">
                      <Coins className="w-6 h-6 text-[#38bdf8]" />
                      <span className="text-white text-2xl font-bold">{coins}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setShowWallet(false);
                      openCoinPricing("wallet_dropdown");
                    }}
                    className="w-full rounded-lg bg-[#38bdf8] text-[#04111f] hover:bg-[#7dd3fc]"
                  >
                    Get More Coins
                  </Button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Low Balance Bubble */}
      <AnimatePresence>
        {showLowBalanceBubble && coins < 3 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-4 mt-2"
          >
            <div className="bg-[#0b2338] rounded-lg p-4 flex items-center gap-3 border border-[#38bdf8]/25 shadow-lg shadow-black/20">
              <div className="w-10 h-10 rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center flex-shrink-0">
                <Coins className="w-5 h-5 text-[#38bdf8]" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium text-sm">You're running out of balance</p>
                <p className="text-[#8fa3b8] text-xs">Refill to continue chatting.</p>
              </div>
              <button
                onClick={() => {
                  setShowLowBalanceBubble(false);
                  openCoinPricing("low_balance_banner");
                }}
                className="px-4 py-2 bg-[#38bdf8] hover:bg-[#7dd3fc] text-[#04111f] text-sm font-semibold rounded-lg transition-colors"
              >
                Refill
              </button>
              <button
                onClick={() => setShowLowBalanceBubble(false)}
                className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-[#061525] transition-colors"
              >
                <X className="w-4 h-4 text-[#8fa3b8]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] ${
                message.role === "user"
                  ? "bg-[#38bdf8] text-[#04111f]"
                  : "bg-[#0b2338] text-[#dce8f5] border border-[#173653]"
              } rounded-lg px-5 py-3 shadow-sm`}
            >
              {/* Palm Image with Traits */}
              {message.palmImage && message.traits && (
                <div className="mb-4 bg-[#061525] rounded-lg p-4 flex gap-4 border border-[#173653]">
                  <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                    <Image
                      src={message.palmImage}
                      alt="Palm"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 space-y-3">
                    {message.traits.map((trait, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2 h-2 rounded-full"
                              style={{ backgroundColor: trait.color }}
                            />
                            <span className="text-[#b8c7da] text-sm">{trait.name}</span>
                          </div>
                          <span className="text-white font-semibold text-sm">{trait.value}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[#0b2338] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${trait.value}%`,
                              backgroundColor: trait.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm leading-relaxed whitespace-pre-wrap">{formatMessage(message.content)}</p>
              <p className="text-[10px] opacity-50 mt-2">
                {(message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp)).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-[#0b2338] border border-[#173653] rounded-lg px-5 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-[#38bdf8]/70 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 bg-[#38bdf8]/70 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 bg-[#38bdf8]/70 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white font-medium text-sm">People usually ask</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {suggestedQuestions.map((question, index) => (
            <button
              key={index}
              onClick={() => sendMessage(question)}
              className="flex-shrink-0 px-4 py-2 bg-[#0b2338] text-[#b8c7da] text-sm rounded-lg hover:border-[#38bdf8]/60 hover:text-white transition-colors border border-[#173653]"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-6">
        <div className="flex gap-2 items-center">
          
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type to ask..."
            className="flex-1 px-5 py-3 bg-[#0b2338] text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#38bdf8] border border-[#173653] placeholder:text-[#8fa3b8]"
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className="w-10 h-10 rounded-lg bg-[#38bdf8] flex items-center justify-center hover:bg-[#7dd3fc] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5 text-[#04111f]" />
          </button>
        </div>
      </div>

      {/* Pricing Modal */}
      <AnimatePresence>
        {showPricing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#020b15]/85 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPricing(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#061525] rounded-lg border border-[#38bdf8]/25 shadow-2xl shadow-black/40 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
                <div className="flex-1 min-w-0">
                  <h2 className="text-white text-lg sm:text-2xl font-bold mb-1 truncate">Get More Coins</h2>
                  <p className="text-[#8fa3b8] text-xs sm:text-sm">Choose a package to continue</p>
                </div>
                <button
                  onClick={() => {
                    setShowPricing(false);
                    setPurchaseError("");
                  }}
                  className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded-lg bg-[#0b2338] border border-[#173653] flex items-center justify-center hover:border-[#38bdf8]/60 transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </button>
              </div>

              {/* Floating Error Message */}
              <AnimatePresence>
                {purchaseError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 bg-red-500/10 border border-red-400/30 rounded-lg"
                  >
                    <p className="text-red-400 text-sm text-center">{purchaseError}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Coin Packages Grid */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {coinPackages.map((pkg) => (
                  <motion.button
                    key={pkg.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handlePurchaseCoins(pkg)}
                    disabled={purchasingPackage !== null}
                    className={`relative rounded-lg p-3 sm:p-6 border transition-all bg-[#0b2338] ${
                      pkg.popular
                        ? "border-[#38bdf8] shadow-lg shadow-[#38bdf8]/15"
                        : "border-[#173653] hover:border-[#38bdf8]/60"
                    }`}
                  >
                    {/* Discount Badge */}
                    {pkg.discount && (
                      <div className="absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 bg-[#38bdf8] text-[#04111f] text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-md shadow-lg shadow-[#38bdf8]/20">
                        {pkg.discount}% OFF
                      </div>
                    )}

                    {/* Popular Badge */}
                    {pkg.popular && (
                      <div className="absolute -top-1.5 left-2 sm:-top-2 sm:left-4 bg-[#7dd3fc] text-[#04111f] text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-md shadow-lg shadow-[#38bdf8]/20">
                        POPULAR
                      </div>
                    )}

                    {/* Coin Icon */}
                    <div className="flex justify-center mb-2 sm:mb-4 mt-2 sm:mt-0">
                      <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center shadow-inner shadow-[#38bdf8]/10">
                        <Coins className="w-6 h-6 sm:w-8 sm:h-8 text-[#38bdf8]" />
                      </div>
                    </div>

                    {/* Coin Amount */}
                    <div className="text-center mb-1 sm:mb-2">
                      <p className="bg-gradient-to-b from-[#e0f7ff] to-[#38bdf8] bg-clip-text text-xl sm:text-3xl font-extrabold text-transparent drop-shadow-[0_0_12px_rgba(56,189,248,0.25)]">{pkg.coins}</p>
                      <p className="text-[#8fa3b8] text-[10px] sm:text-sm">Coins</p>
                    </div>

                    {/* Price */}
                    <div className="text-center mb-2 sm:mb-4">
                      <p className="text-white text-lg sm:text-2xl font-bold">{formatUsdFromCents(pkg.price)}</p>
                    </div>

                    {/* Buy Button */}
                    <div className={`w-full py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center ${
                      pkg.popular
                        ? "bg-[#38bdf8] text-[#04111f]"
                        : "bg-[#061525] border border-[#173653] text-[#b8c7da] hover:border-[#38bdf8]/60 hover:text-white"
                    }`}>
                      {purchasingPackage === pkg.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Buy Now"
                      )}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Pricing Info */}
              <div className="mt-4 sm:mt-6 text-center">
                <p className="text-white/60 text-xs sm:text-sm mb-2 flex items-center justify-center gap-1">
                  1 question = 3
                  <span className="inline-flex items-center">
                    <Coins className="w-3 h-3 sm:w-4 sm:h-4 text-[#38bdf8]" />
                  </span>
                </p>
              </div>

              {/* Footer */}
              <div className="mt-2 sm:mt-3 text-center">
                <p className="text-white/40 text-[10px] sm:text-xs">
                  Powered by Stripe
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
