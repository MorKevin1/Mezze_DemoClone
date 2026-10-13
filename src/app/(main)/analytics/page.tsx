"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";

interface DailySalesRecord {
  id: string;
  date: string;
  totalRevenue: number;
  foodRevenue: number | null;
  laborCost: number | null;
  foodCostAmount: number | null;
  foodCostPercent: number | null;
  covers: number | null;
  notes: string | null;
}

interface SalesSummary {
  totalRevenue: number;
  totalFoodCost: number;
  avgFoodCostPercent: number;
  targetFoodCostPercent: number;
  recordCount: number;
}

interface MenuItem {
  id: string;
  name: string;
  price: number;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const [records, setRecords] = useState<DailySalesRecord[]>([]);
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<DailySalesRecord | null>(null);
  // Helper to get today's date in local timezone
  const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const [formData, setFormData] = useState({
    date: getTodayString(),
    totalRevenue: "",
    foodCost: "",
    laborCost: "",
    covers: "",
    notes: "",
  });

  useEffect(() => {
    if (session?.user?.restaurantId) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    try {
      const [salesRes, menuRes] = await Promise.all([
        fetch("/api/daily-sales?days=30"),
        fetch("/api/menu"),
      ]);

      if (salesRes.ok) {
        const data = await salesRes.json();
        setRecords(data.records);
        setSummary(data.summary);
      }

      if (menuRes.ok) {
        const menuData = await menuRes.json();
        setMenuItems(menuData);
      }
    } catch (error) {
      console.error("Error fetching analytics data:", error);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (record: DailySalesRecord) => {
    // Extract the date portion only to avoid timezone issues
    const dateOnly = record.date.split("T")[0];
    setEditingRecord(record);
    setFormData({
      date: dateOnly,
      totalRevenue: record.totalRevenue.toString(),
      foodCost: record.foodCostAmount?.toString() || "",
      laborCost: record.laborCost?.toString() || "",
      covers: record.covers?.toString() || "",
      notes: record.notes || "",
    });
    setError(null);
    setShowModal(true);
  };

  const openNewModal = () => {
    setEditingRecord(null);
    setFormData({
      date: getTodayString(),
      totalRevenue: "",
      foodCost: "",
      laborCost: "",
      covers: "",
      notes: "",
    });
    setError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/daily-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        await fetchData();
        setShowModal(false);
        setEditingRecord(null);
        setFormData({
          date: getTodayString(),
          totalRevenue: "",
          foodCost: "",
          laborCost: "",
          covers: "",
          notes: "",
        });
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save sales data");
      }
    } catch (err) {
      console.error("Error saving daily sales:", err);
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
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

  const getStatusColor = (actual: number, target: number) => {
    const diff = actual - target;
    if (diff <= -5) return "text-emerald-600"; // Well under target
    if (diff <= 0) return "text-emerald-600"; // At or under target
    if (diff <= 5) return "text-yellow-600"; // Slightly over
    return "text-red-600"; // Over target
  };

  const getStatusBg = (actual: number, target: number) => {
    const diff = actual - target;
    if (diff <= 0) return "bg-emerald-50";
    if (diff <= 5) return "bg-yellow-50";
    return "bg-red-50";
  };

  const formatDate = (dateStr: string) => {
    // Extract just the date part and parse it directly to avoid timezone issues
    // Database returns "2024-02-12T00:00:00.000Z" - we want to display "Feb 12" regardless of timezone
    const dateOnly = dateStr.split("T")[0]; // "2024-02-12"
    const [year, month, day] = dateOnly.split("-").map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Daily Sales</h1>
          <p className="text-gray-600 mt-1">
            Log revenue, costs, and track your food cost percentage
          </p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition font-medium flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Log Sales
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Food Cost % Card */}
          <div className={`rounded-2xl p-6 ${getStatusBg(summary.avgFoodCostPercent, summary.targetFoodCostPercent)}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Avg Food Cost %</span>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                summary.avgFoodCostPercent <= summary.targetFoodCostPercent
                  ? "bg-emerald-100"
                  : "bg-red-100"
              }`}>
                {summary.avgFoodCostPercent <= summary.targetFoodCostPercent ? (
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                )}
              </div>
            </div>
            <div className={`text-4xl font-bold ${getStatusColor(summary.avgFoodCostPercent, summary.targetFoodCostPercent)}`}>
              {summary.avgFoodCostPercent.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Target: {summary.targetFoodCostPercent}%
            </div>
          </div>

          {/* Total Revenue Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Revenue</div>
            <div className="text-4xl font-bold text-gray-900">
              ${summary.totalRevenue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Last 30 days
            </div>
          </div>

          {/* Total Food Cost Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-sm font-medium text-gray-600 mb-2">Total Food Cost</div>
            <div className="text-4xl font-bold text-gray-900">
              ${summary.totalFoodCost.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Last 30 days
            </div>
          </div>

          {/* Records Card */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="text-sm font-medium text-gray-600 mb-2">Days Tracked</div>
            <div className="text-4xl font-bold text-gray-900">
              {summary.recordCount}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Last 30 days
            </div>
          </div>
        </div>
      )}

      {/* Daily Records */}
      {records.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No sales data yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Start logging your daily sales to track your food cost percentage over time and identify trends.
          </p>
          <button
            onClick={openNewModal}
            className="bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition font-medium"
          >
            Log Your First Day
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Daily Records</h2>
          </div>
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Date</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Revenue</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Food Cost</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Food Cost %</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Covers</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Notes</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((record) => (
                <tr key={record.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{formatDate(record.date)}</div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ${record.totalRevenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {record.foodCostAmount ? `$${record.foodCostAmount.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {record.foodCostPercent !== null ? (
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                        getStatusBg(record.foodCostPercent, summary?.targetFoodCostPercent || 30)
                      } ${getStatusColor(record.foodCostPercent, summary?.targetFoodCostPercent || 30)}`}>
                        {record.foodCostPercent.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {record.covers || "—"}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {record.notes || "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openEditModal(record)}
                      className="text-emerald-600 hover:text-emerald-700 font-medium text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Log Sales Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">
              {editingRecord ? "Edit Daily Sales" : "Log Daily Sales"}
            </h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={`w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent ${
                    editingRecord ? "bg-gray-100 cursor-not-allowed" : ""
                  }`}
                  required
                  readOnly={!!editingRecord}
                />
                {editingRecord && (
                  <p className="text-xs text-gray-500 mt-1">Date cannot be changed when editing</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Revenue *
                </label>
                <p className="text-xs text-gray-500 mb-2">Total sales from your POS or register for the day</p>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.totalRevenue}
                    onChange={(e) => setFormData({ ...formData, totalRevenue: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Food Cost *
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Cost of ingredients used today</p>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.foodCost}
                      onChange={(e) => setFormData({ ...formData, foodCost: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Labor Cost
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Total wages paid today</p>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.laborCost}
                      onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Covers
                </label>
                <p className="text-xs text-gray-500 mb-2">Number of customers served (for avg check calculation)</p>
                <input
                  type="number"
                  min="0"
                  value={formData.covers}
                  onChange={(e) => setFormData({ ...formData, covers: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <p className="text-xs text-gray-500 mb-2">Any context that affected the day</p>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Holiday weekend, Private party"
                />
              </div>

              {/* Real-time Food Cost % Preview */}
              {formData.totalRevenue && formData.foodCost && (
                <div className={`p-4 rounded-lg ${
                  (parseFloat(formData.foodCost) / parseFloat(formData.totalRevenue)) * 100 <= (summary?.targetFoodCostPercent || 30)
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-red-50 border border-red-200"
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Food Cost %</span>
                    <span className={`text-lg font-bold ${
                      (parseFloat(formData.foodCost) / parseFloat(formData.totalRevenue)) * 100 <= (summary?.targetFoodCostPercent || 30)
                        ? "text-emerald-600"
                        : "text-red-600"
                    }`}>
                      {((parseFloat(formData.foodCost) / parseFloat(formData.totalRevenue)) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Target: {summary?.targetFoodCostPercent || 30}%
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingRecord(null); }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingRecord ? "Save Changes" : "Log Sales"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
