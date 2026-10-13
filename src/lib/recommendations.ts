// Rule-based recommendation engine
// Swap this file's logic for an LLM call when ready to upgrade

export interface MenuItemData {
  id: string;
  name: string;
  price: number;
  cost: number;
  margin: number;
  ingredients: { id: string }[];
}

export interface SalesSummary {
  totalRevenue: number;
  totalFoodCost: number;
  avgFoodCostPercent: number;
  targetFoodCostPercent: number;
  recordCount: number;
}

export interface Recommendation {
  type: string;
  title: string;
  description: string;
  priority: number; // higher = more important
  items?: { id: string; name: string; detail: string }[];
}

const DEFAULT_TARGET = 30;

export function generateRecommendations(
  menuItems: MenuItemData[],
  salesSummary: SalesSummary | null
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Rule: No sales data — nudge to start logging
  if (!salesSummary || salesSummary.recordCount === 0) {
    recommendations.push({
      type: "NO_SALES_DATA",
      title: "Start logging daily sales",
      description:
        "Log your daily revenue and food costs to unlock insights about your restaurant's performance. Even a few days of data helps spot trends.",
      priority: 50,
    });
  }

  // If no menu items, return what we have so far (e.g. no-sales nudge)
  if (menuItems.length === 0) {
    return recommendations;
  }

  // Rule: Uncosted items — menu items with no ingredients linked
  const uncostedItems = menuItems.filter((item) => item.ingredients.length === 0);
  if (uncostedItems.length > 0) {
    recommendations.push({
      type: "UNCOSTED_ITEMS",
      title: "Add ingredients to calculate true margins",
      description: `${uncostedItems.length} menu item${uncostedItems.length === 1 ? " has" : "s have"} no ingredients linked. Without ingredient costs, you can't see accurate profit margins.`,
      priority: 60,
      items: uncostedItems.map((item) => ({
        id: item.id,
        name: item.name,
        detail: `$${item.price.toFixed(2)} — margin unknown`,
      })),
    });
  }

  // Only analyze margins for items that have ingredients costed
  const costedItems = menuItems.filter((item) => item.ingredients.length > 0);

  // Rule: Low margin items — margin below 50%
  const lowMarginItems = costedItems.filter((item) => item.margin < 50);
  if (lowMarginItems.length > 0) {
    const sorted = [...lowMarginItems].sort((a, b) => a.margin - b.margin);
    recommendations.push({
      type: "PRICE_INCREASE",
      title: "Review items with low margins",
      description: `${lowMarginItems.length} item${lowMarginItems.length === 1 ? " has" : "s have"} a margin below 50%. Consider raising prices or reducing ingredient costs.`,
      priority: 70,
      items: sorted.slice(0, 5).map((item) => ({
        id: item.id,
        name: item.name,
        detail: `${item.margin.toFixed(1)}% margin — costs $${item.cost.toFixed(2)} of $${item.price.toFixed(2)} price`,
      })),
    });
  }

  // Rule: High food cost alert — overall food cost % exceeds target
  if (salesSummary && salesSummary.recordCount > 0) {
    const target = salesSummary.targetFoodCostPercent || DEFAULT_TARGET;
    if (salesSummary.avgFoodCostPercent > target) {
      const overBy = salesSummary.avgFoodCostPercent - target;
      recommendations.push({
        type: "WASTE_ALERT",
        title: "Food cost is above your target",
        description: `Your food cost is ${salesSummary.avgFoodCostPercent.toFixed(1)}%, which is ${overBy.toFixed(1)} points above your ${target}% target. Review portion sizes, waste, and supplier pricing.`,
        priority: 90,
      });
    }
  }

  // Sort by priority descending (highest priority first)
  recommendations.sort((a, b) => b.priority - a.priority);

  return recommendations;
}
