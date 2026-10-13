import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseImageWithVision } from "@/lib/openai";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const VALID_CATEGORIES = ["PROTEIN", "PRODUCE", "DAIRY", "DRY_GOODS", "BEVERAGES", "FROZEN", "SPICES", "OTHER"];
const VALID_UNITS = ["lb", "oz", "each", "gallon", "quart", "dozen", "case", "bag"];

const INVOICE_PARSE_PROMPT = `Analyze this supplier invoice or ingredient list image and extract all line items. Return a JSON array of objects with these fields:
- "name": the ingredient/product name (string)
- "unit": the unit of measure, standardized to one of: lb, oz, each, gallon, quart, dozen, case, bag
- "pricePerUnit": the price per unit as a number (no currency symbols)
- "category": categorize into one of: PROTEIN, PRODUCE, DAIRY, DRY_GOODS, BEVERAGES, FROZEN, SPICES, OTHER

Only include items that have a clear name and price. If you cannot identify any items, return an empty array.

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

    const result = await parseImageWithVision(base64, file.type, INVOICE_PARSE_PROMPT);

    const items = JSON.parse(result);

    if (!Array.isArray(items)) {
      return NextResponse.json({ items: [], error: "Could not parse invoice items from image" });
    }

    // Validate and clean each item
    const cleanedItems = items
      .filter((item: { name?: string; pricePerUnit?: number }) => item.name && typeof item.pricePerUnit === "number")
      .map((item: { name: string; unit?: string; pricePerUnit: number; category?: string }) => ({
        name: String(item.name).trim(),
        unit: VALID_UNITS.includes(item.unit || "") ? item.unit : "each",
        pricePerUnit: Math.round(Number(item.pricePerUnit) * 100) / 100,
        category: VALID_CATEGORIES.includes(item.category || "") ? item.category : "OTHER",
      }));

    return NextResponse.json({ items: cleanedItems });
  } catch (error) {
    console.error("Error parsing invoice image:", error);
    return NextResponse.json(
      { items: [], error: "Failed to parse invoice image. Please try again with a clearer photo." },
      { status: 500 }
    );
  }
}
