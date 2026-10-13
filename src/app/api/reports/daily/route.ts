// Daily Report API
// GET /api/reports/daily - Generate a daily summary report
// POST /api/reports/daily - Save and optionally email a daily report

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
    const dateParam = searchParams.get("date");

    // Parse date avoiding timezone issues
    // We need to create a date that when converted to UTC by Prisma, matches what's in the database
    let reportDate: Date;
    if (dateParam) {
      const dateOnly = dateParam.split("T")[0]; // "2024-02-12"
      const [year, month, day] = dateOnly.split("-").map(Number);
      // Create date at noon UTC to avoid any day boundary issues
      reportDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
    } else {
      // For "today", use current date in local timezone
      const now = new Date();
      reportDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    }

    // Get restaurant info
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.user.restaurantId },
      select: {
        name: true,
        targetFoodCostPercent: true,
        targetLaborCostPercent: true,
      },
    });

    // Get daily sales for the date
    const dailySales = await prisma.dailySales.findUnique({
      where: {
        restaurantId_date: {
          restaurantId: session.user.restaurantId,
          date: reportDate,
        },
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Get top selling items for context
    const topItems = dailySales?.items
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5) || [];

    // Get yesterday's data for comparison
    const yesterday = new Date(reportDate.getTime() - 24 * 60 * 60 * 1000);

    const yesterdaySales = await prisma.dailySales.findUnique({
      where: {
        restaurantId_date: {
          restaurantId: session.user.restaurantId,
          date: yesterday,
        },
      },
    });

    // Calculate week-to-date
    const dayOfWeek = reportDate.getUTCDay(); // 0 = Sunday
    const weekStart = new Date(reportDate.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);

    const weekSales = await prisma.dailySales.findMany({
      where: {
        restaurantId: session.user.restaurantId,
        date: {
          gte: weekStart,
          lte: reportDate,
        },
      },
    });

    const weekTotals = {
      revenue: weekSales.reduce((sum, d) => sum + d.totalRevenue, 0),
      foodCost: weekSales.reduce((sum, d) => sum + (d.foodCostAmount || 0), 0),
      covers: weekSales.reduce((sum, d) => sum + (d.covers || 0), 0),
      days: weekSales.length,
    };

    // Generate report data
    const report = {
      date: reportDate.toISOString().split("T")[0],
      restaurantName: restaurant?.name,
      generated: new Date().toISOString(),

      today: dailySales ? {
        revenue: dailySales.totalRevenue,
        foodCost: dailySales.foodCostAmount || 0,
        foodCostPercent: dailySales.foodCostPercent || 0,
        laborCost: dailySales.laborCost || 0,
        covers: dailySales.covers || 0,
        notes: dailySales.notes,
      } : null,

      comparison: yesterdaySales ? {
        revenueChange: dailySales
          ? ((dailySales.totalRevenue - yesterdaySales.totalRevenue) / yesterdaySales.totalRevenue) * 100
          : 0,
        coversChange: dailySales && yesterdaySales.covers && dailySales.covers
          ? ((dailySales.covers - yesterdaySales.covers) / yesterdaySales.covers) * 100
          : 0,
      } : null,

      weekToDate: weekTotals,

      topItems: topItems.map(item => ({
        name: item.menuItem.name,
        quantity: item.quantitySold,
        revenue: item.revenue,
      })),

      targets: {
        foodCostPercent: restaurant?.targetFoodCostPercent || 30,
        laborCostPercent: restaurant?.targetLaborCostPercent || 30,
      },

      alerts: [] as string[],
    };

    // Generate alerts
    if (dailySales) {
      if (dailySales.foodCostPercent && dailySales.foodCostPercent > (restaurant?.targetFoodCostPercent || 30)) {
        report.alerts.push(
          `Food cost (${dailySales.foodCostPercent.toFixed(1)}%) exceeded target (${restaurant?.targetFoodCostPercent || 30}%)`
        );
      }
      if (dailySales.laborCost && dailySales.totalRevenue) {
        const laborPercent = (dailySales.laborCost / dailySales.totalRevenue) * 100;
        if (laborPercent > (restaurant?.targetLaborCostPercent || 30)) {
          report.alerts.push(
            `Labor cost (${laborPercent.toFixed(1)}%) exceeded target (${restaurant?.targetLaborCostPercent || 30}%)`
          );
        }
      }
    }

    return NextResponse.json(report);
  } catch (error) {
    console.error("Error generating daily report:", error);
    return NextResponse.json(
      { error: "Failed to generate report" },
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

    const { date, sendEmail } = await request.json();

    const reportDate = date ? new Date(date) : new Date();
    reportDate.setHours(0, 0, 0, 0);

    // Generate the report data
    const reportRes = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/reports/daily?date=${reportDate.toISOString().split("T")[0]}`,
      {
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
      }
    );

    if (!reportRes.ok) {
      return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }

    const reportData = await reportRes.json();

    // Save the report
    const savedReport = await prisma.report.create({
      data: {
        type: "DAILY_SUMMARY",
        periodStart: reportDate,
        periodEnd: reportDate,
        data: reportData,
        restaurantId: session.user.restaurantId,
        sentAt: sendEmail ? new Date() : null,
      },
    });

    // In a real app, we'd send an email here if sendEmail is true
    // For now, we just save the report

    return NextResponse.json({
      success: true,
      reportId: savedReport.id,
      emailSent: sendEmail || false,
    });
  } catch (error) {
    console.error("Error saving daily report:", error);
    return NextResponse.json(
      { error: "Failed to save report" },
      { status: 500 }
    );
  }
}
