"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  TrendingUp,
  IndianRupee,
  Users,
  CreditCard,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  ShieldAlert,
  Calendar,
  PieChart,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  ArrowUpDown,
  Package,
  X,
  HelpCircle,
  Megaphone,
  Eye,
  MousePointerClick,
  Target,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  FileSpreadsheet,
  Facebook,
  TrendingDown,
} from "lucide-react";

import React from "react";

// Tab type
type TabType = "dashboard" | "profit-sheet" | "meta-details";

// Profit Sheet row interface
interface ProfitSheetRow {
  date: string;           // Costa Rica date (e.g., "2026-03-13")
  day: string;            // Day of week (e.g., "Sat")
  revenue: number;        // PayU revenue for that Costa Rica day
  gst: number;            // 5% of revenue
  adsCostUSD: number;     // Meta Ads spend in USD
  adsCostINR: number;     // Meta Ads spend converted to INR
  netRevenue: number;     // Revenue - GST - Ads Cost (INR)
  roas: number;           // Revenue / Ads Cost INR (if ads cost > 0)
  transactionCount: number;
}

// Meta Ads Breakdown interfaces
interface MetaAdMetrics {
  id: string;
  name: string;
  status: string;
  spend: number;
  budget: number | null;
  impressions: number;
  clicks: number;
  cpc: number;
  cpm: number;
  ctr: number;
  purchases: number;
  costPerPurchase: number;
  reach: number;
}

interface MetaAdData extends MetaAdMetrics {}

interface MetaAdSetData extends MetaAdMetrics {
  ads: MetaAdData[];
}

interface MetaCampaignData extends MetaAdMetrics {
  adsets: MetaAdSetData[];
}

interface MetaBreakdownData {
  configured: boolean;
  exchangeRate: number;
  datePreset: string;
  dateRange: { start: string; end: string };
  campaigns: MetaCampaignData[];
  revenue: {
    totalRevenue: number;
    totalSales: number;
    gst: number;
    netRevenue: number;
    totalSpendINR: number;
    profit: number;
    roas: number;
  };
  totals: {
    spend: number;
    spendINR: number;
    impressions: number;
    clicks: number;
    purchases: number;
    reach: number;
    cpc: number;
    cpm: number;
    ctr: number;
    costPerPurchase: number;
  };
}

interface RevenueData {
  currency: string;
  totalRevenue: string;
  revenueToday: string;
  revenueThisWeek: string;
  revenueThisMonth: string;
  revenueThisYear: string;
  revenueLastMonth: string;
  momGrowth: string;
  revenueByType: { bundle: number; upsell: number; coins: number; report: number };
  bundleBreakdown: {
    "palm-reading": { count: number; revenue: number };
    "palm-birth": { count: number; revenue: number };
    "palm-birth-compat": { count: number; revenue: number };
  };
  arpu: string;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  revenueOverTime: { date: string; revenue: number }[];
  recentTransactions: {
    id: string;
    date: string;
    userId: string;
    userEmail: string;
    userName: string;
    amount: number;
    bundleId: string;
    type: string;
    status: string;
  }[];
  totalUsers: number;
  uniquePayingUsers: number;
  customDateRevenue?: string;
  customDatePaymentCount?: number;
  customDateTransactions?: {
    id: string;
    date: string;
    userId: string;
    userEmail: string;
    userName: string;
    amount: number;
    bundleId: string;
    type: string;
    status: string;
  }[];
  customDateRange?: { start: string; end: string };
}

interface MetaAdsData {
  configured: boolean;
  error?: string;
  datePreset?: string;
  account?: {
    spend: number;
    impressions: number;
    clicks: number;
    cpc: number;
    cpm: number;
    ctr: number;
    reach: number;
    frequency: number;
    linkClicks: number;
    leads: number;
    purchases: number;
    addToCart: number;
    initiateCheckout: number;
    pageViews: number;
    costPerLead: number;
    costPerPurchase: number;
    costPerLinkClick: number;
  };
  campaigns?: {
    name: string;
    id: string;
    spend: number;
    impressions: number;
    clicks: number;
    cpc: number;
    ctr: number;
    reach: number;
    leads: number;
    purchases: number;
    linkClicks: number;
    costPerLead: number;
    costPerPurchase: number;
  }[];
  dailyBreakdown?: {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    reach: number;
    linkClicks: number;
  }[];
  activeCampaigns?: {
    name: string;
    status: string;
    objective: string;
    dailyBudget: number | null;
    lifetimeBudget: number | null;
  }[];
  activeCampaignCount?: number;
}

export default function AdminRevenuePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RevenueData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterBundle, setFilterBundle] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");

  // Date picker with time and timezone
  const [selectedStartDate, setSelectedStartDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedEndDate, setSelectedEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedStartTime, setSelectedStartTime] = useState<string>("11:30");
  const [selectedEndTime, setSelectedEndTime] = useState<string>("11:30");
  const [selectedTimezone, setSelectedTimezone] = useState<string>("ist");
  const [dateLoading, setDateLoading] = useState(false);
  const [usePayU, setUsePayU] = useState<boolean>(true); // Default to PayU for accurate data

  // Sorting
  const [sortField, setSortField] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Meta Ads
  const [metaAds, setMetaAds] = useState<MetaAdsData | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaDatePreset, setMetaDatePreset] = useState<string>("last_30d");
  const [showMetaCampaigns, setShowMetaCampaigns] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  
  // Profit Sheet state
  const [profitSheetData, setProfitSheetData] = useState<ProfitSheetRow[]>([]);
  const [profitSheetLoading, setProfitSheetLoading] = useState(false);
  const [profitSheetStartDate, setProfitSheetStartDate] = useState<string>("2026-03-13");
  const [profitSheetEndDate, setProfitSheetEndDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [profitSheetFilter, setProfitSheetFilter] = useState<string>("all");
  const [profitSheetRoasFilter, setProfitSheetRoasFilter] = useState<string>("all");
  const [profitSheetExchangeRate, setProfitSheetExchangeRate] = useState<number>(85);
  const [profitSheetCustomExchangeRate, setProfitSheetCustomExchangeRate] = useState<string>("");

  // Meta Breakdown state
  const [metaBreakdown, setMetaBreakdown] = useState<MetaBreakdownData | null>(null);
  const [metaBreakdownLoading, setMetaBreakdownLoading] = useState(false);
  const [metaBreakdownDatePreset, setMetaBreakdownDatePreset] = useState<string>("last_7d");
  const [metaBreakdownExchangeRate, setMetaBreakdownExchangeRate] = useState<string>("");
  const [metaBreakdownStartDate, setMetaBreakdownStartDate] = useState<string>("");
  const [metaBreakdownEndDate, setMetaBreakdownEndDate] = useState<string>("");
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set());
  const [expandedAdsets, setExpandedAdsets] = useState<Set<string>>(new Set());

  // Backfill
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const runBackfill = async () => {
    try {
      setBackfillLoading(true);
      setBackfillResult(null);
      const token = localStorage.getItem("admin_session_token");
      const response = await fetch(`/api/admin/backfill-payments?token=${token}`, {
        method: "POST",
      });
      const result = await response.json();
      if (result.success) {
        setBackfillResult(`Created ${result.summary.created} payment records, skipped ${result.summary.skipped}`);
        // Refresh data after backfill
        fetchData();
      } else {
        setBackfillResult(`Error: ${result.error}`);
      }
    } catch (err: any) {
      setBackfillResult(`Error: ${err.message}`);
    } finally {
      setBackfillLoading(false);
    }
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const fetchData = async () => {
    try {
      setRefreshing(true);
      setDateLoading(true);

      const token = localStorage.getItem("admin_session_token");
      const expiry = localStorage.getItem("admin_session_expiry");

      if (!token || !expiry || new Date(expiry) < new Date()) {
        localStorage.removeItem("admin_session_token");
        localStorage.removeItem("admin_session_expiry");
        router.push("/admin/login");
        return;
      }

      let url: string;
      if (usePayU) {
        url = `/api/admin/revenue-payu?token=${token}&_t=${Date.now()}`;
        url += `&startDate=${selectedStartDate}&endDate=${selectedEndDate}`;
        url += `&startTime=${selectedStartTime}&endTime=${selectedEndTime}`;
        url += `&timezone=${selectedTimezone}`;
      } else {
        url = `/api/admin/revenue?token=${token}&_t=${Date.now()}`;
        if (selectedStartDate) {
          url += `&startDate=${selectedStartDate}&endDate=${selectedEndDate}`;
          url += `&startTime=${selectedStartTime}&endTime=${selectedEndTime}`;
        }
      }
      const response = await fetch(url, { cache: "no-store" });

      if (response.status === 401) {
        localStorage.removeItem("admin_session_token");
        localStorage.removeItem("admin_session_expiry");
        router.push("/admin/login");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.details || "Failed to fetch revenue data");
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err: any) {
      console.error("Revenue fetch error:", err.message);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setDateLoading(false);
    }
  };

  const fetchMetaAds = async (preset?: string, customStart?: string, customEnd?: string) => {
    try {
      setMetaLoading(true);
      const token = localStorage.getItem("admin_session_token");
      if (!token) return;
      
      let url = `/api/admin/meta-ads?token=${token}`;
      
      // Use custom date range if provided
      if (customStart && customEnd) {
        url += `&startDate=${customStart}&endDate=${customEnd}`;
      } else {
        const dp = preset || metaDatePreset;
        url += `&datePreset=${dp}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        setMetaAds(result);
      }
    } catch (err) {
      console.error("Meta ads fetch error:", err);
    } finally {
      setMetaLoading(false);
    }
  };

  // Fetch Profit Sheet data
  const fetchProfitSheet = async (customRate?: number) => {
    try {
      setProfitSheetLoading(true);
      const token = localStorage.getItem("admin_session_token");
      if (!token) return;
      
      let url = `/api/admin/profit-sheet?token=${token}&startDate=${profitSheetStartDate}&endDate=${profitSheetEndDate}`;
      
      // Use custom exchange rate if provided
      const rateToUse = customRate || (profitSheetCustomExchangeRate ? parseFloat(profitSheetCustomExchangeRate) : undefined);
      if (rateToUse) {
        url += `&exchangeRate=${rateToUse}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        setProfitSheetData(result.rows || []);
        if (result.exchangeRate) {
          setProfitSheetExchangeRate(result.exchangeRate);
          if (!profitSheetCustomExchangeRate) {
            setProfitSheetCustomExchangeRate(result.exchangeRate.toFixed(2));
          }
        }
      }
    } catch (err) {
      console.error("Profit sheet fetch error:", err);
    } finally {
      setProfitSheetLoading(false);
    }
  };

  // Fetch Meta Breakdown data
  const fetchMetaBreakdown = async (customRate?: number, startDate?: string, endDate?: string) => {
    try {
      setMetaBreakdownLoading(true);
      const token = localStorage.getItem("admin_session_token");
      if (!token) return;
      
      let url = `/api/admin/meta-ads-breakdown?token=${token}`;
      
      // Use custom dates if provided, otherwise use preset
      const useStartDate = startDate || metaBreakdownStartDate;
      const useEndDate = endDate || metaBreakdownEndDate;
      
      if (useStartDate && useEndDate) {
        url += `&startDate=${useStartDate}&endDate=${useEndDate}`;
      } else {
        url += `&datePreset=${metaBreakdownDatePreset}`;
      }
      
      const rateToUse = customRate || (metaBreakdownExchangeRate ? parseFloat(metaBreakdownExchangeRate) : undefined);
      if (rateToUse) {
        url += `&exchangeRate=${rateToUse}`;
      }
      
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        setMetaBreakdown(result);
        if (result.exchangeRate && !metaBreakdownExchangeRate) {
          setMetaBreakdownExchangeRate(result.exchangeRate.toFixed(2));
        }
      }
    } catch (err) {
      console.error("Meta breakdown fetch error:", err);
    } finally {
      setMetaBreakdownLoading(false);
    }
  };

  // Toggle campaign expansion
  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns(prev => {
      const next = new Set(prev);
      if (next.has(campaignId)) {
        next.delete(campaignId);
      } else {
        next.add(campaignId);
      }
      return next;
    });
  };

  // Toggle adset expansion
  const toggleAdset = (adsetId: string) => {
    setExpandedAdsets(prev => {
      const next = new Set(prev);
      if (next.has(adsetId)) {
        next.delete(adsetId);
      } else {
        next.add(adsetId);
      }
      return next;
    });
  };

  useEffect(() => {
    fetchData();
    fetchMetaAds();
  }, [router, selectedStartDate, selectedEndDate, selectedStartTime, selectedEndTime, selectedTimezone, usePayU]);

  useEffect(() => {
    fetchMetaAds(metaDatePreset);
  }, [metaDatePreset]);

  // Fetch profit sheet when tab changes or date range changes
  useEffect(() => {
    if (activeTab === "profit-sheet") {
      fetchProfitSheet();
    }
  }, [activeTab, profitSheetStartDate, profitSheetEndDate]);

  // Fetch meta breakdown when tab changes or date preset changes
  useEffect(() => {
    if (activeTab === "meta-details") {
      fetchMetaBreakdown();
    }
  }, [activeTab, metaBreakdownDatePreset]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-white text-xl font-semibold mb-2">Error</h1>
          <p className="text-white/60 mb-6">{error}</p>
          <button
            onClick={() => router.push("/admin/login")}
            className="px-6 py-2 bg-primary text-white rounded-lg"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(num);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatSelectedDate = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
  };

  // Filter transactions
  const getFilteredTransactions = () => {
    let filtered = [...(data.recentTransactions || [])];

    if (filterType !== "all") {
      filtered = filtered.filter((tx) => tx.type === filterType);
    }
    if (filterBundle !== "all") {
      filtered = filtered.filter((tx) => tx.bundleId === filterBundle);
    }
    if (filterStatus !== "all") {
      filtered = filtered.filter((tx) => tx.status === filterStatus);
    }
    if (filterDateRange !== "all") {
      const now = new Date();
      let startDate: Date;
      switch (filterDateRange) {
        case "today":
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "week":
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        default:
          startDate = new Date(0);
      }
      filtered = filtered.filter((tx) => new Date(tx.date) >= startDate);
    }

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortField) {
        case "date":
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
          break;
        case "amount":
          aVal = a.amount;
          bVal = b.amount;
          break;
        case "user":
          aVal = a.userName || a.userEmail;
          bVal = b.userName || b.userEmail;
          break;
        case "type":
          aVal = a.type || "";
          bVal = b.type || "";
          break;
        default:
          aVal = new Date(a.date).getTime();
          bVal = new Date(b.date).getTime();
      }
      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });

    return filtered;
  };

  const clearFilters = () => {
    setFilterType("all");
    setFilterBundle("all");
    setFilterStatus("all");
    setFilterDateRange("all");
  };

  const hasActiveFilters = filterType !== "all" || filterBundle !== "all" || filterStatus !== "all" || filterDateRange !== "all";
  const filteredTransactions = getFilteredTransactions();

  const selectedDateRevenue = data.customDateRevenue ? parseFloat(data.customDateRevenue) : 0;
  const selectedDateTransactions = data.customDateTransactions || [];
  const selectedDatePaymentCount = data.customDatePaymentCount || 0;

  const maxRevenue = Math.max(...(data.revenueOverTime || []).map((d) => d.revenue), 1);

  // Bundle breakdown
  const bb = data.bundleBreakdown || { "palm-reading": { count: 0, revenue: 0 }, "palm-birth": { count: 0, revenue: 0 }, "palm-birth-compat": { count: 0, revenue: 0 } };
  const totalBundleRevenue = bb["palm-reading"].revenue + bb["palm-birth"].revenue + bb["palm-birth-compat"].revenue;
  const totalBundleCount = bb["palm-reading"].count + bb["palm-birth"].count + bb["palm-birth-compat"].count;

  // Revenue by type
  const rbt = data.revenueByType || { bundle: 0, upsell: 0, coins: 0, report: 0 };
  const totalTypeRevenue = rbt.bundle + rbt.upsell + rbt.coins + rbt.report;

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-24">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1A1F2E] to-transparent px-4 pt-12 pb-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
                onClick={() => router.push("/admin")}
                className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-white/70 text-sm"
              >
                ←
              </button>
            <h1 className="text-2xl font-bold text-white">Revenue Dashboard</h1>
            <div className="flex items-center gap-2">
              {data && data.totalPayments === 0 && data.uniquePayingUsers > 0 && (
                <button
                  onClick={runBackfill}
                  disabled={backfillLoading}
                  className="px-3 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 transition-colors text-yellow-400 text-sm flex items-center gap-2"
                >
                  {backfillLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                  Recover Payments
                </button>
              )}
              <button
                onClick={() => {
                  if (activeTab === "dashboard") fetchData();
                  else if (activeTab === "profit-sheet") fetchProfitSheet();
                  else if (activeTab === "meta-details") fetchMetaAds();
                }}
                disabled={refreshing || profitSheetLoading || metaLoading}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              >
                <RefreshCw className={`w-5 h-5 text-white ${(refreshing || profitSheetLoading || metaLoading) ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "dashboard"
                  ? "bg-primary text-white shadow-lg"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("profit-sheet")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "profit-sheet"
                  ? "bg-primary text-white shadow-lg"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Profit Sheet
            </button>
            <button
              onClick={() => setActiveTab("meta-details")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "meta-details"
                  ? "bg-primary text-white shadow-lg"
                  : "text-white/60 hover:text-white hover:bg-white/10"
              }`}
            >
              <Facebook className="w-4 h-4" />
              Meta Details
            </button>
          </div>
          
          {backfillResult && (
            <div className={`mt-2 px-3 py-2 rounded-lg text-sm ${backfillResult.startsWith("Error") ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
              {backfillResult}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 space-y-6">
        {/* Dashboard Tab Content */}
        {activeTab === "dashboard" && (
          <>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              showFilters || hasActiveFilters ? "bg-primary/20 text-primary" : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm transition-colors"
            >
              <X className="w-4 h-4" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-[#1A2235] rounded-xl p-4 border border-white/10"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-white/50 text-xs mb-2 block">Date Range</label>
                <select
                  value={filterDateRange}
                  onChange={(e) => setFilterDateRange(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>
              <div>
                <label className="text-white/50 text-xs mb-2 block">Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Types</option>
                  <option value="bundle">Bundle</option>
                  <option value="upsell">Upsell</option>
                  <option value="coins">Coins</option>
                  <option value="report">Report</option>
                </select>
              </div>
              <div>
                <label className="text-white/50 text-xs mb-2 block">Bundle</label>
                <select
                  value={filterBundle}
                  onChange={(e) => setFilterBundle(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Bundles</option>
                  <option value="palm-reading">Palm Reading</option>
                  <option value="palm-birth">Palm + Birth Chart</option>
                  <option value="palm-birth-compat">Palm + Birth + Compat</option>
                </select>
              </div>
              <div>
                <label className="text-white/50 text-xs mb-2 block">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                >
                  <option value="all">All Status</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="created">Pending</option>
                </select>
              </div>
            </div>

            {/* Sort Options */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <label className="text-white/50 text-xs mb-2 block">Sort Transactions By</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { field: "date", label: "Date" },
                  { field: "amount", label: "Amount" },
                  { field: "user", label: "User" },
                  { field: "type", label: "Type" },
                ].map(({ field, label }) => (
                  <button
                    key={field}
                    onClick={() => {
                      if (sortField === field) {
                        setSortDirection(sortDirection === "asc" ? "desc" : "asc");
                      } else {
                        setSortField(field);
                        setSortDirection("desc");
                      }
                    }}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      sortField === field ? "bg-primary/20 text-primary" : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {label}
                    {sortField === field && (
                      <ArrowUpDown className={`w-3 h-3 ${sortDirection === "asc" ? "rotate-180" : ""}`} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Primary KPIs */}
        <section>
          <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
            <IndianRupee className="w-4 h-4" /> Primary KPIs
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              title="Total Revenue"
              value={formatCurrency(data.totalRevenue)}
              subtitle="All time"
              icon={<IndianRupee className="w-4 h-4" />}
              color="text-green-400"
              tooltip="Total revenue from all paid Razorpay payments."
            />
            <KPICard
              title="ARPU"
              value={formatCurrency(data.arpu)}
              subtitle="Avg Revenue Per User"
              icon={<Users className="w-4 h-4" />}
              color="text-purple-400"
              tooltip="Average Revenue Per User: Total revenue divided by unique paying users."
            />
            <KPICard
              title="MoM Growth"
              value={data.momGrowth === "N/A" ? "N/A" : `${data.momGrowth}%`}
              subtitle="vs last month"
              icon={parseFloat(data.momGrowth) >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              color={data.momGrowth === "N/A" ? "text-white/50" : parseFloat(data.momGrowth) >= 0 ? "text-green-400" : "text-red-400"}
              tooltip="Month-over-Month Growth: Percentage change in revenue compared to the previous month."
            />
            <KPICard
              title="Paying Users"
              value={data.uniquePayingUsers.toString()}
              subtitle={`of ${data.totalUsers} total`}
              icon={<Users className="w-4 h-4" />}
              color="text-blue-400"
              tooltip="Number of unique users who have made at least one payment."
            />
          </div>
        </section>

        {/* Date Range Selector with Time & Timezone */}
        <section className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white/70 text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Date Range & Data Source
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setUsePayU(!usePayU)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${usePayU ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white/60'}`}
              >
                {usePayU ? '✓ PayU (Live)' : '✓ Supabase'}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Start Date & Time */}
            <div>
              <label className="text-white/50 text-xs mb-2 block">Start Date</label>
              <input
                type="date"
                value={selectedStartDate}
                min="2026-03-13"
                onChange={(e) => setSelectedStartDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-2 block">Start Time</label>
              <input
                type="time"
                value={selectedStartTime}
                onChange={(e) => setSelectedStartTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
              />
            </div>
            
            {/* End Date & Time */}
            <div>
              <label className="text-white/50 text-xs mb-2 block">End Date</label>
              <input
                type="date"
                value={selectedEndDate}
                min="2026-03-13"
                onChange={(e) => setSelectedEndDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-2 block">End Time</label>
              <input
                type="time"
                value={selectedEndTime}
                onChange={(e) => setSelectedEndTime(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
              />
            </div>
          </div>
          
          {/* Timezone & Quick Presets */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-white/50 text-xs">Timezone:</label>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary/50"
              >
                <option value="costa_rica">Costa Rica (UTC-6)</option>
                <option value="ist">India (IST UTC+5:30)</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => {
                  const today = new Date().toISOString().split("T")[0];
                  setSelectedStartDate(today);
                  setSelectedEndDate(today);
                  setSelectedStartTime("00:00");
                  setSelectedEndTime("23:59");
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-white/60 bg-white/10 hover:bg-white/20 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  setSelectedStartDate(yesterday.toISOString().split("T")[0]);
                  setSelectedEndDate(yesterday.toISOString().split("T")[0]);
                  setSelectedStartTime("00:00");
                  setSelectedEndTime("23:59");
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-white/60 bg-white/10 hover:bg-white/20 transition-colors"
              >
                Yesterday
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  setSelectedStartDate(weekAgo.toISOString().split("T")[0]);
                  setSelectedEndDate(today.toISOString().split("T")[0]);
                  setSelectedStartTime("00:00");
                  setSelectedEndTime("23:59");
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-white/60 bg-white/10 hover:bg-white/20 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  setSelectedStartDate("2026-03-13");
                  setSelectedEndDate(new Date().toISOString().split("T")[0]);
                  setSelectedStartTime("00:00");
                  setSelectedEndTime("23:59");
                }}
                className="px-3 py-1.5 rounded-lg text-xs text-white/60 bg-white/10 hover:bg-white/20 transition-colors"
              >
                All Time
              </button>
            </div>
          </div>
          
          {/* Info about timezone */}
          {selectedTimezone === "costa_rica" && (
            <div className="mt-3 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-blue-400 text-xs">
                📍 Times are in Costa Rica timezone (UTC-6). IST is 11.5 hours ahead.
                <br />
                Example: 11:30 AM Costa Rica = 11:00 PM IST (same day) → 12:00 AM IST (next day)
              </p>
            </div>
          )}
        </section>

        {/* Revenue by Period */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white/70 text-sm font-medium flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Revenue Summary
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10 relative">
              {dateLoading && (
                <div className="absolute inset-0 bg-[#1A2235]/80 rounded-xl flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                </div>
              )}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-white/50 text-xs">Selected Range</span>
                  <Tooltip content="Revenue for the selected date range." />
                </div>
                <span className="text-green-400"><IndianRupee className="w-4 h-4" /></span>
              </div>
              <p className="text-xl font-bold text-green-400">{formatCurrency(selectedDateRevenue)}</p>
              <p className="text-white/40 text-xs mt-1">{selectedDatePaymentCount} payments</p>
              <p className="text-white/30 text-xs mt-1">{selectedStartDate} to {selectedEndDate}</p>
            </div>
            <MetricCard title="This Week" value={formatCurrency(data.revenueThisWeek)} tooltip="Revenue generated this week (Sunday to today)." />
            <MetricCard title="This Month" value={formatCurrency(data.revenueThisMonth)} tooltip="Revenue generated this month (1st to today)." />
            <MetricCard title="This Year" value={formatCurrency(data.revenueThisYear)} tooltip="Revenue generated this year (Jan 1st to today)." />
          </div>

          {/* Transactions for selected date */}
          {dateLoading && (
            <div className="mt-4 bg-[#1A2235] rounded-xl p-6 border border-white/10 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              <p className="text-white/40 text-sm">Loading transactions...</p>
            </div>
          )}
          {!dateLoading && selectedDateTransactions.length > 0 && (
            <div className="mt-4 bg-[#1A2235] rounded-xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-white/60 text-xs">
                  {selectedDatePaymentCount} transaction{selectedDatePaymentCount !== 1 ? "s" : ""} from {selectedStartDate} to {selectedEndDate}
                </p>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-[#1A2235]">
                    <tr className="border-b border-white/10">
                      <th className="text-left text-white/50 text-xs font-medium px-4 py-2">Time</th>
                      <th className="text-left text-white/50 text-xs font-medium px-4 py-2">User</th>
                      <th className="text-left text-white/50 text-xs font-medium px-4 py-2">Type</th>
                      <th className="text-left text-white/50 text-xs font-medium px-4 py-2">Bundle</th>
                      <th className="text-right text-white/50 text-xs font-medium px-4 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDateTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="text-white/70 text-sm px-4 py-2">{formatDate(tx.date)}</td>
                        <td className="px-4 py-2">
                          <p className="text-white/80 text-sm">{tx.userName !== "Unknown" ? tx.userName : tx.userEmail?.split("@")[0] || "Unknown"}</p>
                          <p className="text-white/40 text-xs">{tx.userEmail}</p>
                        </td>
                        <td className="text-white/70 text-sm px-4 py-2 capitalize">{tx.type || "bundle"}</td>
                        <td className="text-white/70 text-sm px-4 py-2 capitalize">{(tx.bundleId || "-").replace(/-/g, " ")}</td>
                        <td className="text-white text-sm px-4 py-2 text-right font-medium">{formatCurrency(tx.amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {!dateLoading && selectedDateTransactions.length === 0 && selectedStartDate && (
            <div className="mt-4 bg-[#1A2235] rounded-xl p-4 border border-white/10 text-center">
              <p className="text-white/40 text-sm">No transactions from {selectedStartDate} to {selectedEndDate}</p>
            </div>
          )}
        </section>
        
        {/* Meta / Facebook Ads */}
        <MetaAdsSection
          metaAds={metaAds}
          metaLoading={metaLoading}
          metaDatePreset={metaDatePreset}
          setMetaDatePreset={setMetaDatePreset}
          showMetaCampaigns={showMetaCampaigns}
          setShowMetaCampaigns={setShowMetaCampaigns}
          formatCurrency={formatCurrency}
          onRefresh={() => fetchMetaAds()}
          onCustomDateRefresh={(startDate, endDate) => fetchMetaAds(undefined, startDate, endDate)}
        />

        {/* Bundle Breakdown */}
        <section>
          <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" /> Bundle Breakdown
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue by Bundle */}
            <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
              <h3 className="text-white/60 text-xs mb-3">Revenue by Bundle</h3>
              <div className="space-y-3">
                <PlanBar label="Palm Reading" value={bb["palm-reading"].revenue} total={totalBundleRevenue} color="bg-amber-500" count={bb["palm-reading"].count} />
                <PlanBar label="Palm + Birth Chart" value={bb["palm-birth"].revenue} total={totalBundleRevenue} color="bg-purple-500" count={bb["palm-birth"].count} />
                <PlanBar label="Palm + Birth + Compat" value={bb["palm-birth-compat"].revenue} total={totalBundleRevenue} color="bg-green-500" count={bb["palm-birth-compat"].count} />
              </div>
              <div className="mt-3 pt-3 border-t border-white/10 flex justify-between">
                <span className="text-white/50 text-xs">Total</span>
                <span className="text-white text-xs font-semibold">{totalBundleCount} sales • {formatCurrency(totalBundleRevenue)}</span>
              </div>
            </div>

            {/* Revenue by Type */}
            <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
              <h3 className="text-white/60 text-xs mb-3">Revenue by Type</h3>
              <div className="space-y-3">
                <PlanBar label="Bundles" value={rbt.bundle} total={totalTypeRevenue} color="bg-indigo-500" />
                <PlanBar label="Upsells" value={rbt.upsell} total={totalTypeRevenue} color="bg-cyan-500" />
                <PlanBar label="Coins" value={rbt.coins} total={totalTypeRevenue} color="bg-amber-500" />
                <PlanBar label="Reports" value={rbt.report} total={totalTypeRevenue} color="bg-pink-500" />
              </div>
            </div>
          </div>

          {/* Bundle Distribution Donut */}
          <div className="mt-4 bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <h3 className="text-white/60 text-xs mb-3">Bundle Distribution</h3>
            <div className="flex items-center justify-center gap-8">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  {(() => {
                    if (totalBundleCount === 0) return <circle cx="18" cy="18" r="15.9" fill="none" stroke="#374151" strokeWidth="3" />;
                    const segments = [
                      { value: bb["palm-reading"].count, color: "#F59E0B" },
                      { value: bb["palm-birth"].count, color: "#8B5CF6" },
                      { value: bb["palm-birth-compat"].count, color: "#22C55E" },
                    ].filter((s) => s.value > 0);
                    let offset = 0;
                    return segments.map((seg, i) => {
                      const pct = (seg.value / totalBundleCount) * 100;
                      const circle = (
                        <circle
                          key={i}
                          cx="18" cy="18" r="15.9"
                          fill="none"
                          stroke={seg.color}
                          strokeWidth="3"
                          strokeDasharray={`${pct} ${100 - pct}`}
                          strokeDashoffset={-offset}
                        />
                      );
                      offset += pct;
                      return circle;
                    });
                  })()}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">{totalBundleCount}</span>
                </div>
              </div>
              <div className="space-y-2">
                {bb["palm-reading"].count > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-white/70 text-sm">Palm Reading: {bb["palm-reading"].count}</span>
                  </div>
                )}
                {bb["palm-birth"].count > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-white/70 text-sm">Palm + Birth: {bb["palm-birth"].count}</span>
                  </div>
                )}
                {bb["palm-birth-compat"].count > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-white/70 text-sm">Palm + Birth + Compat: {bb["palm-birth-compat"].count}</span>
                  </div>
                )}
                {totalBundleCount === 0 && (
                  <span className="text-white/40 text-sm">No sales yet</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Transaction Activity */}
        <section>
          <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Transaction Activity
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard
              title="Successful"
              value={(data.successfulPayments || 0).toString()}
              icon={<CheckCircle className="w-4 h-4" />}
              color="text-green-400"
              tooltip="Total number of successful (paid) payment transactions."
            />
            <KPICard
              title="Failed"
              value={(data.failedPayments || 0).toString()}
              icon={<XCircle className="w-4 h-4" />}
              color="text-red-400"
              tooltip="Number of failed payment attempts."
            />
            <KPICard
              title="Pending"
              value={(data.pendingPayments || 0).toString()}
              icon={<Clock className="w-4 h-4" />}
              color="text-amber-400"
              tooltip="Payments that were created but not yet completed."
            />
            <KPICard
              title="Total"
              value={(data.totalPayments || 0).toString()}
              icon={<CreditCard className="w-4 h-4" />}
              color="text-white"
              tooltip="Total number of payment records across all statuses."
            />
          </div>
        </section>

        {/* Revenue Over Time Chart */}
        <section>
          <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Revenue Over Time (Last 30 Days)
          </h2>
          <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <div className="flex items-end gap-1 h-40">
              {(data.revenueOverTime || []).map((day) => (
                <div
                  key={day.date}
                  className="flex-1 bg-primary/20 hover:bg-primary/40 transition-colors rounded-t relative group"
                  style={{ height: `${Math.max((day.revenue / maxRevenue) * 100, 2)}%` }}
                >
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    {day.date}: {formatCurrency(day.revenue)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/40">
              <span>{data.revenueOverTime?.[0]?.date}</span>
              <span>{data.revenueOverTime?.[data.revenueOverTime.length - 1]?.date}</span>
            </div>
          </div>
        </section>

        {/* Users Summary */}
        <section>
          <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Users
          </h2>
          <div className="bg-[#1A2235] rounded-xl border border-white/10 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-white/40 text-xs">Total Users</p>
                <p className="text-white text-lg font-semibold">{data.totalUsers}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Paying Users</p>
                <p className="text-green-400 text-lg font-semibold">{data.uniquePayingUsers}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Conversion Rate</p>
                <p className="text-blue-400 text-lg font-semibold">
                  {data.totalUsers > 0 ? ((data.uniquePayingUsers / data.totalUsers) * 100).toFixed(1) : "0"}%
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Transactions */}
        <section>
          <h2 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Recent Transactions
            {hasActiveFilters && (
              <span className="text-xs text-primary ml-2">
                ({filteredTransactions.length} of {(data.recentTransactions || []).length} shown)
              </span>
            )}
          </h2>
          <div className="bg-[#1A2235] rounded-xl border border-white/10 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Date</th>
                    <th className="text-left text-white/50 text-xs font-medium px-4 py-3">User</th>
                    <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Type</th>
                    <th className="text-left text-white/50 text-xs font-medium px-4 py-3">Bundle</th>
                    <th className="text-right text-white/50 text-xs font-medium px-4 py-3">Amount</th>
                    <th className="text-center text-white/50 text-xs font-medium px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-white/40 py-8">
                        {hasActiveFilters ? "No transactions match your filters" : "No transactions yet"}
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="text-white/70 text-sm px-4 py-3">{formatDate(tx.date)}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-white/80 text-sm">{tx.userName !== "Unknown" ? tx.userName : tx.userEmail?.split("@")[0] || "Unknown"}</p>
                            <p className="text-white/40 text-xs">{tx.userEmail}</p>
                          </div>
                        </td>
                        <td className="text-white/70 text-sm px-4 py-3 capitalize">{tx.type || "bundle"}</td>
                        <td className="text-white/70 text-sm px-4 py-3 capitalize">{(tx.bundleId || "-").replace(/-/g, " ")}</td>
                        <td className="text-white text-sm px-4 py-3 text-right font-medium">{formatCurrency(tx.amount || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                              tx.status === "paid"
                                ? "bg-green-500/20 text-green-400"
                                : tx.status === "failed"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-gray-500/20 text-gray-400"
                            }`}
                          >
                            {tx.status === "paid" && <CheckCircle className="w-3 h-3" />}
                            {tx.status === "failed" && <XCircle className="w-3 h-3" />}
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Summary Stats */}
        <section className="pb-8">
          <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-white/40 text-xs">Total Payments</p>
                <p className="text-white text-lg font-semibold">{data.totalPayments}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Total Users</p>
                <p className="text-white text-lg font-semibold">{data.totalUsers}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Paying Users</p>
                <p className="text-white text-lg font-semibold">{data.uniquePayingUsers}</p>
              </div>
            </div>
          </div>
        </section>
          </>
        )}

        {/* Profit Sheet Tab Content */}
        {activeTab === "profit-sheet" && (
          <ProfitSheetTab
            data={profitSheetData}
            loading={profitSheetLoading}
            startDate={profitSheetStartDate}
            endDate={profitSheetEndDate}
            setStartDate={setProfitSheetStartDate}
            setEndDate={setProfitSheetEndDate}
            periodFilter={profitSheetFilter}
            setPeriodFilter={setProfitSheetFilter}
            roasFilter={profitSheetRoasFilter}
            setRoasFilter={setProfitSheetRoasFilter}
            exchangeRate={profitSheetCustomExchangeRate}
            setExchangeRate={setProfitSheetCustomExchangeRate}
            onRefresh={() => fetchProfitSheet()}
            onRefreshWithRate={(rate) => fetchProfitSheet(rate)}
          />
        )}

        {/* Meta Details Tab Content */}
        {activeTab === "meta-details" && (
          <MetaBreakdownTab
            data={metaBreakdown}
            loading={metaBreakdownLoading}
            datePreset={metaBreakdownDatePreset}
            setDatePreset={setMetaBreakdownDatePreset}
            startDate={metaBreakdownStartDate}
            setStartDate={setMetaBreakdownStartDate}
            endDate={metaBreakdownEndDate}
            setEndDate={setMetaBreakdownEndDate}
            exchangeRate={metaBreakdownExchangeRate}
            setExchangeRate={setMetaBreakdownExchangeRate}
            expandedCampaigns={expandedCampaigns}
            expandedAdsets={expandedAdsets}
            toggleCampaign={toggleCampaign}
            toggleAdset={toggleAdset}
            onRefresh={() => fetchMetaBreakdown()}
            onRefreshWithRate={(rate) => fetchMetaBreakdown(rate)}
            onCustomDateRefresh={(start, end) => fetchMetaBreakdown(undefined, start, end)}
          />
        )}
      </div>
    </div>
  );
}

// Profit Sheet Tab Component
function ProfitSheetTab({
  data,
  loading,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  periodFilter,
  setPeriodFilter,
  roasFilter,
  setRoasFilter,
  exchangeRate,
  setExchangeRate,
  onRefresh,
  onRefreshWithRate,
}: {
  data: ProfitSheetRow[];
  loading: boolean;
  startDate: string;
  endDate: string;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  periodFilter: string;
  setPeriodFilter: (v: string) => void;
  roasFilter: string;
  setRoasFilter: (v: string) => void;
  exchangeRate: string;
  setExchangeRate: (v: string) => void;
  onRefresh: () => void;
  onRefreshWithRate: (rate: number) => void;
}) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filter data based on filters
  let filteredData = [...data];

  // Period filter
  if (periodFilter === "last7") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    filteredData = filteredData.filter(row => new Date(row.date) >= cutoff);
  } else if (periodFilter === "last14") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    filteredData = filteredData.filter(row => new Date(row.date) >= cutoff);
  } else if (periodFilter === "last30") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    filteredData = filteredData.filter(row => new Date(row.date) >= cutoff);
  }

  // ROAS filter
  if (roasFilter === "positive") {
    filteredData = filteredData.filter(row => row.roas > 1);
  } else if (roasFilter === "negative") {
    filteredData = filteredData.filter(row => row.roas > 0 && row.roas <= 1);
  } else if (roasFilter === "noads") {
    filteredData = filteredData.filter(row => row.adsCostINR === 0);
  }

  // Calculate totals
  const totals = filteredData.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      gst: acc.gst + row.gst,
      adsCostUSD: acc.adsCostUSD + row.adsCostUSD,
      adsCostINR: acc.adsCostINR + row.adsCostINR,
      netRevenue: acc.netRevenue + row.netRevenue,
      transactionCount: acc.transactionCount + row.transactionCount,
    }),
    { revenue: 0, gst: 0, adsCostUSD: 0, adsCostINR: 0, netRevenue: 0, transactionCount: 0 }
  );
  const overallRoas = totals.adsCostINR > 0 ? totals.revenue / totals.adsCostINR : 0;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">Period</label>
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
            >
              <option value="all">All Time</option>
              <option value="last7">Last 7 Days</option>
              <option value="last14">Last 14 Days</option>
              <option value="last30">Last 30 Days</option>
            </select>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">ROAS Filter</label>
            <select
              value={roasFilter}
              onChange={(e) => setRoasFilter(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
            >
              <option value="all">All</option>
              <option value="positive">Profitable (ROAS &gt; 1)</option>
              <option value="negative">Loss (ROAS ≤ 1)</option>
              <option value="noads">No Ads</option>
            </select>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">USD to INR Rate</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                placeholder="85.00"
              />
              <button
                onClick={() => {
                  const rate = parseFloat(exchangeRate);
                  if (rate > 0) onRefreshWithRate(rate);
                }}
                disabled={loading}
                className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <p className="text-white/30 text-xs mt-3">
          Note: Each date represents Costa Rica timezone (UTC-6). Revenue is calculated from 11:30 AM IST to next day 11:29 AM IST. Ads cost is fetched in USD and converted to INR.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Total Revenue</p>
          <p className="text-green-400 text-xl font-bold">{formatCurrency(totals.revenue)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Total GST (5%)</p>
          <p className="text-amber-400 text-xl font-bold">{formatCurrency(totals.gst)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Ads Cost (USD)</p>
          <p className="text-red-400/70 text-lg font-bold">${totals.adsCostUSD.toFixed(2)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Ads Cost (INR)</p>
          <p className="text-red-400 text-xl font-bold">{formatCurrency(totals.adsCostINR)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Net Revenue</p>
          <p className={`text-xl font-bold ${totals.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatCurrency(totals.netRevenue)}
          </p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Overall ROAS</p>
          <p className={`text-xl font-bold ${overallRoas >= 1 ? "text-green-400" : overallRoas > 0 ? "text-amber-400" : "text-white/40"}`}>
            {overallRoas > 0 ? overallRoas.toFixed(2) : "-"}
          </p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-[#1A2235] rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="ml-2 text-white/60">Loading profit sheet...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-white/70 text-xs font-semibold px-4 py-3">Date</th>
                  <th className="text-left text-white/70 text-xs font-semibold px-4 py-3">Day</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Revenue</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">GST (5%)</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Ads (USD)</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Ads (INR)</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Net Revenue</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">ROAS</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Orders</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-white/40 py-8">
                      No data available for the selected filters
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredData.map((row, idx) => (
                      <tr key={row.date} className={`border-b border-white/5 hover:bg-white/5 ${idx % 2 === 0 ? "bg-white/[0.02]" : ""}`}>
                        <td className="text-white/80 text-sm px-4 py-3">{formatDate(row.date)}</td>
                        <td className="text-white/60 text-sm px-4 py-3">{row.day}</td>
                        <td className="text-green-400 text-sm px-4 py-3 text-right font-medium">{formatCurrency(row.revenue)}</td>
                        <td className="text-amber-400/70 text-sm px-4 py-3 text-right">{formatCurrency(row.gst)}</td>
                        <td className="text-red-400/50 text-sm px-4 py-3 text-right">${row.adsCostUSD.toFixed(2)}</td>
                        <td className="text-red-400/70 text-sm px-4 py-3 text-right">{formatCurrency(row.adsCostINR)}</td>
                        <td className={`text-sm px-4 py-3 text-right font-medium ${row.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {formatCurrency(row.netRevenue)}
                        </td>
                        <td className={`text-sm px-4 py-3 text-right font-medium ${
                          row.roas >= 1 ? "text-green-400" : row.roas > 0 ? "text-amber-400" : "text-white/30"
                        }`}>
                          {row.roas > 0 ? row.roas.toFixed(2) : "-"}
                        </td>
                        <td className="text-white/60 text-sm px-4 py-3 text-right">{row.transactionCount}</td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-white/10 border-t-2 border-white/20 font-semibold">
                      <td className="text-white text-sm px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="text-green-400 text-sm px-4 py-3 text-right">{formatCurrency(totals.revenue)}</td>
                      <td className="text-amber-400 text-sm px-4 py-3 text-right">{formatCurrency(totals.gst)}</td>
                      <td className="text-red-400/70 text-sm px-4 py-3 text-right">${totals.adsCostUSD.toFixed(2)}</td>
                      <td className="text-red-400 text-sm px-4 py-3 text-right">{formatCurrency(totals.adsCostINR)}</td>
                      <td className={`text-sm px-4 py-3 text-right ${totals.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {formatCurrency(totals.netRevenue)}
                      </td>
                      <td className={`text-sm px-4 py-3 text-right ${overallRoas >= 1 ? "text-green-400" : "text-amber-400"}`}>
                        {overallRoas > 0 ? overallRoas.toFixed(2) : "-"}
                      </td>
                      <td className="text-white text-sm px-4 py-3 text-right">{totals.transactionCount}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Meta Breakdown Tab Component
function MetaBreakdownTab({
  data,
  loading,
  datePreset,
  setDatePreset,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  exchangeRate,
  setExchangeRate,
  expandedCampaigns,
  expandedAdsets,
  toggleCampaign,
  toggleAdset,
  onRefresh,
  onRefreshWithRate,
  onCustomDateRefresh,
}: {
  data: MetaBreakdownData | null;
  loading: boolean;
  datePreset: string;
  setDatePreset: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  exchangeRate: string;
  setExchangeRate: (v: string) => void;
  expandedCampaigns: Set<string>;
  expandedAdsets: Set<string>;
  toggleCampaign: (id: string) => void;
  toggleAdset: (id: string) => void;
  onRefresh: () => void;
  onRefreshWithRate: (rate: number) => void;
  onCustomDateRefresh: (start: string, end: string) => void;
}) {
  const formatUSD = (value: number) => `$${value.toFixed(2)}`;
  const formatINR = (value: number) => {
    const rate = exchangeRate ? parseFloat(exchangeRate) : 85;
    return `₹${(value * rate).toFixed(2)}`;
  };
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  // For per-campaign breakdown, we estimate using avg order value since we don't have per-campaign revenue
  const AVG_ORDER_VALUE = data?.revenue?.totalSales && data?.revenue?.totalRevenue 
    ? data.revenue.totalRevenue / data.revenue.totalSales 
    : 1500;

  // Calculate estimated profit per campaign: (Purchases × Avg Order Value) - Spend in INR
  const calculateEstimatedProfit = (purchases: number, spend: number) => {
    const rate = exchangeRate ? parseFloat(exchangeRate) : 85;
    const estimatedRevenue = purchases * AVG_ORDER_VALUE;
    const spendINR = spend * rate;
    return estimatedRevenue - spendINR;
  };

  // Calculate estimated ROAS per campaign
  const calculateEstimatedROAS = (purchases: number, spend: number) => {
    if (spend === 0 || purchases === 0) return "-";
    const rate = exchangeRate ? parseFloat(exchangeRate) : 85;
    const estimatedRevenue = purchases * AVG_ORDER_VALUE;
    const spendINR = spend * rate;
    if (spendINR === 0) return "-";
    return (estimatedRevenue / spendINR).toFixed(2);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">Quick Select</label>
            <select
              value={datePreset}
              onChange={(e) => {
                setDatePreset(e.target.value);
                setStartDate("");
                setEndDate("");
              }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_3d">Last 3 Days</option>
              <option value="last_7d">Last 7 Days</option>
              <option value="last_14d">Last 14 Days</option>
              <option value="last_30d">Last 30 Days</option>
              <option value="last_60d">Last 60 Days</option>
              <option value="last_90d">Last 90 Days</option>
              <option value="this_week">This Week</option>
              <option value="last_week">Last Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_quarter">This Quarter</option>
              <option value="last_quarter">Last Quarter</option>
              <option value="this_year">This Year</option>
              <option value="last_year">Last Year</option>
              <option value="maximum">All Time</option>
            </select>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">Or Custom Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
              />
              <span className="text-white/30">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={() => {
                  if (startDate && endDate) {
                    onCustomDateRefresh(startDate, endDate);
                  }
                }}
                disabled={loading || !startDate || !endDate}
                className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Go
              </button>
            </div>
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">USD to INR Rate</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                value={exchangeRate}
                onChange={(e) => setExchangeRate(e.target.value)}
                className="w-20 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
                placeholder="85.00"
              />
              <button
                onClick={() => {
                  const rate = parseFloat(exchangeRate);
                  if (rate > 0) onRefreshWithRate(rate);
                }}
                disabled={loading}
                className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-4 py-2 bg-primary hover:bg-primary/80 text-white text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <p className="text-white/30 text-xs mt-3">
          Click on campaigns to expand and see adsets. Click on adsets to see individual ads.
          {data?.dateRange && ` | Date Range: ${data.dateRange.start} to ${data.dateRange.end}`}
        </p>
      </div>

      {/* Revenue & Profit Summary */}
      {data?.revenue && (
        <div className="bg-gradient-to-r from-[#1A2235] to-[#1E2942] rounded-xl p-5 border border-white/10">
          <h3 className="text-white/70 text-sm font-semibold mb-4">Revenue & Profit Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            <div>
              <p className="text-white/40 text-xs mb-1">Total Revenue</p>
              <p className="text-green-400 text-xl font-bold">₹{data.revenue.totalRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Total Sales</p>
              <p className="text-white text-xl font-bold">{data.revenue.totalSales}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">GST (5%)</p>
              <p className="text-amber-400 text-lg font-bold">₹{data.revenue.gst.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Net Revenue</p>
              <p className="text-green-400/80 text-lg font-bold">₹{data.revenue.netRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Ad Spend (INR)</p>
              <p className="text-red-400 text-xl font-bold">₹{data.revenue.totalSpendINR.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">Profit</p>
              <p className={`text-xl font-bold ${data.revenue.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                {data.revenue.profit >= 0 ? "" : "-"}₹{Math.abs(data.revenue.profit).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-white/40 text-xs mb-1">ROAS</p>
              <p className={`text-xl font-bold ${data.revenue.roas >= 1 ? "text-green-400" : data.revenue.roas > 0 ? "text-amber-400" : "text-white/40"}`}>
                {data.revenue.roas > 0 ? data.revenue.roas.toFixed(2) : "-"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Metrics Summary */}
      {data?.totals && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <p className="text-white/50 text-xs mb-1">Total Spend (USD)</p>
            <p className="text-red-400 text-xl font-bold">{formatUSD(data.totals.spend)}</p>
          </div>
          <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <p className="text-white/50 text-xs mb-1">Meta Purchases</p>
            <p className="text-blue-400 text-xl font-bold">{data.totals.purchases}</p>
          </div>
          <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <p className="text-white/50 text-xs mb-1">CPA (Cost/Purchase)</p>
            <p className="text-amber-400 text-xl font-bold">
              {data.totals.costPerPurchase > 0 ? formatINR(data.totals.costPerPurchase) : "-"}
            </p>
          </div>
          <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <p className="text-white/50 text-xs mb-1">CPM</p>
            <p className="text-white/70 text-xl font-bold">{formatINR(data.totals.cpm)}</p>
          </div>
          <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
            <p className="text-white/50 text-xs mb-1">CTR</p>
            <p className="text-blue-400 text-xl font-bold">{formatPercent(data.totals.ctr)}</p>
          </div>
        </div>
      )}

      {/* Campaigns Table */}
      <div className="bg-[#1A2235] rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="ml-2 text-white/60">Loading campaigns...</span>
          </div>
        ) : !data?.campaigns?.length ? (
          <div className="text-center text-white/40 py-12">
            No campaign data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-white/70 text-xs font-semibold px-4 py-3 w-8"></th>
                  <th className="text-left text-white/70 text-xs font-semibold px-4 py-3">Name</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Spend</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Budget</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">ROAS</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Profit</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Purchases</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">CPC</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">CPA</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">CPM</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">CTR</th>
                </tr>
              </thead>
              <tbody>
                {data.campaigns.map((campaign) => (
                  <React.Fragment key={campaign.id}>
                    {/* Campaign Row */}
                    <tr 
                      className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                      onClick={() => toggleCampaign(campaign.id)}
                    >
                      <td className="px-4 py-3">
                        <ChevronRight className={`w-4 h-4 text-white/40 transition-transform ${expandedCampaigns.has(campaign.id) ? "rotate-90" : ""}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${campaign.status === "ACTIVE" ? "bg-green-400" : "bg-gray-400"}`} />
                          <span className="text-white font-medium">{campaign.name}</span>
                        </div>
                      </td>
                      <td className="text-red-400 px-4 py-3 text-right">{formatINR(campaign.spend)}</td>
                      <td className="text-white/60 px-4 py-3 text-right">{campaign.budget ? formatINR(campaign.budget) : "-"}</td>
                      <td className="text-green-400 px-4 py-3 text-right">{calculateEstimatedROAS(campaign.purchases, campaign.spend)}</td>
                      <td className={`px-4 py-3 text-right ${calculateEstimatedProfit(campaign.purchases, campaign.spend) >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {calculateEstimatedProfit(campaign.purchases, campaign.spend) >= 0 ? "" : "-"}₹{Math.abs(calculateEstimatedProfit(campaign.purchases, campaign.spend)).toFixed(2)}
                      </td>
                      <td className="text-white px-4 py-3 text-right">{campaign.purchases}</td>
                      <td className="text-white/60 px-4 py-3 text-right">{formatINR(campaign.cpc)}</td>
                      <td className="text-amber-400 px-4 py-3 text-right">{campaign.costPerPurchase > 0 ? formatINR(campaign.costPerPurchase) : "-"}</td>
                      <td className="text-white/60 px-4 py-3 text-right">{formatINR(campaign.cpm)}</td>
                      <td className="text-blue-400 px-4 py-3 text-right">{formatPercent(campaign.ctr)}</td>
                    </tr>

                    {/* Adsets (expanded) */}
                    {expandedCampaigns.has(campaign.id) && campaign.adsets?.map((adset) => (
                      <React.Fragment key={adset.id}>
                        {/* Adset Row */}
                        <tr 
                          className="border-b border-white/5 bg-white/[0.02] hover:bg-white/5 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); toggleAdset(adset.id); }}
                        >
                          <td className="px-4 py-3 pl-8">
                            <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${expandedAdsets.has(adset.id) ? "rotate-90" : ""}`} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 pl-4">
                              <span className={`w-1.5 h-1.5 rounded-full ${adset.status === "ACTIVE" ? "bg-green-400" : "bg-gray-400"}`} />
                              <span className="text-white/80">{adset.name}</span>
                            </div>
                          </td>
                          <td className="text-red-400/80 px-4 py-3 text-right">{formatINR(adset.spend)}</td>
                          <td className="text-white/50 px-4 py-3 text-right">{adset.budget ? formatINR(adset.budget) : "-"}</td>
                          <td className="text-green-400/80 px-4 py-3 text-right">{calculateEstimatedROAS(adset.purchases, adset.spend)}</td>
                          <td className={`px-4 py-3 text-right ${calculateEstimatedProfit(adset.purchases, adset.spend) >= 0 ? "text-green-400/80" : "text-red-400/80"}`}>
                            {calculateEstimatedProfit(adset.purchases, adset.spend) >= 0 ? "" : "-"}₹{Math.abs(calculateEstimatedProfit(adset.purchases, adset.spend)).toFixed(2)}
                          </td>
                          <td className="text-white/80 px-4 py-3 text-right">{adset.purchases}</td>
                          <td className="text-white/50 px-4 py-3 text-right">{formatINR(adset.cpc)}</td>
                          <td className="text-amber-400/80 px-4 py-3 text-right">{adset.costPerPurchase > 0 ? formatINR(adset.costPerPurchase) : "-"}</td>
                          <td className="text-white/50 px-4 py-3 text-right">{formatINR(adset.cpm)}</td>
                          <td className="text-blue-400/80 px-4 py-3 text-right">{formatPercent(adset.ctr)}</td>
                        </tr>

                        {/* Ads (expanded) */}
                        {expandedAdsets.has(adset.id) && adset.ads?.map((ad) => (
                          <tr key={ad.id} className="border-b border-white/5 bg-white/[0.01]">
                            <td className="px-4 py-3 pl-12"></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 pl-8">
                                <span className={`w-1 h-1 rounded-full ${ad.status === "ACTIVE" ? "bg-green-400" : "bg-gray-400"}`} />
                                <span className="text-white/60 text-xs">{ad.name}</span>
                              </div>
                            </td>
                            <td className="text-red-400/60 px-4 py-3 text-right text-xs">{formatINR(ad.spend)}</td>
                            <td className="text-white/40 px-4 py-3 text-right text-xs">-</td>
                            <td className="text-green-400/60 px-4 py-3 text-right text-xs">{calculateEstimatedROAS(ad.purchases, ad.spend)}</td>
                            <td className={`px-4 py-3 text-right text-xs ${calculateEstimatedProfit(ad.purchases, ad.spend) >= 0 ? "text-green-400/60" : "text-red-400/60"}`}>
                              {calculateEstimatedProfit(ad.purchases, ad.spend) >= 0 ? "" : "-"}₹{Math.abs(calculateEstimatedProfit(ad.purchases, ad.spend)).toFixed(2)}
                            </td>
                            <td className="text-white/60 px-4 py-3 text-right text-xs">{ad.purchases}</td>
                            <td className="text-white/40 px-4 py-3 text-right text-xs">{formatINR(ad.cpc)}</td>
                            <td className="text-amber-400/60 px-4 py-3 text-right text-xs">{ad.costPerPurchase > 0 ? formatINR(ad.costPerPurchase) : "-"}</td>
                            <td className="text-white/40 px-4 py-3 text-right text-xs">{formatINR(ad.cpm)}</td>
                            <td className="text-blue-400/60 px-4 py-3 text-right text-xs">{formatPercent(ad.ctr)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Tooltip({ content }: { content: string }) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <HelpCircle
        className="w-3.5 h-3.5 text-white/30 hover:text-white/60 cursor-help transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      />
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 px-3 py-2 bg-[#0A0E1A] border border-white/20 rounded-lg shadow-xl">
          <p className="text-white/80 text-xs leading-relaxed">{content}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-[#0A0E1A] border-r border-b border-white/20 rotate-45" />
        </div>
      )}
    </div>
  );
}

function KPICard({ title, value, subtitle, icon, color, tooltip }: { title: string; value: string; subtitle?: string; icon?: React.ReactNode; color?: string; tooltip?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#1A2235] rounded-xl p-4 border border-white/10"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-white/50 text-xs">{title}</span>
          {tooltip && <Tooltip content={tooltip} />}
        </div>
        {icon && <span className={color || "text-white/50"}>{icon}</span>}
      </div>
      <p className={`text-xl font-bold ${color || "text-white"}`}>{value}</p>
      {subtitle && <p className="text-white/40 text-xs mt-1">{subtitle}</p>}
    </motion.div>
  );
}

function MetricCard({ title, value, subtitle, color, tooltip }: { title: string; value: string; subtitle?: string; color?: string; tooltip?: string }) {
  return (
    <div className="bg-[#1A2235] rounded-xl p-3 border border-white/10">
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-white/50 text-xs">{title}</p>
        {tooltip && <Tooltip content={tooltip} />}
      </div>
      <p className={`text-lg font-semibold ${color || "text-white"}`}>{value}</p>
      {subtitle && <p className="text-white/40 text-xs">{subtitle}</p>}
    </div>
  );
}

function PlanBar({ label, value, total, color, count }: { label: string; value: number; total: number; color: string; count?: number }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/70">{label}</span>
        <span className="text-white/50">
          {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(value)}
          {count !== undefined ? ` (${count} sales)` : ` (${percentage.toFixed(0)}%)`}
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function MetaAdsSection({
  metaAds,
  metaLoading,
  metaDatePreset,
  setMetaDatePreset,
  showMetaCampaigns,
  setShowMetaCampaigns,
  formatCurrency,
  onRefresh,
  onCustomDateRefresh,
}: {
  metaAds: MetaAdsData | null;
  metaLoading: boolean;
  metaDatePreset: string;
  setMetaDatePreset: (v: string) => void;
  showMetaCampaigns: boolean;
  setShowMetaCampaigns: (v: boolean) => void;
  formatCurrency: (v: string | number) => string;
  onRefresh: () => void;
  onCustomDateRefresh: (startDate: string, endDate: string) => void;
}) {
  const [showInINR, setShowInINR] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<number>(93.32); // Default fallback
  const [rateLoading, setRateLoading] = useState(false);
  const [editingRate, setEditingRate] = useState(false);
  const [rateInput, setRateInput] = useState<string>("93.32");
  
  // Custom date range for Meta Ads
  const [useCustomDateRange, setUseCustomDateRange] = useState(false);
  const [metaStartDate, setMetaStartDate] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [metaEndDate, setMetaEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Fetch real-time exchange rate
  const fetchExchangeRate = async () => {
    try {
      setRateLoading(true);
      const res = await fetch("/api/exchange-rate");
      if (res.ok) {
        const data = await res.json();
        if (data.rate) {
          setExchangeRate(data.rate);
          setRateInput(data.rate.toFixed(2));
        }
      }
    } catch (err) {
      console.error("Failed to fetch exchange rate:", err);
    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    fetchExchangeRate();
  }, []);

  const handleRateChange = (value: string) => {
    setRateInput(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setExchangeRate(num);
    }
  };

  const formatNum = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "K";
    return n.toLocaleString();
  };

  const formatMetaCurrency = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (showInINR) {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
      }).format(num * exchangeRate);
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(num);
  };

  const datePresetLabels: Record<string, string> = {
    today: "Today",
    yesterday: "Yesterday",
    last_3d: "Last 3 Days",
    last_7d: "Last 7 Days",
    last_14d: "Last 14 Days",
    last_30d: "Last 30 Days",
    this_month: "This Month",
    last_month: "Last Month",
    last_90d: "Last 90 Days",
  };

  // Handle custom date range fetch
  const handleCustomDateFetch = () => {
    if (metaStartDate && metaEndDate) {
      setUseCustomDateRange(true);
      onCustomDateRefresh(metaStartDate, metaEndDate);
    }
  };

  return (
    <section>
      <div className="flex flex-col gap-3 mb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-white/70 text-sm font-medium flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> Meta / Facebook Ads
            <span className="text-white/30 text-xs ml-2">(Timezone: Ad Account - IST)</span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseCustomDateRange(!useCustomDateRange)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                useCustomDateRange 
                  ? "bg-blue-500/30 text-blue-300 border border-blue-500/50" 
                  : "bg-white/5 text-white/60 border border-white/10 hover:bg-white/10"
              }`}
            >
              {useCustomDateRange ? "Custom Range" : "Custom Range"}
            </button>
            {!useCustomDateRange && (
              <select
                value={metaDatePreset}
                onChange={(e) => setMetaDatePreset(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-primary/50"
              >
                {Object.entries(datePresetLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            )}
            <button
              onClick={onRefresh}
              disabled={metaLoading}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 text-white ${metaLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        
        {/* Custom Date Range Picker */}
        {useCustomDateRange && (
          <div className="flex items-center gap-3 bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-2">
              <label className="text-white/50 text-xs">From:</label>
              <input
                type="date"
                value={metaStartDate}
                onChange={(e) => setMetaStartDate(e.target.value)}
                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-white/50 text-xs">To:</label>
              <input
                type="date"
                value={metaEndDate}
                onChange={(e) => setMetaEndDate(e.target.value)}
                className="bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <button
              onClick={handleCustomDateFetch}
              disabled={metaLoading}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {metaLoading ? "Loading..." : "Apply"}
            </button>
          </div>
        )}
      </div>

      {metaLoading && !metaAds && (
        <div className="bg-[#1A2235] rounded-xl p-8 border border-white/10 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
          <p className="text-white/40 text-sm">Loading Meta Ads data...</p>
        </div>
      )}

      {metaAds && !metaAds.configured && (
        <div className="bg-[#1A2235] rounded-xl p-6 border border-white/10 text-center">
          <Megaphone className="w-10 h-10 text-blue-400/40 mx-auto mb-3" />
          <p className="text-white/60 text-sm mb-2">Meta Ads not configured</p>
          <p className="text-white/40 text-xs">
            Add <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-300">META_ACCESS_TOKEN</code> and{" "}
            <code className="bg-white/10 px-1.5 py-0.5 rounded text-blue-300">META_AD_ACCOUNT_ID</code> to your environment variables.
          </p>
        </div>
      )}

      {metaAds && metaAds.configured && metaAds.error && (
        <div className="bg-[#1A2235] rounded-xl p-6 border border-red-500/20 text-center">
          <ShieldAlert className="w-10 h-10 text-red-400/60 mx-auto mb-3" />
          <p className="text-white/60 text-sm mb-1">Meta API Error</p>
          <p className="text-red-400/80 text-xs">{metaAds.error}</p>
        </div>
      )}

      {metaAds && metaAds.configured && !metaAds.error && metaAds.account && (
        <div className="space-y-4">
          {/* Ad Spend & Performance KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1A2235] rounded-xl p-4 border border-blue-500/20"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs">Ad Spend</span>
                <button
                  onClick={() => setShowInINR(!showInINR)}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 transition-colors text-blue-400 text-xs"
                  title={showInINR ? `Click to show USD (Rate: $1 = ₹${exchangeRate.toFixed(2)})` : `Click to show INR (Rate: $1 = ₹${exchangeRate.toFixed(2)})`}
                >
                  {showInINR ? "₹" : "$"}
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xl font-bold text-blue-400">{formatMetaCurrency(metaAds.account.spend)}</p>
              <p className="text-white/40 text-xs mt-1">{datePresetLabels[metaDatePreset]}</p>
              {showInINR && (
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-white/30 text-xs">$1 = ₹</span>
                  <input
                    type="number"
                    value={rateInput}
                    onChange={(e) => handleRateChange(e.target.value)}
                    className="w-16 bg-white/10 border border-white/20 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-blue-400"
                    step="0.01"
                    min="1"
                  />
                  <button
                    onClick={fetchExchangeRate}
                    disabled={rateLoading}
                    className="p-1 rounded bg-white/10 hover:bg-white/20 transition-colors"
                    title="Fetch live rate"
                  >
                    <RefreshCw className={`w-3 h-3 text-white/60 ${rateLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
              )}
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1A2235] rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs">Impressions</span>
                <Eye className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-xl font-bold text-purple-400">{formatNum(metaAds.account.impressions)}</p>
              <p className="text-white/40 text-xs mt-1">CPM: {formatMetaCurrency(metaAds.account.cpm)}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1A2235] rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs">Link Clicks</span>
                <MousePointerClick className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-xl font-bold text-cyan-400">{formatNum(metaAds.account.linkClicks || metaAds.account.clicks)}</p>
              <p className="text-white/40 text-xs mt-1">CPC: {formatMetaCurrency(metaAds.account.costPerLinkClick || metaAds.account.cpc)}</p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1A2235] rounded-xl p-4 border border-white/10"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/50 text-xs">Reach</span>
                <Users className="w-4 h-4 text-green-400" />
              </div>
              <p className="text-xl font-bold text-green-400">{formatNum(metaAds.account.reach)}</p>
              <p className="text-white/40 text-xs mt-1">Freq: {metaAds.account.frequency.toFixed(2)}</p>
            </motion.div>
          </div>

          {/* Conversion Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-[#1A2235] rounded-xl p-3 border border-white/10">
              <p className="text-white/50 text-xs mb-1">CTR</p>
              <p className="text-lg font-semibold text-white">{metaAds.account.ctr.toFixed(2)}%</p>
            </div>
            <div className="bg-[#1A2235] rounded-xl p-3 border border-white/10">
              <p className="text-white/50 text-xs mb-1">Page Views</p>
              <p className="text-lg font-semibold text-white">{formatNum(metaAds.account.pageViews)}</p>
            </div>
            <div className="bg-[#1A2235] rounded-xl p-3 border border-white/10">
              <p className="text-white/50 text-xs mb-1">Leads</p>
              <p className="text-lg font-semibold text-amber-400">{formatNum(metaAds.account.leads)}</p>
              {metaAds.account.costPerLead > 0 && (
                <p className="text-white/40 text-xs">CPL: {formatMetaCurrency(metaAds.account.costPerLead)}</p>
              )}
            </div>
            <div className="bg-[#1A2235] rounded-xl p-3 border border-white/10">
              <p className="text-white/50 text-xs mb-1">Purchases</p>
              <p className="text-lg font-semibold text-green-400">{formatNum(metaAds.account.purchases)}</p>
              {metaAds.account.costPerPurchase > 0 && (
                <p className="text-white/40 text-xs">CPA: {formatMetaCurrency(metaAds.account.costPerPurchase)}</p>
              )}
            </div>
            <div className="bg-[#1A2235] rounded-xl p-3 border border-white/10">
              <p className="text-white/50 text-xs mb-1">ROAS</p>
              <p className="text-lg font-semibold text-white">
                {metaAds.account.spend > 0 && metaAds.account.purchases > 0
                  ? "—"
                  : "N/A"}
              </p>
              <p className="text-white/40 text-xs">Return on Ad Spend</p>
            </div>
          </div>

          {/* Daily Ad Spend Chart */}
          {metaAds.dailyBreakdown && metaAds.dailyBreakdown.length > 0 && (
            <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
              <h3 className="text-white/60 text-xs mb-3">Daily Ad Spend</h3>
              <div className="flex items-end gap-1 h-32">
                {(() => {
                  const maxSpend = Math.max(...metaAds.dailyBreakdown!.map((d) => d.spend), 1);
                  return metaAds.dailyBreakdown!.map((day) => (
                    <div
                      key={day.date}
                      className="flex-1 bg-blue-500/20 hover:bg-blue-500/40 transition-colors rounded-t relative group"
                      style={{ height: `${Math.max((day.spend / maxSpend) * 100, 2)}%` }}
                    >
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-black/80 rounded text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {day.date}: {formatMetaCurrency(day.spend)}
                        <br />
                        {formatNum(day.impressions)} imp • {formatNum(day.clicks)} clicks
                      </div>
                    </div>
                  ));
                })()}
              </div>
              <div className="flex justify-between mt-2 text-xs text-white/40">
                <span>{metaAds.dailyBreakdown[0]?.date}</span>
                <span>{metaAds.dailyBreakdown[metaAds.dailyBreakdown.length - 1]?.date}</span>
              </div>
            </div>
          )}

          {/* Campaign Breakdown */}
          {metaAds.campaigns && metaAds.campaigns.length > 0 && (
            <div className="bg-[#1A2235] rounded-xl border border-white/10 overflow-hidden">
              <button
                onClick={() => setShowMetaCampaigns(!showMetaCampaigns)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-white/50" />
                  <span className="text-white/60 text-xs font-medium">
                    Campaign Breakdown ({metaAds.campaigns.length} campaigns)
                  </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showMetaCampaigns ? "rotate-180" : ""}`} />
              </button>
              {showMetaCampaigns && (
                <div className="overflow-x-auto border-t border-white/10">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left text-white/50 text-xs font-medium px-4 py-2">Campaign</th>
                        <th className="text-right text-white/50 text-xs font-medium px-4 py-2">Spend</th>
                        <th className="text-right text-white/50 text-xs font-medium px-4 py-2">Impressions</th>
                        <th className="text-right text-white/50 text-xs font-medium px-4 py-2">Clicks</th>
                        <th className="text-right text-white/50 text-xs font-medium px-4 py-2">CTR</th>
                        <th className="text-right text-white/50 text-xs font-medium px-4 py-2">CPC</th>
                        <th className="text-right text-white/50 text-xs font-medium px-4 py-2">Reach</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metaAds.campaigns.map((c) => (
                        <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                          <td className="text-white/80 text-sm px-4 py-2 max-w-[200px] truncate">{c.name}</td>
                          <td className="text-blue-400 text-sm px-4 py-2 text-right font-medium">{formatMetaCurrency(c.spend)}</td>
                          <td className="text-white/70 text-sm px-4 py-2 text-right">{formatNum(c.impressions)}</td>
                          <td className="text-white/70 text-sm px-4 py-2 text-right">{formatNum(c.clicks)}</td>
                          <td className="text-white/70 text-sm px-4 py-2 text-right">{c.ctr.toFixed(2)}%</td>
                          <td className="text-white/70 text-sm px-4 py-2 text-right">{formatMetaCurrency(c.cpc)}</td>
                          <td className="text-white/70 text-sm px-4 py-2 text-right">{formatNum(c.reach)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Active Campaigns */}
          {metaAds.activeCampaigns && metaAds.activeCampaigns.length > 0 && (
            <div className="bg-[#1A2235] rounded-xl p-4 border border-green-500/20">
              <h3 className="text-white/60 text-xs mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {metaAds.activeCampaignCount} Active Campaign{metaAds.activeCampaignCount !== 1 ? "s" : ""}
              </h3>
              <div className="space-y-2">
                {metaAds.activeCampaigns.map((c, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-white/80 text-sm">{c.name}</p>
                      <p className="text-white/40 text-xs capitalize">{(c.objective || "").replace(/_/g, " ").toLowerCase()}</p>
                    </div>
                    <div className="text-right">
                      {c.dailyBudget && (
                        <p className="text-white/60 text-xs">{formatMetaCurrency(c.dailyBudget)}/day</p>
                      )}
                      {c.lifetimeBudget && (
                        <p className="text-white/60 text-xs">{formatMetaCurrency(c.lifetimeBudget)} lifetime</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
