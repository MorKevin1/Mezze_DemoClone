"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardStats {
  menuCount: number;
  avgMargin: number | null;
  revenue: number | null;
  foodCostPercent: number | null;
}

interface Recommendation {
  type: string;
  title: string;
  description: string;
  priority: number;
  items?: { id: string; name: string; detail: string }[];
}

const TIME_PERIODS = [
  { label: "Today", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
] as const;

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<DashboardStats>({
    menuCount: 0,
    avgMargin: null,
    revenue: null,
    foodCostPercent: null,
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<number>(7);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  // Fetch menu data once on auth
  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchMenu() {
      try {
        const res = await fetch("/api/menu");
        if (res.ok) {
          const menuItems = await res.json();
          const count = menuItems.length;
          const itemsWithIngredients = menuItems.filter(
            (item: { ingredients: unknown[] }) => item.ingredients?.length > 0
          );
          const avgMargin =
            itemsWithIngredients.length > 0
              ? itemsWithIngredients.reduce(
                  (sum: number, item: { margin: number }) => sum + item.margin,
                  0
                ) / itemsWithIngredients.length
              : null;

          setStats((prev) => ({ ...prev, menuCount: count, avgMargin }));
        }
      } catch (error) {
        console.error("Failed to fetch menu stats:", error);
      }
    }

    fetchMenu();

    async function fetchRecommendations() {
      try {
        const res = await fetch("/api/recommendations");
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data);
        }
      } catch (error) {
        console.error("Failed to fetch recommendations:", error);
      }
    }

    fetchRecommendations();
  }, [status]);

  // Fetch sales data when period changes
  useEffect(() => {
    if (status !== "authenticated") return;

    async function fetchSales() {
      setLoading(true);
      try {
        const res = await fetch(`/api/daily-sales?days=${period}`);
        if (res.ok) {
          const salesData = await res.json();
          const { summary } = salesData;
          if (summary.recordCount > 0) {
            setStats((prev) => ({
              ...prev,
              revenue: summary.totalRevenue,
              foodCostPercent: summary.avgFoodCostPercent,
            }));
          } else {
            setStats((prev) => ({
              ...prev,
              revenue: null,
              foodCostPercent: null,
            }));
          }
        }
      } catch (error) {
        console.error("Failed to fetch sales stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSales();
  }, [status, period]);

  if (status === "loading") {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!session) {
    redirect("/login");
  }

  const formatCurrency = (value: number | null) =>
    value !== null ? `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$--";

  const formatPercent = (value: number | null) =>
    value !== null ? `${value.toFixed(1)}%` : "--";

  return (
    <div>
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back{session.user?.name ? `, ${session.user.name}` : ""}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here&apos;s how your restaurant is performing
        </p>
      </div>

      {/* Time Period Toggle */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {TIME_PERIODS.map((tp) => (
          <button
            key={tp.days}
            onClick={() => setPeriod(tp.days)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              period === tp.days
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tp.label}
          </button>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Food Cost %</div>
          <div className="text-3xl font-bold text-gray-900">
            {loading ? "--" : formatPercent(stats.foodCostPercent)}
          </div>
          <div className="text-sm text-gray-400 mt-1">Target: 30%</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Revenue</div>
          <div className="text-3xl font-bold text-gray-900">
            {loading ? "$--" : formatCurrency(stats.revenue)}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {stats.revenue !== null
              ? TIME_PERIODS.find((tp) => tp.days === period)?.label
              : "No data yet"}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Menu Items</div>
          <div className="text-3xl font-bold text-gray-900">
            {stats.menuCount}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {stats.menuCount > 0 ? "In your menu" : "Add your menu"}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
          <div className="text-sm text-gray-500 mb-1">Avg. Margin</div>
          <div className="text-3xl font-bold text-gray-900">
            {formatPercent(stats.avgMargin)}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            {stats.avgMargin !== null ? "Across costed items" : "Add ingredients"}
          </div>
        </div>
      </div>

      {/* Getting Started - only show if no menu items yet */}
      {stats.menuCount === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Get Started with Mezze</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Add Your Menu</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Enter your dishes with prices. This is the foundation for all calculations.
                </p>
                <Link
                  href="/menu"
                  className="text-emerald-600 text-sm font-medium mt-2 inline-block hover:underline"
                >
                  Add menu items &rarr;
                </Link>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Add Ingredients</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Enter your ingredients with costs. Link them to menu items to calculate margins.
                </p>
                <Link
                  href="/ingredients"
                  className="text-emerald-600 text-sm font-medium mt-2 inline-block hover:underline"
                >
                  Add ingredients &rarr;
                </Link>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">See Your Margins</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Once you&apos;ve added menu items and ingredients, you&apos;ll see profit margins for each dish.
                </p>
                <Link
                  href="/reports"
                  className="text-emerald-600 text-sm font-medium mt-2 inline-block hover:underline"
                >
                  View reports &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
        {recommendations.length > 0 ? (
          <div className="space-y-4">
            {recommendations.map((rec, i) => (
              <div
                key={i}
                className={`rounded-xl p-6 border ${
                  rec.type === "WASTE_ALERT"
                    ? "bg-red-50 border-red-100"
                    : rec.type === "PRICE_INCREASE"
                    ? "bg-amber-50 border-amber-100"
                    : "bg-blue-50 border-blue-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      rec.type === "WASTE_ALERT"
                        ? "bg-red-100"
                        : rec.type === "PRICE_INCREASE"
                        ? "bg-amber-100"
                        : "bg-blue-100"
                    }`}
                  >
                    {rec.type === "WASTE_ALERT" ? (
                      <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                    ) : rec.type === "PRICE_INCREASE" ? (
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                    {rec.items && rec.items.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {rec.items.map((item) => (
                          <li key={item.id} className="text-sm text-gray-700 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
                            <span className="font-medium">{item.name}</span>
                            <span className="text-gray-500">{item.detail}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-8 border border-emerald-100">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Looking good!</h3>
                <p className="text-gray-600 mt-1">
                  No issues found. Mezze is analyzing your menu and sales data to surface
                  actionable recommendations. As you add more data, insights will appear here.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
