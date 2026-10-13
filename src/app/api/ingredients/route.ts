// Ingredients API
// GET /api/ingredients - List all ingredients for the restaurant
// POST /api/ingredients - Create a new ingredient

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ingredients = await prisma.ingredient.findMany({
      where: { restaurantId: session.user.restaurantId },
      include: {
        vendor: true,
        menuItems: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(ingredients);
  } catch (error) {
    console.error("Error fetching ingredients:", error);
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
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

    // Sanitize inputs
    const name = body.name?.trim();
    const unit = body.unit?.trim();
    const currentPrice = body.currentPrice;
    const category = body.category;

    // Validate required fields
    if (!name || !unit || currentPrice === undefined) {
      return NextResponse.json(
        { error: "Name, unit, and price are required" },
        { status: 400 }
      );
    }

    // Validate price is a positive number
    const parsedPrice = parseFloat(currentPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { error: "Price must be a valid positive number" },
        { status: 400 }
      );
    }

    // Validate name and unit length
    if (name.length < 1 || name.length > 200) {
      return NextResponse.json(
        { error: "Name must be between 1 and 200 characters" },
        { status: 400 }
      );
    }

    // Validate category is a valid enum value
    const validCategories = ["PROTEIN", "PRODUCE", "DAIRY", "DRY_GOODS", "BEVERAGES", "FROZEN", "SPICES", "OTHER"];
    const validCategory = validCategories.includes(category) ? category : "OTHER";

    const ingredient = await prisma.ingredient.create({
      data: {
        name,
        unit,
        currentPrice: parsedPrice,
        category: validCategory,
        restaurantId: session.user.restaurantId,
      },
      include: {
        vendor: true,
        menuItems: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    // Record initial price in history
    await prisma.ingredientPriceHistory.create({
      data: {
        ingredientId: ingredient.id,
        price: parseFloat(currentPrice),
        source: "manual",
      },
    });

    return NextResponse.json(ingredient);
  } catch (error) {
    console.error("Error creating ingredient:", error);
    return NextResponse.json(
      { error: "Failed to create ingredient" },
      { status: 500 }
    );
  }
}
