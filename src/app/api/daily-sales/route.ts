// Daily Sales API
// GET /api/daily-sales - Get daily sales records
// POST /api/daily-sales - Create/update daily sales record

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const daysParam = parseInt(searchParams.get("days") || "30");

    // Limit days to reasonable range (1-365)
    const days = Math.min(Math.max(isNaN(daysParam) ? 30 : daysParam, 1), 365);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailySales = await prisma.dailySales.findMany({
      where: {
        restaurantId: session.user.restaurantId,
        date: {
          gte: startDate,
        },
      },
      orderBy: { date: "desc" },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Get restaurant's target food cost %
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.user.restaurantId },
      select: { targetFoodCostPercent: true },
    });

    // Calculate summary stats
    const totalRevenue = dailySales.reduce((sum, d) => sum + d.totalRevenue, 0);
    const totalFoodCost = dailySales.reduce((sum, d) => sum + (d.foodCostAmount || 0), 0);
    const avgFoodCostPercent = totalRevenue > 0 ? (totalFoodCost / totalRevenue) * 100 : 0;

    return NextResponse.json({
      records: dailySales,
      summary: {
        totalRevenue,
        totalFoodCost,
        avgFoodCostPercent,
        targetFoodCostPercent: restaurant?.targetFoodCostPercent || 30,
        recordCount: dailySales.length,
      },
    });
  } catch (error) {
    console.error("Error fetching daily sales:", error);
    return NextResponse.json(
      { error: "Failed to fetch daily sales" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Extract and sanitize inputs
    const date = body.date;
    const totalRevenue = body.totalRevenue;
    const foodCost = body.foodCost;
    const laborCost = body.laborCost;
    const covers = body.covers;
    const notes = body.notes?.trim();
    const items = body.items;

    // Validate required fields
    if (!date || totalRevenue === undefined) {
      return NextResponse.json(
        { error: "Date and total revenue are required" },
        { status: 400 }
      );
    }

    // Parse date and create UTC midnight to match PostgreSQL DATE storage
    const dateOnly = date.split("T")[0]; // "2024-02-12"
    const [year, month, day] = dateOnly.split("-").map(Number);
    if (!year || !month || !day) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }
    // Create date at UTC midnight - this is what PostgreSQL DATE will store
    const salesDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));

    // Validate revenue is a positive number
    const parsedRevenue = parseFloat(totalRevenue);
    if (isNaN(parsedRevenue) || parsedRevenue < 0) {
      return NextResponse.json(
        { error: "Total revenue must be a valid positive number" },
        { status: 400 }
      );
    }

    // Parse food cost (manual entry or calculated from items)
    let foodCostAmount = 0;

    if (foodCost !== undefined && foodCost !== "") {
      // Use manually entered food cost
      foodCostAmount = parseFloat(foodCost);
      if (isNaN(foodCostAmount) || foodCostAmount < 0) {
        return NextResponse.json(
          { error: "Food cost must be a valid positive number" },
          { status: 400 }
        );
      }
    } else if (items && items.length > 0) {
      // Calculate from items sold (fallback if no manual entry)
      const menuItemIds = items.map((item: { menuItemId: string }) => item.menuItemId);
      const menuItems = await prisma.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          restaurantId: session.user.restaurantId,
        },
        include: {
          ingredients: {
            include: {
              ingredient: true,
            },
          },
        },
      });

      for (const soldItem of items) {
        const menuItem = menuItems.find(m => m.id === soldItem.menuItemId);
        if (menuItem) {
          const itemCost = menuItem.ingredients.reduce((sum, mi) => {
            return sum + (mi.quantity * mi.ingredient.currentPrice);
          }, 0);
          foodCostAmount += itemCost * soldItem.quantitySold;
        }
      }
    }

    // Calculate food cost percentage
    const foodCostPercent = parsedRevenue > 0 ? (foodCostAmount / parsedRevenue) * 100 : 0;

    // Upsert daily sales record
    const dailySales = await prisma.dailySales.upsert({
      where: {
        restaurantId_date: {
          restaurantId: session.user.restaurantId,
          date: salesDate,
        },
      },
      update: {
        totalRevenue: parsedRevenue,
        foodRevenue: parsedRevenue, // Using total revenue as food revenue for simplicity
        laborCost: laborCost ? parseFloat(laborCost) : null,
        foodCostAmount,
        foodCostPercent,
        covers: covers ? parseInt(covers) : null,
        notes,
      },
      create: {
        date: salesDate,
        totalRevenue: parsedRevenue,
        foodRevenue: parsedRevenue, // Using total revenue as food revenue for simplicity
        laborCost: laborCost ? parseFloat(laborCost) : null,
        foodCostAmount,
        foodCostPercent,
        covers: covers ? parseInt(covers) : null,
        notes,
        restaurantId: session.user.restaurantId,
      },
    });

    // If items provided, save them
    if (items && items.length > 0) {
      // Delete existing items for this day
      await prisma.dailySalesItem.deleteMany({
        where: { dailySalesId: dailySales.id },
      });

      // Create new items
      await prisma.dailySalesItem.createMany({
        data: items.map((item: { menuItemId: string; quantitySold: number; revenue: number }) => ({
          dailySalesId: dailySales.id,
          menuItemId: item.menuItemId,
          quantitySold: item.quantitySold,
          revenue: item.revenue,
        })),
      });
    }

    return NextResponse.json(dailySales);
  } catch (error) {
    console.error("Error saving daily sales:", error);
    return NextResponse.json(
      { error: "Failed to save daily sales" },
      { status: 500 }
    );
  }
}
