"use client";

import { useState } from "react";
import { Product } from "@/types/commerce";
import {
  Package,
  Plus,
  Search,
  Filter,
  ExternalLink,
  Edit,
  ChevronDown,
  ArrowUpDown,
  Download,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AdminProductsClientProps {
  initialProducts: Product[];
}

export default function AdminProductsClient({ initialProducts }: AdminProductsClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "active" | "draft" | "archived">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New Product Form State
  const [newProduct, setNewProduct] = useState({
    name: "",
    slug: "",
    tagline: "",
    short_description: "",
    product_type: "Digital Workbook",
    format: "pdf",
    format_label: "PDF (Print-Ready)",
  });

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (activeTab === "all") return true;
    if (activeTab === "active") return p.status === "published";
    if (activeTab === "draft") return p.status === "draft";
    if (activeTab === "archived") return p.status === "archived";
    return true;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredProducts.map((p) => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExportCSV = () => {
    const headers = "ID,Name,Slug,Status,Price,Currency,Format,Created\n";
    const rows = filteredProducts
      .map(
        (p) =>
          `"${p.id}","${p.name.replace(/"/g, '""')}","${p.slug}","${p.status}",${p.price},"${p.currency}","${p.format}","${p.createdAt}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sevolf-products-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create product");
      }

      setFeedback({ type: "success", message: `Draft product "${newProduct.name}" created successfully!` });
      setIsAddModalOpen(false);
      setNewProduct({
        name: "",
        slug: "",
        tagline: "",
        short_description: "",
        product_type: "Digital Workbook",
        format: "pdf",
        format_label: "PDF (Print-Ready)",
      });

      // Refresh list
      router.refresh();
      // Optimistically add to state
      const createdItem: Product = {
        id: data.product.id,
        name: data.product.name,
        slug: data.product.slug,
        tagline: data.product.tagline || "",
        shortDescription: data.product.short_description || "",
        fullDescription: data.product.full_description || "",
        category: "home-living",
        categoryLabel: "Home & Living",
        productType: data.product.product_type || "Digital Workbook",
        format: data.product.format || "pdf",
        formatLabel: data.product.format_label || "PDF (Print-Ready)",
        price: 499,
        currency: "INR",
        coverImage: data.product.cover_image_url || "/images/products/home-reset-kit/cover.jpg",
        galleryImages: [],
        mockupImages: [],
        features: [],
        whatsIncluded: [],
        requirements: ["PDF reader"],
        licenceType: "personal",
        licenceDescription: "Single-household personal licence.",
        status: "draft",
        isFeatured: false,
        isNewArrival: false,
        isBestseller: false,
        tags: data.product.tags || ["digital", "draft"],
        seoTitle: data.product.seo_title || data.product.name,
        seoDescription: data.product.seo_description || data.product.short_description,
        createdAt: data.product.created_at,
        updatedAt: data.product.updated_at,
      };
      setProducts((prev) => [createdItem, ...prev]);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDraft = async (slug: string, name: string) => {
    if (!confirm(`Are you sure you want to delete or archive the draft product "${name}"?`)) return;

    try {
      const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete product");

      setFeedback({ type: "success", message: `Draft "${name}" removed successfully.` });
      setProducts((prev) => prev.filter((p) => p.slug !== slug));
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#E3F1DF] border-[#C3E6BD] text-[#008060]"
              : "bg-[#FFF4F4] border-[#FED2D2] text-[#D72C0D]"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-current opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Products</h1>
          <p className="text-xs text-[#6D7175]">
            Manage catalogue, digital file bindings, version history, and draft product specifications.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 border border-[#BABFC3] bg-white text-[#202223] text-xs font-semibold rounded-md shadow-2xs hover:bg-[#F6F6F7] transition-colors flex items-center space-x-1"
          >
            <Download className="w-3 h-3 text-[#6D7175]" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors flex items-center space-x-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Main Table Card (Shopify Polaris Table Style) */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        {/* Table Tabs & Filter Controls */}
        <div className="border-b border-[#E1E3E5]">
          <div className="flex items-center space-x-4 px-4 pt-2 text-xs font-medium text-[#6D7175]">
            <button
              onClick={() => setActiveTab("all")}
              className={`pb-2 transition-colors ${
                activeTab === "all"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setActiveTab("active")}
              className={`pb-2 transition-colors ${
                activeTab === "active"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              Active ({products.filter((p) => p.status === "published").length})
            </button>
            <button
              onClick={() => setActiveTab("draft")}
              className={`pb-2 transition-colors ${
                activeTab === "draft"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              Drafts ({products.filter((p) => p.status === "draft").length})
            </button>
            <button
              onClick={() => setActiveTab("archived")}
              className={`pb-2 transition-colors ${
                activeTab === "archived"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              Archived ({products.filter((p) => p.status === "archived").length})
            </button>
          </div>

          <div className="p-3 bg-[#FAFBFB] border-t border-[#E1E3E5] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-[#8C9196] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by title or tag..."
                className="w-full text-xs bg-white border border-[#BABFC3] rounded pl-8 pr-3 py-1.5 text-[#202223] placeholder-[#8C9196] focus:outline-hidden focus:border-[#202223]"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto justify-end text-xs">
              <button
                onClick={() => router.refresh()}
                className="flex items-center space-x-1 px-2.5 py-1.5 bg-white border border-[#BABFC3] rounded text-[#202223] font-medium shadow-2xs hover:bg-[#F6F6F7]"
                title="Refresh products from database"
              >
                <RefreshCw className="w-3 h-3 text-[#6D7175]" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selected Batch Action Bar */}
        {selectedIds.length > 0 && (
          <div className="bg-[#F1F8F5] border-b border-[#C3E6BD] px-4 py-2 flex items-center justify-between text-xs text-[#008060] font-medium">
            <span>{selectedIds.length} product(s) selected</span>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-[#6D7175]">Bulk batch actions active</span>
            </div>
          </div>
        )}

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E1E3E5] bg-[#FAFBFB] text-[#6D7175] font-medium">
                <th className="py-2.5 px-4 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-[#BABFC3] text-[#008060] focus:ring-0"
                    checked={selectedIds.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="py-2.5 px-4">Product</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Type</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4">Staging Price</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E3E5]">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#6D7175]">
                    No products match your criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-[#F6F6F7]/80 transition-colors ${
                        isSelected ? "bg-[#F1F8F5]/50" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(p.id)}
                          className="rounded border-[#BABFC3] text-[#008060] focus:ring-0"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded bg-[#F6F6F7] border border-[#E1E3E5] flex items-center justify-center shrink-0">
                            <Package className="w-4 h-4 text-[#6D7175]" />
                          </div>
                          <div>
                            <Link
                              href={`/admin/products/${p.slug}`}
                              className="font-semibold text-[#202223] hover:underline"
                            >
                              {p.name}
                            </Link>
                            <p className="text-[11px] font-mono text-[#6D7175]">/{p.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                            p.status === "published"
                              ? "bg-[#E3F1DF] text-[#008060]"
                              : p.status === "draft"
                              ? "bg-[#FDF8E2] text-[#B98900]"
                              : "bg-[#F1F2F3] text-[#6D7175]"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#6D7175]">{p.productType}</td>
                      <td className="py-3 px-4 text-[#6D7175]">{p.categoryLabel}</td>
                      <td className="py-3 px-4 font-mono font-medium text-[#202223]">
                        ₹{p.price}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/admin/products/${p.slug}`}
                            className="p-1 hover:bg-[#E1E3E5] rounded text-[#6D7175] hover:text-[#202223]"
                            title="Edit Product"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>
                          {p.status === "draft" && (
                            <button
                              onClick={() => handleDeleteDraft(p.slug, p.name)}
                              className="p-1 hover:bg-[#FFF4F4] rounded text-[#6D7175] hover:text-[#D72C0D]"
                              title="Delete/Archive Draft"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3 border-t border-[#E1E3E5] bg-[#FAFBFB] flex items-center justify-between text-xs text-[#6D7175]">
          <span>
            Showing {filteredProducts.length} of {products.length} products
          </span>
          <span className="text-[11px] font-mono text-[#008060] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Phase 1C Invariant: Flagship Products Gated in Draft
          </span>
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#E1E3E5] shadow-xl w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E1E3E5]">
              <div className="flex items-center space-x-2">
                <Package className="w-5 h-5 text-[#008060]" />
                <h3 className="text-sm font-bold text-[#202223]">Add New Digital Product</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-[#6D7175] hover:text-[#202223]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#202223] mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30-Day Declutter Workbook"
                  value={newProduct.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    setNewProduct((prev) => ({ ...prev, name, slug }));
                  }}
                  className="w-full bg-white border border-[#BABFC3] rounded px-3 py-2 text-[#202223] focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Slug (URL Path) *</label>
                <div className="flex items-center bg-[#FAFBFB] border border-[#BABFC3] rounded px-2">
                  <span className="text-[#8C9196] font-mono">/shop/products/</span>
                  <input
                    type="text"
                    required
                    value={newProduct.slug}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                      }))
                    }
                    className="w-full bg-transparent border-0 px-1 py-2 text-[#202223] font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Tagline</label>
                <input
                  type="text"
                  placeholder="Quiet clarity for intentional daily spaces."
                  value={newProduct.tagline}
                  onChange={(e) => setNewProduct((prev) => ({ ...prev, tagline: e.target.value }))}
                  className="w-full bg-white border border-[#BABFC3] rounded px-3 py-2 text-[#202223] focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202223] mb-1">Product Type</label>
                  <select
                    value={newProduct.product_type}
                    onChange={(e) => setNewProduct((prev) => ({ ...prev, product_type: e.target.value }))}
                    className="w-full bg-white border border-[#BABFC3] rounded px-2.5 py-2 text-[#202223] focus:outline-hidden"
                  >
                    <option value="Digital Workbook">Digital Workbook</option>
                    <option value="Printable Activity">Printable Activity</option>
                    <option value="Tablet Planner">Tablet Planner</option>
                    <option value="Founder Framework">Founder Framework</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#202223] mb-1">File Format</label>
                  <select
                    value={newProduct.format}
                    onChange={(e) =>
                      setNewProduct((prev) => ({
                        ...prev,
                        format: e.target.value,
                        format_label: e.target.value.toUpperCase() + " (Print-Ready)",
                      }))
                    }
                    className="w-full bg-white border border-[#BABFC3] rounded px-2.5 py-2 text-[#202223] focus:outline-hidden"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="zip">ZIP Bundle</option>
                    <option value="epub">ePub Book</option>
                  </select>
                </div>
              </div>

              <div className="bg-[#FAFBFB] p-3 rounded border border-[#E1E3E5] space-y-1">
                <span className="font-semibold text-[#202223] block">Lifecycle Status Policy:</span>
                <p className="text-[11px] text-[#6D7175]">
                  New products are automatically created in <strong>Draft</strong> status and saved directly to the database. Publishing to the live store is restricted pending Phase 2 commercial authorization.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E1E3E5]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 border border-[#BABFC3] rounded bg-white text-[#202223] font-semibold hover:bg-[#F6F6F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white font-semibold rounded shadow-2xs flex items-center space-x-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? <span>Saving...</span> : <span>Save Draft Product</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
