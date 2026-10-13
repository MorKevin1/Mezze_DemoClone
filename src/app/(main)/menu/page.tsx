"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect, useRef } from "react";

interface MenuItemIngredient {
  id: string;
  quantity: number;
  unit: string;
  ingredient: {
    id: string;
    name: string;
    currentPrice: number;
    unit: string;
  };
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost: number;
  margin: number;
  marginAmount: number;
  isActive: boolean;
  ingredients: MenuItemIngredient[];
}

interface Ingredient {
  id: string;
  name: string;
  currentPrice: number;
  unit: string;
}

interface ParsedMenuItem {
  name: string;
  description: string;
  price: number;
}

export default function MenuPage() {
  const { data: session, status } = useSession();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "", price: "" });
  const [ingredientForm, setIngredientForm] = useState({ ingredientId: "", quantity: "", unit: "" });
  const [saving, setSaving] = useState(false);

  // Upload flow state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<ParsedMenuItem[]>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session?.user?.restaurantId) {
      fetchMenuItems();
      fetchIngredients();
    }
  }, [session]);

  const fetchMenuItems = async () => {
    try {
      const res = await fetch("/api/menu");
      if (res.ok) {
        const data = await res.json();
        setMenuItems(data);
      }
    } catch (error) {
      console.error("Error fetching menu items:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIngredients = async () => {
    try {
      const res = await fetch("/api/ingredients");
      if (res.ok) {
        const data = await res.json();
        setIngredients(data);
      }
    } catch (error) {
      console.error("Error fetching ingredients:", error);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        const newItem = await res.json();
        setMenuItems([newItem, ...menuItems]);
        setShowAddModal(false);
        setFormData({ name: "", description: "", price: "" });
      }
    } catch (error) {
      console.error("Error creating menu item:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/menu/${selectedItem.id}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingredientForm),
      });

      if (res.ok) {
        // Refresh menu items to get updated costs
        await fetchMenuItems();
        // Update selected item
        const updatedItems = await fetch("/api/menu").then(r => r.json());
        const updated = updatedItems.find((i: MenuItem) => i.id === selectedItem.id);
        setSelectedItem(updated);
        setIngredientForm({ ingredientId: "", quantity: "", unit: "" });
      }
    } catch (error) {
      console.error("Error adding ingredient:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveIngredient = async (ingredientId: string) => {
    if (!selectedItem) return;

    try {
      const res = await fetch(`/api/menu/${selectedItem.id}/ingredients`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredientId }),
      });

      if (res.ok) {
        await fetchMenuItems();
        const updatedItems = await fetch("/api/menu").then(r => r.json());
        const updated = updatedItems.find((i: MenuItem) => i.id === selectedItem.id);
        setSelectedItem(updated);
      }
    } catch (error) {
      console.error("Error removing ingredient:", error);
    }
  };

  const openEditModal = (item: MenuItem) => {
    setSelectedItem(item);
    setShowEditModal(true);
  };

  const getSelectedIngredient = () => {
    return ingredients.find(i => i.id === ingredientForm.ingredientId);
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

  const handleParseMenu = async () => {
    if (!uploadFile) return;
    setParsing(true);
    setParseError(null);

    try {
      const formData = new FormData();
      formData.append("image", uploadFile);

      const res = await fetch("/api/menu/parse-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error && data.items?.length === 0) {
        setParseError(data.error);
        return;
      }

      if (data.items?.length === 0) {
        setParseError("No menu items found in this image. Try a clearer photo.");
        return;
      }

      setParsedItems(data.items);
      setShowUploadModal(false);
      setShowReviewModal(true);
    } catch (error) {
      console.error("Error parsing menu:", error);
      setParseError("Failed to parse image. Please try again.");
    } finally {
      setParsing(false);
    }
  };

  const handleImportItems = async () => {
    setImporting(true);

    try {
      const results = await Promise.allSettled(
        parsedItems.map((item) =>
          fetch("/api/menu", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: item.name,
              description: item.description,
              price: item.price,
            }),
          })
        )
      );

      const succeeded = results.filter((r) => r.status === "fulfilled").length;

      setShowReviewModal(false);
      setParsedItems([]);
      resetUploadState();
      await fetchMenuItems();

      if (succeeded < results.length) {
        console.warn(`${results.length - succeeded} items failed to import`);
      }
    } catch (error) {
      console.error("Error importing items:", error);
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

  const updateParsedItem = (index: number, field: keyof ParsedMenuItem, value: string | number) => {
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

  const getMarginColor = (margin: number) => {
    if (margin >= 70) return "text-emerald-600 bg-emerald-50";
    if (margin >= 50) return "text-yellow-600 bg-yellow-50";
    return "text-red-600 bg-red-50";
  };

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Menu</h1>
          <p className="text-gray-600 mt-1">
            {menuItems.length} items · Click an item to add ingredients
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
            Upload Menu Photo
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Menu Item
          </button>
        </div>
      </div>

      {/* Menu Items */}
      {menuItems.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center border border-gray-100">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No menu items yet</h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Start by adding your dishes. Include the name and selling price — you can add ingredient costs later to see your margins.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => {
                resetUploadState();
                setShowUploadModal(true);
              }}
              className="border border-emerald-600 text-emerald-600 px-6 py-3 rounded-full hover:bg-emerald-50 transition font-medium"
            >
              Upload Menu Photo
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition font-medium"
            >
              Add Your First Dish
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Item</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Price</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Cost</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Profit</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-gray-600">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {menuItems.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => openEditModal(item)}
                  className="hover:bg-gray-50 transition cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{item.name}</div>
                    {item.description && (
                      <div className="text-sm text-gray-500">{item.description}</div>
                    )}
                    {item.ingredients?.length > 0 && (
                      <div className="text-xs text-gray-400 mt-1">
                        {item.ingredients.length} ingredient{item.ingredients.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-gray-900">
                    ${item.price.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {item.cost > 0 ? `$${item.cost.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right text-gray-600">
                    {item.cost > 0 ? `$${item.marginAmount.toFixed(2)}` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {item.cost > 0 ? (
                      <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getMarginColor(item.margin)}`}>
                        {item.margin.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">Add ingredients</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Menu Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Add Menu Item</h2>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dish Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Chicken Parmesan"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="e.g., Served with spaghetti and marinara"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selling Price *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {saving ? "Adding..." : "Add Item"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Menu Item Modal (Add Ingredients) */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedItem.name}</h2>
                  <p className="text-gray-500 mt-1">Selling Price: ${selectedItem.price.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Cost Summary */}
              <div className="mt-4 grid grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-500">Cost</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${selectedItem.cost?.toFixed(2) || "0.00"}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-sm text-gray-500">Profit</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${selectedItem.marginAmount?.toFixed(2) || selectedItem.price.toFixed(2)}
                  </div>
                </div>
                <div className={`rounded-lg p-3 ${selectedItem.cost > 0 ? getMarginColor(selectedItem.margin) : "bg-gray-50"}`}>
                  <div className="text-sm opacity-75">Margin</div>
                  <div className="text-xl font-bold">
                    {selectedItem.cost > 0 ? `${selectedItem.margin.toFixed(1)}%` : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* Ingredients List */}
            <div className="flex-1 overflow-auto p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Ingredients</h3>

              {selectedItem.ingredients?.length > 0 ? (
                <div className="space-y-2 mb-6">
                  {selectedItem.ingredients.map((mi) => (
                    <div
                      key={mi.id}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3"
                    >
                      <div>
                        <span className="font-medium text-gray-900">{mi.ingredient.name}</span>
                        <span className="text-gray-500 ml-2">
                          {mi.quantity} {mi.unit}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-gray-600">
                          ${(mi.quantity * mi.ingredient.currentPrice).toFixed(2)}
                        </span>
                        <button
                          onClick={() => handleRemoveIngredient(mi.ingredient.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 mb-6">No ingredients added yet. Add ingredients below to calculate the cost.</p>
              )}

              {/* Add Ingredient Form */}
              <div className="border-t border-gray-100 pt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Add Ingredient</h3>
                {ingredients.length === 0 ? (
                  <p className="text-gray-500">
                    No ingredients available.{" "}
                    <a href="/ingredients" className="text-emerald-600 hover:underline">
                      Add ingredients first
                    </a>
                  </p>
                ) : (
                  <form onSubmit={handleAddIngredient} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ingredient
                      </label>
                      <select
                        value={ingredientForm.ingredientId}
                        onChange={(e) => {
                          const ing = ingredients.find(i => i.id === e.target.value);
                          setIngredientForm({
                            ...ingredientForm,
                            ingredientId: e.target.value,
                            unit: ing?.unit || ""
                          });
                        }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      >
                        <option value="">Select an ingredient...</option>
                        {ingredients.map((ing) => (
                          <option key={ing.id} value={ing.id}>
                            {ing.name} (${ing.currentPrice.toFixed(2)}/{ing.unit})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Quantity
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={ingredientForm.quantity}
                          onChange={(e) => setIngredientForm({ ...ingredientForm, quantity: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="0.00"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Unit
                        </label>
                        <input
                          type="text"
                          value={ingredientForm.unit}
                          onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          placeholder="lb, oz, each..."
                          required
                        />
                      </div>
                    </div>
                    {ingredientForm.ingredientId && ingredientForm.quantity && (
                      <div className="bg-emerald-50 rounded-lg p-3 text-emerald-700">
                        Cost: ${(parseFloat(ingredientForm.quantity || "0") * (getSelectedIngredient()?.currentPrice || 0)).toFixed(2)}
                      </div>
                    )}
                    <button
                      type="submit"
                      disabled={saving}
                      className="w-full bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
                    >
                      {saving ? "Adding..." : "Add Ingredient"}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Menu Photo Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Menu Photo</h2>
            <p className="text-gray-500 mb-6">
              Take a photo of your menu and we&apos;ll extract the items automatically.
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
                    alt="Menu preview"
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
                  onClick={handleParseMenu}
                  disabled={!uploadFile || parsing}
                  className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {parsing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Parsing...
                    </>
                  ) : (
                    "Parse Menu"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Review Parsed Items Modal */}
      {showReviewModal && parsedItems.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900">Review Extracted Items</h2>
              <p className="text-gray-500 mt-1">
                {parsedItems.length} items found. Edit or remove items before importing.
              </p>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-3">
                {parsedItems.map((item, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4 flex items-start gap-4">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Name</label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateParsedItem(index, "name", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateParsedItem(index, "description", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) => updateParsedItem(index, "price", parseFloat(e.target.value) || 0)}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                          />
                        </div>
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
                onClick={handleImportItems}
                disabled={importing || parsedItems.length === 0}
                className="flex-1 bg-emerald-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Importing...
                  </>
                ) : (
                  `Import ${parsedItems.length} Item${parsedItems.length !== 1 ? "s" : ""}`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
