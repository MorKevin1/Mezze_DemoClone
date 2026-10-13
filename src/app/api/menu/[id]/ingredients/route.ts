// Menu Item Ingredients API
// GET /api/menu/[id]/ingredients - Get ingredients for a menu item
// POST /api/menu/[id]/ingredients - Add ingredient to menu item
// DELETE /api/menu/[id]/ingredients - Remove ingredient from menu item

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
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

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    return NextResponse.json(menuItem.ingredients);
  } catch (error) {
    console.error("Error fetching menu item ingredients:", error);
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Sanitize inputs
    const ingredientId = body.ingredientId?.trim();
    const quantity = body.quantity;
    const unit = body.unit?.trim();

    // Validate required fields
    if (!ingredientId || quantity === undefined || !unit) {
      return NextResponse.json(
        { error: "Ingredient ID, quantity, and unit are required" },
        { status: 400 }
      );
    }

    // Validate quantity is a positive number
    const parsedQuantity = parseFloat(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return NextResponse.json(
        { error: "Quantity must be a valid positive number" },
        { status: 400 }
      );
    }

    // Verify menu item belongs to this restaurant
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: session.user.restaurantId,
      },
    });

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    // Verify ingredient belongs to this restaurant
    const ingredient = await prisma.ingredient.findFirst({
      where: {
        id: ingredientId,
        restaurantId: session.user.restaurantId,
      },
    });

    if (!ingredient) {
      return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
    }

    // Upsert the menu item ingredient (update if exists, create if not)
    const menuItemIngredient = await prisma.menuItemIngredient.upsert({
      where: {
        menuItemId_ingredientId: {
          menuItemId: id,
          ingredientId,
        },
      },
      update: {
        quantity: parsedQuantity,
        unit,
      },
      create: {
        menuItemId: id,
        ingredientId,
        quantity: parsedQuantity,
        unit,
      },
      include: {
        ingredient: true,
      },
    });

    return NextResponse.json(menuItemIngredient);
  } catch (error) {
    console.error("Error adding ingredient to menu item:", error);
    return NextResponse.json(
      { error: "Failed to add ingredient" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { ingredientId } = await request.json();

    if (!ingredientId) {
      return NextResponse.json(
        { error: "Ingredient ID is required" },
        { status: 400 }
      );
    }

    // Verify menu item belongs to this restaurant
    const menuItem = await prisma.menuItem.findFirst({
      where: {
        id,
        restaurantId: session.user.restaurantId,
      },
    });

    if (!menuItem) {
      return NextResponse.json({ error: "Menu item not found" }, { status: 404 });
    }

    await prisma.menuItemIngredient.delete({
      where: {
        menuItemId_ingredientId: {
          menuItemId: id,
          ingredientId,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing ingredient from menu item:", error);
    return NextResponse.json(
      { error: "Failed to remove ingredient" },
      { status: 500 }
    );
  }
}
