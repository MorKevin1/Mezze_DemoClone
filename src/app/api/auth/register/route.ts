// Registration API endpoint
// POST /api/auth/register - Create a new user and restaurant

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// Generate a URL-friendly slug from restaurant name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Sanitize inputs (trim whitespace)
    const restaurantName = body.restaurantName?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const name = body.name?.trim();

    // Validate required fields
    if (!email || !password || !restaurantName) {
      return NextResponse.json(
        { error: "Restaurant name, email, and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // Validate restaurant name length
    if (restaurantName.length < 2 || restaurantName.length > 100) {
      return NextResponse.json(
        { error: "Restaurant name must be between 2 and 100 characters" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Generate unique slug for restaurant
    let slug = generateSlug(restaurantName);
    let slugExists = await prisma.restaurant.findUnique({ where: { slug } });
    let counter = 1;
    while (slugExists) {
      slug = `${generateSlug(restaurantName)}-${counter}`;
      slugExists = await prisma.restaurant.findUnique({ where: { slug } });
      counter++;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create restaurant and user together
    const restaurant = await prisma.restaurant.create({
      data: {
        name: restaurantName,
        slug,
        users: {
          create: {
            email,
            password: hashedPassword,
            name: name || null,
            role: "OWNER", // First user is the owner
          },
        },
      },
      include: {
        users: true,
      },
    });

    const user = restaurant.users[0];

    return NextResponse.json({
      message: "Account created successfully",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
