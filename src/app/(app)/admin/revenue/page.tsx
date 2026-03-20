"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  Filter,
  LayoutDashboard,
  Loader2,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";

type TabType = "dashboard" | "profit-sheet";

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
  recentTransactions: TransactionRow[];
  totalUsers: number;
  uniquePayingUsers: number;
  customDateRevenue?: string;
  customDatePaymentCount?: number;
  customDateTransactions?: TransactionRow[];
  customDateRange?: { start: string; end: string };
}

interface TransactionRow {
  id: string;
  date: string;
  userId: string;
  userEmail: string;
  userName: string;
  amount: number;
  bundleId: string;
  type: string;
  status: string;
}

interface ProfitSheetRow {
  date: string;
  day: string;
  revenue: number;
  gst: number;
  adsCostUSD: number;
  adsCostINR: number;
  netRevenue: number;
  roas: number;
  transactionCount: number;
}

function formatCurrencyUSD(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(num) ? num : 0);
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizeDateInput(d: Date): string {
  return d.toISOString().split("T")[0];
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  accent,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
      <div className="flex items-center justify-between mb-2">
        <p className="text-white/60 text-xs">{title}</p>
        <span className={accent}>{icon}</span>
      </div>
      <p className={`text-xl font-bold ${accent}`}>{value}</p>
      <p className="text-white/40 text-xs mt-1">{subtitle}</p>
    </div>
  );
}

export default function AdminRevenuePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RevenueData | null>(null);

  const [selectedStartDate, setSelectedStartDate] = useState<string>(normalizeDateInput(new Date()));
  const [selectedEndDate, setSelectedEndDate] = useState<string>(normalizeDateInput(new Date()));
  const [selectedStartTime, setSelectedStartTime] = useState<string>("00:00");
  const [selectedEndTime, setSelectedEndTime] = useState<string>("23:59");
  const [dateLoading, setDateLoading] = useState(false);

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterBundle, setFilterBundle] = useState<string>("all");
  const [searchText, setSearchText] = useState<string>("");

  const [profitSheetData, setProfitSheetData] = useState<ProfitSheetRow[]>([]);
  const [profitSheetLoading, setProfitSheetLoading] = useState(false);
  const [profitSheetStartDate, setProfitSheetStartDate] = useState<string>("2026-03-13");
  const [profitSheetEndDate, setProfitSheetEndDate] = useState<string>(normalizeDateInput(new Date()));
  const [profitSheetFilter, setProfitSheetFilter] = useState<string>("all");
  const [profitSheetRoasFilter, setProfitSheetRoasFilter] = useState<string>("all");
  const [profitSheetCustomExchangeRate, setProfitSheetCustomExchangeRate] = useState<string>("");

  const ensureAdminSession = () => {
    const token = localStorage.getItem("admin_session_token");
    const expiry = localStorage.getItem("admin_session_expiry");
    if (!token || !expiry || new Date(expiry) < new Date()) {
      localStorage.removeItem("admin_session_token");
      localStorage.removeItem("admin_session_expiry");
      router.push("/admin/login");
      return null;
    }
    return token;
  };

  const fetchData = async ({
    withDateRange = true,
    showMainLoader = false,
  }: {
    withDateRange?: boolean;
    showMainLoader?: boolean;
  } = {}) => {
    try {
      if (showMainLoader) setLoading(true);
      setRefreshing(true);
      if (withDateRange) setDateLoading(true);

      const token = ensureAdminSession();
      if (!token) return;

      let url = `/api/admin/revenue?token=${token}&_t=${Date.now()}`;
      if (withDateRange) {
        url += `&startDate=${selectedStartDate}&endDate=${selectedEndDate}`;
        url += `&startTime=${selectedStartTime}&endTime=${selectedEndTime}`;
      }

      const response = await fetch(url, { cache: "no-store" });
      if (response.status === 401) {
        ensureAdminSession();
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Failed to fetch revenue data");
      }

      const result = (await response.json()) as RevenueData;
      setData(result);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load revenue dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setDateLoading(false);
    }
  };

  const fetchProfitSheet = async (customRate?: number) => {
    try {
      setProfitSheetLoading(true);

      const token = ensureAdminSession();
      if (!token) return;

      let url = `/api/admin/profit-sheet?token=${token}&startDate=${profitSheetStartDate}&endDate=${profitSheetEndDate}`;
      const rateToUse = customRate || (profitSheetCustomExchangeRate ? parseFloat(profitSheetCustomExchangeRate) : undefined);
      if (rateToUse && Number.isFinite(rateToUse) && rateToUse > 0) {
        url += `&exchangeRate=${rateToUse}`;
      }

      const response = await fetch(url, { cache: "no-store" });
      if (response.status === 401) {
        ensureAdminSession();
        return;
      }
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Failed to fetch profit sheet");
      }

      const result = await response.json();
      setProfitSheetData(result.rows || []);
      if (result.exchangeRate && !profitSheetCustomExchangeRate) {
        setProfitSheetCustomExchangeRate(Number(result.exchangeRate).toFixed(2));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load profit sheet");
    } finally {
      setProfitSheetLoading(false);
    }
  };

  useEffect(() => {
    fetchData({ withDateRange: true, showMainLoader: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === "profit-sheet" && profitSheetData.length === 0) {
      fetchProfitSheet();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const sourceTransactions = useMemo(() => {
    if (!data) return [];
    return data.customDateTransactions && data.customDateTransactions.length > 0
      ? data.customDateTransactions
      : data.recentTransactions;
  }, [data]);

  const filteredTransactions = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return sourceTransactions.filter((tx) => {
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (filterStatus !== "all" && tx.status !== filterStatus) return false;
      if (filterBundle !== "all" && tx.bundleId !== filterBundle) return false;
      if (!q) return true;
      return (
        tx.userEmail?.toLowerCase().includes(q) ||
        tx.userName?.toLowerCase().includes(q) ||
        tx.id?.toLowerCase().includes(q)
      );
    });
  }, [sourceTransactions, filterType, filterStatus, filterBundle, searchText]);

  const selectedRangeRevenue = data?.customDateRevenue || "0";
  const selectedRangeCount = data?.customDatePaymentCount || 0;
  const isGrowthPositive = data?.momGrowth !== "N/A" && parseFloat(data?.momGrowth || "0") >= 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-white/60">Loading revenue dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center px-6">
        <div className="bg-[#1A2235] border border-red-500/30 rounded-xl p-6 text-center max-w-lg w-full">
          <p className="text-red-400 font-semibold mb-2">Unable to load revenue data</p>
          <p className="text-white/70 text-sm mb-6">{error || "Unknown error"}</p>
          <button
            onClick={() => fetchData({ withDateRange: true, showMainLoader: true })}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A] pb-10">
      <div className="sticky top-0 z-20 bg-[#0A0E1A]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/admin")}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-white">Revenue Dashboard</h1>
              <p className="text-white/50 text-xs">Stripe + Supabase</p>
            </div>
          </div>
          <button
            onClick={() => (activeTab === "dashboard" ? fetchData({ withDateRange: true }) : fetchProfitSheet())}
            disabled={refreshing || profitSheetLoading}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-white ${(refreshing || profitSheetLoading) ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="flex items-center gap-2 bg-white/5 rounded-xl p-1 w-fit">
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
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        {activeTab === "dashboard" && (
          <>
            <motion.section initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPICard
                  title="Total Revenue"
                  value={formatCurrencyUSD(data.totalRevenue)}
                  subtitle="All time"
                  icon={<DollarSign className="w-4 h-4" />}
                  accent="text-green-400"
                />
                <KPICard
                  title="ARPU"
                  value={formatCurrencyUSD(data.arpu)}
                  subtitle="Avg revenue per paying user"
                  icon={<Users className="w-4 h-4" />}
                  accent="text-blue-400"
                />
                <KPICard
                  title="MoM Growth"
                  value={data.momGrowth === "N/A" ? "N/A" : `${data.momGrowth}%`}
                  subtitle="vs last month"
                  icon={isGrowthPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  accent={data.momGrowth === "N/A" ? "text-white/60" : isGrowthPositive ? "text-green-400" : "text-red-400"}
                />
                <KPICard
                  title="Paying Users"
                  value={`${data.uniquePayingUsers}`}
                  subtitle={`of ${data.totalUsers} total users`}
                  icon={<CreditCard className="w-4 h-4" />}
                  accent="text-purple-400"
                />
              </div>
            </motion.section>

            <section className="bg-[#1A2235] rounded-xl border border-white/10 p-4">
              <h2 className="text-white/80 text-sm font-medium flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4" /> Date Range Filter
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={selectedStartDate}
                    onChange={(e) => setSelectedStartDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">Start Time</label>
                  <input
                    type="time"
                    value={selectedStartTime}
                    onChange={(e) => setSelectedStartTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={selectedEndDate}
                    onChange={(e) => setSelectedEndDate(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="text-white/50 text-xs mb-1 block">End Time</label>
                  <input
                    type="time"
                    value={selectedEndTime}
                    onChange={(e) => setSelectedEndTime(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm [color-scheme:dark]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => fetchData({ withDateRange: true })}
                  className="px-4 py-2 rounded-lg bg-primary text-white text-sm hover:opacity-90"
                >
                  Apply Range
                </button>
                <button
                  onClick={() => {
                    const today = normalizeDateInput(new Date());
                    setSelectedStartDate(today);
                    setSelectedEndDate(today);
                    setSelectedStartTime("00:00");
                    setSelectedEndTime("23:59");
                  }}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm hover:bg-white/20"
                >
                  Reset Inputs
                </button>
                {dateLoading && <Loader2 className="w-4 h-4 text-white/70 animate-spin" />}
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[#1A2235] rounded-xl border border-white/10 p-4">
                <h3 className="text-white/80 text-sm font-medium mb-3">Selected Range Summary</h3>
                <p className="text-2xl font-bold text-green-400">{formatCurrencyUSD(selectedRangeRevenue)}</p>
                <p className="text-white/50 text-xs mt-1">{selectedRangeCount} successful payments</p>
                <p className="text-white/40 text-xs mt-2">
                  {selectedStartDate} {selectedStartTime} to {selectedEndDate} {selectedEndTime}
                </p>
              </div>
              <div className="bg-[#1A2235] rounded-xl border border-white/10 p-4">
                <h3 className="text-white/80 text-sm font-medium mb-3">Revenue By Type</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Bundles</span>
                    <span className="text-white">{formatCurrencyUSD(data.revenueByType.bundle)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Upsells</span>
                    <span className="text-white">{formatCurrencyUSD(data.revenueByType.upsell)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Reports</span>
                    <span className="text-white">{formatCurrencyUSD(data.revenueByType.report)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Coins</span>
                    <span className="text-white">{formatCurrencyUSD(data.revenueByType.coins)}</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-[#1A2235] rounded-xl border border-white/10 p-4">
              <h3 className="text-white/80 text-sm font-medium mb-3">Bundle Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {Object.entries(data.bundleBreakdown).map(([bundleId, value]) => (
                  <div key={bundleId} className="rounded-lg bg-white/5 border border-white/10 p-3">
                    <p className="text-white/70 text-xs uppercase">{bundleId}</p>
                    <p className="text-white font-semibold mt-1">{formatCurrencyUSD(value.revenue)}</p>
                    <p className="text-white/50 text-xs">{value.count} payments</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-[#1A2235] rounded-xl border border-white/10 p-4">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <h3 className="text-white/80 text-sm font-medium mr-auto">Transactions</h3>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-white/40 absolute left-2.5 top-2.5" />
                  <input
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Search email/name/id"
                    className="pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-white/50 text-xs flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" /> Filters
                </span>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="all">All types</option>
                  <option value="bundle">bundle</option>
                  <option value="upsell">upsell</option>
                  <option value="report">report</option>
                  <option value="coins">coins</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="all">All status</option>
                  <option value="paid">paid</option>
                  <option value="failed">failed</option>
                  <option value="created">created</option>
                </select>
                <select
                  value={filterBundle}
                  onChange={(e) => setFilterBundle(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
                >
                  <option value="all">All bundles</option>
                  <option value="palm-reading">palm-reading</option>
                  <option value="palm-birth">palm-birth</option>
                  <option value="palm-birth-compat">palm-birth-compat</option>
                  <option value="ultra-pack">ultra-pack</option>
                  <option value="2026-predictions">2026-predictions</option>
                  <option value="report-2026">report-2026</option>
                  <option value="report-birth-chart">report-birth-chart</option>
                  <option value="report-compatibility">report-compatibility</option>
                  <option value="coins-50">coins-50</option>
                  <option value="coins-150">coins-150</option>
                  <option value="coins-300">coins-300</option>
                  <option value="coins-500">coins-500</option>
                </select>
              </div>

              <div className="overflow-x-auto rounded-lg border border-white/10">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="text-left text-white/60 text-xs px-3 py-2">Date</th>
                      <th className="text-left text-white/60 text-xs px-3 py-2">Amount</th>
                      <th className="text-left text-white/60 text-xs px-3 py-2">Type</th>
                      <th className="text-left text-white/60 text-xs px-3 py-2">Bundle/Item</th>
                      <th className="text-left text-white/60 text-xs px-3 py-2">User</th>
                      <th className="text-left text-white/60 text-xs px-3 py-2">Email</th>
                      <th className="text-left text-white/60 text-xs px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center text-white/40 text-sm py-8">
                          No transactions found for the current filters.
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="border-b border-white/5">
                          <td className="px-3 py-2 text-xs text-white/70">{formatDateTime(tx.date)}</td>
                          <td className="px-3 py-2 text-xs text-green-400 font-medium">{formatCurrencyUSD(tx.amount)}</td>
                          <td className="px-3 py-2 text-xs text-white/80">{tx.type || "-"}</td>
                          <td className="px-3 py-2 text-xs text-white/70">{tx.bundleId || "-"}</td>
                          <td className="px-3 py-2 text-xs text-white/70">{tx.userName || "-"}</td>
                          <td className="px-3 py-2 text-xs text-white/70">{tx.userEmail || "-"}</td>
                          <td className="px-3 py-2 text-xs">
                            <span
                              className={`px-2 py-0.5 rounded-full ${
                                tx.status === "paid"
                                  ? "bg-green-500/20 text-green-400"
                                  : tx.status === "failed"
                                  ? "bg-red-500/20 text-red-400"
                                  : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

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
      </div>
    </div>
  );
}

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
  const formatCurrencyINR = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  let filteredData = [...data];
  if (periodFilter === "last7") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    filteredData = filteredData.filter((row) => new Date(`${row.date}T00:00:00Z`) >= cutoff);
  } else if (periodFilter === "last14") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    filteredData = filteredData.filter((row) => new Date(`${row.date}T00:00:00Z`) >= cutoff);
  } else if (periodFilter === "last30") {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    filteredData = filteredData.filter((row) => new Date(`${row.date}T00:00:00Z`) >= cutoff);
  }

  if (roasFilter === "positive") {
    filteredData = filteredData.filter((row) => row.roas > 1);
  } else if (roasFilter === "negative") {
    filteredData = filteredData.filter((row) => row.roas > 0 && row.roas <= 1);
  } else if (roasFilter === "noads") {
    filteredData = filteredData.filter((row) => row.adsCostINR === 0);
  }

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
      <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-white/50 text-xs mb-1 block">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
            />
          </div>
          <div>
            <label className="text-white/50 text-xs mb-1 block">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50 [color-scheme:dark]"
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
                className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary/50"
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
          Date window logic: each row counts revenue from 11:30 AM IST of that date to 11:29:59 AM IST of the next date.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Total Revenue</p>
          <p className="text-green-400 text-xl font-bold">{formatCurrencyINR(totals.revenue)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">GST (5%)</p>
          <p className="text-amber-400 text-xl font-bold">{formatCurrencyINR(totals.gst)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Ads Cost (USD)</p>
          <p className="text-red-400/70 text-lg font-bold">${totals.adsCostUSD.toFixed(2)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Ads Cost (INR)</p>
          <p className="text-red-400 text-xl font-bold">{formatCurrencyINR(totals.adsCostINR)}</p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Net Revenue</p>
          <p className={`text-xl font-bold ${totals.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatCurrencyINR(totals.netRevenue)}
          </p>
        </div>
        <div className="bg-[#1A2235] rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Overall ROAS</p>
          <p className={`text-xl font-bold ${overallRoas >= 1 ? "text-green-400" : overallRoas > 0 ? "text-amber-400" : "text-white/40"}`}>
            {overallRoas > 0 ? overallRoas.toFixed(2) : "-"}
          </p>
        </div>
      </div>

      <div className="bg-[#1A2235] rounded-xl border border-white/10 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
            <span className="ml-2 text-white/60">Loading profit sheet...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-white/70 text-xs font-semibold px-4 py-3">Date</th>
                  <th className="text-left text-white/70 text-xs font-semibold px-4 py-3">Day</th>
                  <th className="text-right text-white/70 text-xs font-semibold px-4 py-3">Revenue (INR)</th>
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
                        <td className="text-green-400 text-sm px-4 py-3 text-right font-medium">{formatCurrencyINR(row.revenue)}</td>
                        <td className="text-amber-400/70 text-sm px-4 py-3 text-right">{formatCurrencyINR(row.gst)}</td>
                        <td className="text-red-400/50 text-sm px-4 py-3 text-right">${row.adsCostUSD.toFixed(2)}</td>
                        <td className="text-red-400/70 text-sm px-4 py-3 text-right">{formatCurrencyINR(row.adsCostINR)}</td>
                        <td className={`text-sm px-4 py-3 text-right font-medium ${row.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                          {formatCurrencyINR(row.netRevenue)}
                        </td>
                        <td className={`text-sm px-4 py-3 text-right font-medium ${
                          row.roas >= 1 ? "text-green-400" : row.roas > 0 ? "text-amber-400" : "text-white/30"
                        }`}>
                          {row.roas > 0 ? row.roas.toFixed(2) : "-"}
                        </td>
                        <td className="text-white/60 text-sm px-4 py-3 text-right">{row.transactionCount}</td>
                      </tr>
                    ))}
                    <tr className="bg-white/10 border-t-2 border-white/20 font-semibold">
                      <td className="text-white text-sm px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="text-green-400 text-sm px-4 py-3 text-right">{formatCurrencyINR(totals.revenue)}</td>
                      <td className="text-amber-400 text-sm px-4 py-3 text-right">{formatCurrencyINR(totals.gst)}</td>
                      <td className="text-red-400/70 text-sm px-4 py-3 text-right">${totals.adsCostUSD.toFixed(2)}</td>
                      <td className="text-red-400 text-sm px-4 py-3 text-right">{formatCurrencyINR(totals.adsCostINR)}</td>
                      <td className={`text-sm px-4 py-3 text-right ${totals.netRevenue >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {formatCurrencyINR(totals.netRevenue)}
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
