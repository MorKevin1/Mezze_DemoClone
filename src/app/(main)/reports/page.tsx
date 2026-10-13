"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";

interface DailySalesRecord {
  id: string;
  date: string;
  totalRevenue: number;
  foodCostAmount: number | null;
  foodCostPercent: number | null;
  laborCost: number | null;
  covers: number | null;
  notes: string | null;
}

interface SummaryData {
  records: DailySalesRecord[];
  summary: {
    totalRevenue: number;
    totalFoodCost: number;
    avgFoodCostPercent: number;
    targetFoodCostPercent: number;
    recordCount: number;
  };
}

type ViewMode = "weekly" | "monthly";

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [data, setData] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previousPeriodData, setPreviousPeriodData] = useState<SummaryData | null>(null);

  // Get date ranges based on view mode
  const getDateRange = (mode: ViewMode, offset: number = 0) => {
    const now = new Date();

    if (mode === "weekly") {
      // Start of this week (Sunday)
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay() - (offset * 7));
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      return { start: startOfWeek, end: endOfWeek };
    } else {
      // Start of this month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);

      return { start: startOfMonth, end: endOfMonth };
    }
  };

  const formatDateRange = (start: Date, end: Date) => {
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
    const yearOptions: Intl.DateTimeFormatOptions = { ...options, year: "numeric" };

    if (start.getFullYear() !== end.getFullYear()) {
      return `${start.toLocaleDateString("en-US", yearOptions)} - ${end.toLocaleDateString("en-US", yearOptions)}`;
    }
    return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", yearOptions)}`;
  };

  useEffect(() => {
    if (session?.user?.restaurantId) {
      fetchData();
    }
  }, [session, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const days = viewMode === "weekly" ? 7 : 31;
      const previousDays = viewMode === "weekly" ? 14 : 62;

      // Fetch current period and previous period for comparison
      const [currentRes, previousRes] = await Promise.all([
        fetch(`/api/daily-sales?days=${days}`),
        fetch(`/api/daily-sales?days=${previousDays}`),
      ]);

      if (currentRes.ok) {
        const currentData = await currentRes.json();
        setData(currentData);
      }

      if (previousRes.ok) {
        const prevData = await previousRes.json();
        setPreviousPeriodData(prevData);
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!session) {
    redirect("/login");
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    const dateOnly = dateStr.split("T")[0];
    const [year, month, day] = dateOnly.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusColor = (actual: number, target: number) => {
    if (actual <= target) return "text-emerald-600";
    if (actual <= target + 5) return "text-yellow-600";
    return "text-red-600";
  };

  const getStatusBg = (actual: number, target: number) => {
    if (actual <= target) return "bg-emerald-50";
    if (actual <= target + 5) return "bg-yellow-50";
    return "bg-red-50";
  };

  // Calculate comparison with previous period
  const calculateComparison = () => {
    if (!data || !previousPeriodData) return null;

    const currentRevenue = data.summary.totalRevenue;
    const currentRecords = data.records.length;

    // Get previous period records (offset by current period length)
    const previousRecords = previousPeriodData.records.slice(currentRecords);
    const previousRevenue = previousRecords.reduce((sum, r) => sum + r.totalRevenue, 0);
    const previousFoodCost = previousRecords.reduce((sum, r) => sum + (r.foodCostAmount || 0), 0);

    if (previousRevenue === 0) return null;

    return {
      revenueChange: ((currentRevenue - previousRevenue) / previousRevenue) * 100,
      foodCostChange: previousFoodCost > 0
        ? ((data.summary.totalFoodCost - previousFoodCost) / previousFoodCost) * 100
        : 0,
    };
  };

  const comparison = calculateComparison();
  const dateRange = getDateRange(viewMode);

  // Calculate profit
  const totalLabor = data?.records.reduce((sum, r) => sum + (r.laborCost || 0), 0) || 0;
  const grossProfit = (data?.summary.totalRevenue || 0) - (data?.summary.totalFoodCost || 0);
  const netProfit = grossProfit - totalLabor;

  // Find best and worst days
  const bestDay = data?.records.reduce((best, r) =>
    r.totalRevenue > (best?.totalRevenue || 0) ? r : best, data.records[0]);
  const worstDay = data?.records.reduce((worst, r) =>
    r.totalRevenue < (worst?.totalRevenue || Infinity) ? r : worst, data.records[0]);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">
            {formatDateRange(dateRange.start, dateRange.end)}
          </p>
        </div>

        {/* Toggle */}
        <div className="bg-gray-100 p-1 rounded-lg flex">
          <button
            onClick={() => setViewMode("weekly")}
            className={`px-4 py-2 rounded-md font-medium transition ${
              viewMode === "weekly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Weekly
          </button>
          <button
            onClick={() => setViewMode("monthly")}
            className={`px-4 py-2 rounded-md font-medium transition ${
              viewMode === "monthly"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Monthly
          </button>
        </div>
      </div>

      {!data || data.records.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No data for this {viewMode === "weekly" ? "week" : "month"}</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Log daily sales data to see your {viewMode} summary and trends.
          </p>
          <a
            href="/analytics"
            className="inline-block bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition font-medium"
          >
            Go to Daily Sales
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Revenue */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Total Revenue</div>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(data.summary.totalRevenue)}
              </div>
              {comparison && (
                <div className={`text-sm mt-1 ${comparison.revenueChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {comparison.revenueChange >= 0 ? "+" : ""}{comparison.revenueChange.toFixed(1)}% vs last {viewMode === "weekly" ? "week" : "month"}
                </div>
              )}
            </div>

            {/* Food Cost */}
            <div className={`rounded-2xl shadow-sm p-6 border ${getStatusBg(data.summary.avgFoodCostPercent, data.summary.targetFoodCostPercent)}`}>
              <div className="text-sm text-gray-600 mb-1">Avg Food Cost %</div>
              <div className={`text-3xl font-bold ${getStatusColor(data.summary.avgFoodCostPercent, data.summary.targetFoodCostPercent)}`}>
                {data.summary.avgFoodCostPercent.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Target: {data.summary.targetFoodCostPercent}%
              </div>
            </div>

            {/* Gross Profit */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Gross Profit</div>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(grossProfit)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {((grossProfit / data.summary.totalRevenue) * 100).toFixed(1)}% margin
              </div>
            </div>

            {/* Days Tracked */}
            <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
              <div className="text-sm text-gray-600 mb-1">Days Tracked</div>
              <div className="text-3xl font-bold text-gray-900">
                {data.summary.recordCount}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                of {viewMode === "weekly" ? "7" : "~30"} days
              </div>
            </div>
          </div>

          {/* Insights Row */}
          {(bestDay || worstDay) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bestDay && (
                <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <span className="font-semibold text-emerald-800">Best Day</span>
                  </div>
                  <div className="text-2xl font-bold text-emerald-700">{formatDate(bestDay.date)}</div>
                  <div className="text-emerald-600">{formatCurrency(bestDay.totalRevenue)} revenue</div>
                </div>
              )}
              {worstDay && data.records.length > 1 && (
                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                    <span className="font-semibold text-gray-700">Slowest Day</span>
                  </div>
                  <div className="text-2xl font-bold text-gray-700">{formatDate(worstDay.date)}</div>
                  <div className="text-gray-600">{formatCurrency(worstDay.totalRevenue)} revenue</div>
                </div>
              )}
            </div>
          )}

          {/* Daily Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Daily Breakdown</h2>
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">Date</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Revenue</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Food Cost</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Food %</th>
                  <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.records.map((record) => {
                  const profit = record.totalRevenue - (record.foodCostAmount || 0) - (record.laborCost || 0);
                  return (
                    <tr key={record.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {formatDate(record.date)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900">
                        {formatCurrency(record.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {record.foodCostAmount ? formatCurrency(record.foodCostAmount) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {record.foodCostPercent !== null ? (
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            getStatusBg(record.foodCostPercent, data.summary.targetFoodCostPercent)
                          } ${getStatusColor(record.foodCostPercent, data.summary.targetFoodCostPercent)}`}>
                            {record.foodCostPercent.toFixed(1)}%
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {formatCurrency(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td className="px-6 py-4 font-semibold text-gray-900">Total</td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900">
                    {formatCurrency(data.summary.totalRevenue)}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-600">
                    {formatCurrency(data.summary.totalFoodCost)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                      getStatusBg(data.summary.avgFoodCostPercent, data.summary.targetFoodCostPercent)
                    } ${getStatusColor(data.summary.avgFoodCostPercent, data.summary.targetFoodCostPercent)}`}>
                      {data.summary.avgFoodCostPercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-gray-900">
                    {formatCurrency(netProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
