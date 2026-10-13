import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Navigation */}
      <nav className="flex justify-between items-center p-6 max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-emerald-600">Mezze</h1>
        <div className="space-x-4">
          <Link
            href="/login"
            className="text-gray-600 hover:text-emerald-600 transition font-medium"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="bg-emerald-600 text-white px-6 py-2 rounded-full hover:bg-emerald-700 transition font-medium"
          >
            Get Started Free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center">
          <div className="inline-block bg-emerald-100 text-emerald-700 px-4 py-1 rounded-full text-sm font-medium mb-6">
            Built for family-run restaurants
          </div>
          <h2 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Know Your Numbers,
            <span className="text-emerald-600"> Grow Your Restaurant</span>
          </h2>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Stop guessing, start optimizing. Mezze helps you track food costs,
            optimize your menu, and make smarter decisions — without the complexity
            of enterprise tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-block bg-emerald-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-emerald-700 transition shadow-lg hover:shadow-xl"
            >
              Start Free Trial
            </Link>
            <Link
              href="#features"
              className="inline-block bg-white text-gray-700 px-8 py-4 rounded-full text-lg font-semibold hover:bg-gray-50 transition border border-gray-200"
            >
              See How It Works
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto text-center">
          <div>
            <div className="text-4xl font-bold text-emerald-600">28-35%</div>
            <div className="text-gray-600 mt-1">Target Food Cost</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-emerald-600">$4,200</div>
            <div className="text-gray-600 mt-1">Avg. Monthly Savings</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-emerald-600">5 min</div>
            <div className="text-gray-600 mt-1">Daily Time Investment</div>
          </div>
        </div>

        {/* Feature Cards */}
        <div id="features" className="grid md:grid-cols-3 gap-8 mt-24">
          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Margin Calculator</h3>
            <p className="text-gray-600">
              Know exactly how much you make on every dish. Enter your ingredients
              and costs, see your true profit margins instantly.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Food Cost Tracker</h3>
            <p className="text-gray-600">
              Track your food cost percentage in real-time. Get alerts when costs
              creep above your target so you can act fast.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-lg hover:shadow-xl transition">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-7 h-7 text-emerald-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Daily Reports</h3>
            <p className="text-gray-600">
              One click to see everything that matters. Revenue, costs, margins —
              delivered to your inbox every morning.
            </p>
          </div>
        </div>

        {/* AI Section */}
        <div className="mt-24 bg-white rounded-3xl shadow-xl p-12 text-center">
          <div className="inline-block bg-purple-100 text-purple-700 px-4 py-1 rounded-full text-sm font-medium mb-6">
            AI-Powered Insights
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Smart Recommendations, Zero Complexity
          </h3>
          <p className="text-gray-600 max-w-2xl mx-auto mb-8">
            Mezze analyzes your menu and costs to give you actionable recommendations.
            No dashboards to decipher — just clear advice like &ldquo;Raise the price on your
            Chicken Parm by $2 to hit your target margin.&rdquo;
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-left max-w-4xl mx-auto">
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="text-emerald-600 font-semibold mb-1">Price Optimization</div>
              <div className="text-gray-600 text-sm">&ldquo;Your fish tacos are underpriced vs. market by $1.50&rdquo;</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="text-amber-600 font-semibold mb-1">Cost Alerts</div>
              <div className="text-gray-600 text-sm">&ldquo;Beef prices up 18% — affects 6 dishes&rdquo;</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <div className="text-red-600 font-semibold mb-1">Menu Optimization</div>
              <div className="text-gray-600 text-sm">&ldquo;Consider removing Caesar Salad — low sales, low margin&rdquo;</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24 text-center">
          <h3 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to take control of your margins?
          </h3>
          <p className="text-gray-600 mb-8">
            Join family restaurants who are finally understanding their numbers.
          </p>
          <Link
            href="/register"
            className="inline-block bg-emerald-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-emerald-700 transition shadow-lg hover:shadow-xl"
          >
            Start Your Free Trial
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-10 text-gray-500 border-t border-gray-100 mt-20">
        <p>&copy; 2025 Mezze. Built for the restaurants that feed our communities.</p>
      </footer>
    </div>
  );
}
