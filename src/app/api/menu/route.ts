// Menu Items API
// GET /api/menu - List all menu items for the restaurant
// POST /api/menu - Create a new menu item

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

    const menuItems = await prisma.menuItem.findMany({
      where: { restaurantId: session.user.restaurantId },
      include: {
        category: true,
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate cost and margin for each item
    const itemsWithMargins = menuItems.map((item) => {
      const cost = item.ingredients.reduce((total, mi) => {
        return total + mi.quantity * mi.ingredient.currentPrice;
      }, 0);

      const margin = item.price > 0 ? ((item.price - cost) / item.price) * 100 : 0;
      const marginAmount = item.price - cost;

      return {
        ...item,
        cost: Math.round(cost * 100) / 100,
        margin: Math.round(margin * 10) / 10,
        marginAmount: Math.round(marginAmount * 100) / 100,
      };
    });

    return NextResponse.json(itemsWithMargins);
  } catch (error) {
    console.error("Error fetching menu items:", error);
    return NextResponse.json(
      { error: "Failed to fetch menu items" },
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
    const description = body.description?.trim();
    const price = body.price;
    const categoryId = body.categoryId;

    // Validate required fields
    if (!name || price === undefined) {
      return NextResponse.json(
        { error: "Name and price are required" },
        { status: 400 }
      );
    }

    // Validate price is a positive number
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { error: "Price must be a valid positive number" },
        { status: 400 }
      );
    }

    // Validate name length
    if (name.length < 1 || name.length > 200) {
      return NextResponse.json(
        { error: "Name must be between 1 and 200 characters" },
        { status: 400 }
      );
    }

    const menuItem = await prisma.menuItem.create({
      data: {
        name,
        description: description || null,
        price: parsedPrice,
        categoryId: categoryId || null,
        restaurantId: session.user.restaurantId,
      },
      include: {
        category: true,
        ingredients: {
          include: {
            ingredient: true,
          },
        },
      },
    });

    return NextResponse.json({
      ...menuItem,
      cost: 0,
      margin: 100,
      marginAmount: menuItem.price,
    });
  } catch (error) {
    console.error("Error creating menu item:", error);
    return NextResponse.json(
      { error: "Failed to create menu item" },
      { status: 500 }
    );
  }
}
