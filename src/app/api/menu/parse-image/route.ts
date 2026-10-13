import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseImageWithVision } from "@/lib/openai";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MENU_PARSE_PROMPT = `Analyze this menu image and extract all menu items. Return a JSON array of objects with these fields:
- "name": the dish name (string)
- "description": a brief description if visible, otherwise empty string
- "price": the price as a number (no currency symbols)

Only include items that have a clear name and price. If you cannot identify any menu items, return an empty array.

Return ONLY the JSON array, no other text.`;

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.restaurantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");

    const result = await parseImageWithVision(base64, file.type, MENU_PARSE_PROMPT);

    const items = JSON.parse(result);

    if (!Array.isArray(items)) {
      return NextResponse.json({ items: [], error: "Could not parse menu items from image" });
    }

    // Validate and clean each item
    const cleanedItems = items
      .filter((item: { name?: string; price?: number }) => item.name && typeof item.price === "number")
      .map((item: { name: string; description?: string; price: number }) => ({
        name: String(item.name).trim(),
        description: String(item.description || "").trim(),
        price: Math.round(Number(item.price) * 100) / 100,
      }));

    return NextResponse.json({ items: cleanedItems });
  } catch (error) {
    console.error("Error parsing menu image:", error);
    return NextResponse.json(
      { items: [], error: "Failed to parse menu image. Please try again with a clearer photo." },
      { status: 500 }
    );
  }
}
