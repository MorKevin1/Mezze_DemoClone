"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  currentPrice: number;
  category: string;
  menuItems: { menuItem: { name: string } }[];
}

const CATEGORIES = [
  { value: "PROTEIN", label: "Protein" },
  { value: "PRODUCE", label: "Produce" },
  { value: "DAIRY", label: "Dairy" },
  { value: "DRY_GOODS", label: "Dry Goods" },
  { value: "BEVERAGES", label: "Beverages" },
  { value: "FROZEN", label: "Frozen" },
  { value: "SPICES", label: "Spices" },
  { value: "OTHER", label: "Other" },
];

const COMMON_UNITS = ["lb", "oz", "each", "gallon", "quart", "dozen", "case", "bag"];

interface ParsedIngredient {
  name: string;
  unit: string;
  pricePerUnit: number;
  category: string;
}

export default function IngredientsPage() {
  const { data: session, status } = useSession();
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    unit: "lb",
    currentPrice: "",
    category: "OTHER",
  });
  const [saving, setSaving] = useState(false);

  // Upload flow state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedIngredient[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user?.restaurantId) {
      fetchIngredients();
    }
  }, [session]);

  const fetchIngredients = async () => {
    try {
      const res = await fetch("/api/ingredients");
      if (res.ok) {
        const data = await res.json();
        setIngredients(data);
      }
    } catch (error) {
      console.error("Error fetching ingredients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const newIngredient = await res.json();
        setIngredients([...ingredients, newIngredient].sort((a, b) =>
          a.name.localeCompare(b.name)
        ));
        setShowModal(false);
        setFormData({ name: "", unit: "lb", currentPrice: "", category: "OTHER" });
      }
    } catch (error) {
      console.error("Error creating ingredient:", error);
    } finally {
      setSaving(false);
    }
  };

  // Upload flow handlers
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParseError(null);
    setUploadFile(file);

    const reader = new FileReader();
    reader.onload = (ev) => {
      setUploadPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleParseInvoice = async () => {
    if (!uploadFile) return;
    setParsing(true);
    setParseError(null);

    try {
      const formData = new FormData();
      formData.append("image", uploadFile);

      const res = await fetch("/api/ingredients/parse-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error && data.items?.length === 0) {
        setParseError(data.error);
        return;
      }

      if (data.items?.length === 0) {
        setParseError("No ingredients found in this image. Try a clearer photo.");
        return;
      }

      setParsedItems(data.items);
      setShowUploadModal(false);
      setShowReviewModal(true);
    } catch (error) {
      console.error("Error parsing invoice:", error);
      setParseError("Failed to parse image. Please try again.");
    } finally {
      setParsing(false);
    }
  };

  const handleImportIngredients = async () => {
    setImporting(true);

    try {
      const results = await Promise.allSettled(
        parsedItems.map((item) =>
          fetch("/api/ingredients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: item.name,
              unit: item.unit,
              currentPrice: item.pricePerUnit,
              category: item.category,
            }),
          })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;

      setShowReviewModal(false);
      setParsedItems([]);
      resetUploadState();
      await fetchIngredients();

      if (succeeded < results.length) {
        console.warn(`${results.length - succeeded} ingredients failed to import`);
      }
    } catch (error) {
      console.error("Error importing ingredients:", error);
    } finally {
      setImporting(false);
    }
  };

  const resetUploadState = () => {
    setUploadFile(null);
    setUploadPreview(null);
    setParseError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const updateParsedItem = (index: number, field: keyof ParsedIngredient, value: string | number) => {
    setParsedItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const removeParsedItem = (index: number) => {
    setParsedItems((prev) => prev.filter((_, i) => i !== index));
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!session) {
    redirect("/login");
  }

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find((c) => c.value === value)?.label || value;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      PROTEIN: "bg-red-100 text-red-700",
      PRODUCE: "bg-green-100 text-green-700",
      DAIRY: "bg-blue-100 text-blue-700",
      DRY_GOODS: "bg-amber-100 text-amber-700",
      BEVERAGES: "bg-purple-100 text-purple-700",
      FROZEN: "bg-cyan-100 text-cyan-700",
      SPICES: "bg-orange-100 text-orange-700",
      OTHER: "bg-gray-100 text-gray-700",
    };
    return colors[category] || colors.OTHER;
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ingredients</h1>
          <p className="text-gray-600 mt-1">
            {ingredients.length} ingredients · Track costs and link to dishes
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              resetUploadState();
              setShowUploadModal(true);
            }}
            className="border border-emerald-600 text-emerald-600 px-6 py-3 rounded-full hover:bg-emerald-50 transition font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload Invoice
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Ingredient
          </button>
        </div>
      </div>

      {/* Ingredients */}
      {ingredients.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No ingredients yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Add your ingredients with their costs per unit. Then link them to your menu items to automatically calculate dish margins.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                resetUploadState();
                setShowUploadModal(true);
              }}
              className="border border-emerald-600 text-emerald-600 px-6 py-3 rounded-full hover:bg-emerald-50 transition font-medium"
            >
              Upload Invoice
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition font-medium"
            >
              Add Your First Ingredient
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Ingredient</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Category</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Price</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Used In</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map((ingredient) => (
                <tr key={ingredient.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{ingredient.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(ingredient.category)}`}>
                      {getCategoryLabel(ingredient.category)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="font-medium text-gray-900">
                      ${ingredient.currentPrice.toFixed(2)}
                    </span>
                    <span className="text-gray-500 ml-1">/ {ingredient.unit}</span>
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {ingredient.menuItems?.length > 0 ? (
                      <span>{ingredient.menuItems.length} dishes</span>
                    ) : (
                      <span className="text-gray-400">Not linked</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Ingredient Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Ingredient</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ingredient Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Chicken Breast"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price *
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.currentPrice}
                      onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Per Unit *
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {COMMON_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Ingredient"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Invoice Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Invoice</h2>
            <p className="text-gray-500 mb-6">
              Take a photo of a supplier invoice and we&apos;ll extract the ingredients automatically.
            </p>

            <div className="space-y-4">
              {/* File input */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
                  uploadPreview ? "border-emerald-300 bg-emerald-50/50" : "border-gray-300 hover:border-emerald-400 hover:bg-gray-50"
                }`}
              >
                {uploadPreview ? (
                  <img
                    src={uploadPreview}
                    alt="Invoice preview"
                    className="max-h-48 mx-auto rounded-lg"
                  />
                ) : (
                  <>
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-600 font-medium">Click to select a photo</p>
                    <p className="text-gray-400 text-sm mt-1">JPEG, PNG, or WebP up to 10MB</p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {uploadPreview && (
                <button
                  onClick={() => {
                    setUploadFile(null);
                    setUploadPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Choose a different photo
                </button>
              )}

              {/* Error */}
              {parseError && (
                <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {parseError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetUploadState();
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleParseInvoice}
                  disabled={!uploadFile || parsing}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {parsing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Parsing...
                    </>
                  ) : (
                    "Parse Invoice"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Parsed Ingredients Modal */}
      {showReviewModal && parsedItems.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Review Extracted Ingredients</h2>
              <p className="text-gray-500 mt-1">
                {parsedItems.length} ingredients found. Edit or remove items before importing.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-3">
                {parsedItems.map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateParsedItem(index, "name", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                        <select
                          value={item.category}
                          onChange={(e) => updateParsedItem(index, "category", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          {CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Price per unit</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.pricePerUnit}
                            onChange={(e) => updateParsedItem(index, "pricePerUnit", parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                        <select
                          value={item.unit}
                          onChange={(e) => updateParsedItem(index, "unit", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        >
                          {COMMON_UNITS.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={() => removeParsedItem(index)}
                      className="text-red-400 hover:text-red-600 mt-5"
                      title="Remove item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setParsedItems([]);
                  resetUploadState();
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImportIngredients}
                disabled={importing || parsedItems.length === 0}
                className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Importing...
                  </>
                ) : (
                  `Import ${parsedItems.length} Ingredient${parsedItems.length !== 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
