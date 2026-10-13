// Recommendations API
// GET /api/recommendations - Generate rule-based recommendations

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateRecommendations, type MenuItemData } from "@/lib/recommendations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const restaurantId = session.user.restaurantId;

    // Fetch menu items with ingredients and sales data in parallel
    const [menuItems, restaurant, dailySales] = await Promise.all([
      prisma.menuItem.findMany({
        where: { restaurantId },
        include: {
          ingredients: {
            include: { ingredient: true },
          },
        },
      }),
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { targetFoodCostPercent: true },
      }),
      prisma.dailySales.findMany({
        where: {
          restaurantId,
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Calculate margins for each item
    const menuItemData: MenuItemData[] = menuItems.map((item) => {
      const cost = item.ingredients.reduce(
        (total, mi) => total + mi.quantity * mi.ingredient.currentPrice,
        0
      );
      const margin = item.price > 0 ? ((item.price - cost) / item.price) * 100 : 0;
      return {
        id: item.id,
        name: item.name,
        price: item.price,
        cost: Math.round(cost * 100) / 100,
        margin: Math.round(margin * 10) / 10,
        ingredients: item.ingredients,
      };
    });

    // Build sales summary
    let salesSummary = null;
    if (dailySales.length > 0) {
      const totalRevenue = dailySales.reduce((sum, d) => sum + d.totalRevenue, 0);
      const totalFoodCost = dailySales.reduce((sum, d) => sum + (d.foodCostAmount || 0), 0);
      salesSummary = {
        totalRevenue,
        totalFoodCost,
        avgFoodCostPercent: totalRevenue > 0 ? (totalFoodCost / totalRevenue) * 100 : 0,
        targetFoodCostPercent: restaurant?.targetFoodCostPercent || 30,
        recordCount: dailySales.length,
      };
    }

    const recommendations = generateRecommendations(menuItemData, salesSummary);

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
}
