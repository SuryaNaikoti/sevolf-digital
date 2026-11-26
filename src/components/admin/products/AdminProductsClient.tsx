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
  Download,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";

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
    full_description: "",
    product_type: "Digital Workbook",
    format: "pdf",
    format_label: "PDF (Print-Ready)",
    tags: "digital, workbook",
    cover_image_url: "/images/products/home-reset-kit/cover.jpg",
    price: "499",
    currency: "INR" as "INR" | "USD" | "GBP" | "EUR",
    compare_at_amount: "",
    is_price_active: true,
    seo_title: "",
    seo_description: "",
    status: "draft" as "draft" | "published",
  });
  const [uploadedAssets, setUploadedAssets] = useState<
    Array<{ file_name: string; storage_path: string; file_size_bytes: number; mime_type: string; file_version: string }>
  >([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

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
          `"${p.id}","${p.name}","${p.slug}","${p.status}",${p.price},"${p.currency}","${p.formatLabel}","${p.createdAt}"`
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `sevolf-products-${Date.now()}.csv`);
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
        body: JSON.stringify({
          name: newProduct.name,
          slug: newProduct.slug,
          tagline: newProduct.tagline,
          short_description: newProduct.short_description,
          full_description: newProduct.full_description,
          product_type: newProduct.product_type,
          format: newProduct.format,
          format_label: newProduct.format_label,
          cover_image_url: newProduct.cover_image_url,
          tags: newProduct.tags.split(",").map((t) => t.trim()).filter(Boolean),
          price: newProduct.price ? Number(newProduct.price) : undefined,
          currency: newProduct.currency,
          compare_at_amount: newProduct.compare_at_amount ? Number(newProduct.compare_at_amount) : null,
          is_price_active: newProduct.is_price_active,
          seo_title: newProduct.seo_title || newProduct.name,
          seo_description: newProduct.seo_description || newProduct.short_description,
          status: "draft",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create product");

      // Register any uploaded digital assets against the newly created product
      for (const asset of uploadedAssets) {
        await fetch("/api/admin/assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...asset,
            product_id: data.product.id,
          }),
        });
      }

      // If user requested Publish and conditions are met, transition status
      if (newProduct.status === "published") {
        const pubRes = await fetch(`/api/admin/products/${data.product.slug}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "published" }),
        });
        if (!pubRes.ok) {
          const pubErr = await pubRes.json();
          setFeedback({
            type: "error",
            message: `Product saved as Draft, but could not publish: ${pubErr.error}`,
          });
        } else {
          setFeedback({ type: "success", message: `Product "${data.product.name}" created and published!` });
        }
      } else {
        setFeedback({ type: "success", message: `Product "${data.product.name}" created in draft status!` });
      }

      setIsAddModalOpen(false);
      setUploadedAssets([]);
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Products & Catalogue"
        subtitle="Manage SEVOLF digital educational workbooks, planners, and downloadable resources."
        badge={{ text: `${products.length} Items`, variant: "neutral" }}
        actions={
          <div className="flex items-center space-x-2.5">
            <AdminButton variant="secondary" icon={Download} onClick={handleExportCSV}>
              Export
            </AdminButton>
            <AdminButton variant="primary" icon={Plus} onClick={() => setIsAddModalOpen(true)}>
              Add Product
            </AdminButton>
          </div>
        }
      />

      {feedback && (
        <div
          className={`p-4 rounded-lg text-xs flex items-center space-x-2.5 border ${
            feedback.type === "success"
              ? "bg-[#F2F5F0] border-[#D4DCCF] text-[#55694B]"
              : "bg-[#FDF4F3] border-[#F0D0CD] text-[#9A423B]"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Table Card */}
      <AdminCard padding={false}>
        {/* Navigation Tabs & Search Controls */}
        <div className="p-4 sm:p-5 border-b border-[#E8E5DD] flex flex-col md:flex-row items-center justify-between gap-4 bg-[#FDFCFA]">
          {/* Status Tabs */}
          <div className="flex items-center space-x-1 border border-[#E8E5DD] p-1 rounded-lg bg-white w-full md:w-auto">
            {(["all", "active", "draft", "archived"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded text-xs font-sans capitalize transition-colors ${
                  activeTab === tab
                    ? "bg-[#20211F] text-white font-medium shadow-xs"
                    : "text-[#85847D] hover:text-[#22231F]"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-3.5 h-3.5 text-[#85847D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by title, tag, slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-sans bg-white border border-[#E8E5DD] rounded-md pl-8 pr-3 py-1.5 text-[#22231F] placeholder-[#85847D] focus:outline-hidden focus:border-[#85866A]"
            />
          </div>
        </div>

        {/* Products Table */}
        {filteredProducts.length === 0 ? (
          <AdminEmptyState
            icon={Package}
            title="No Products Found"
            description="No digital products match your filter. Add a new product to expand the SEVOLF Studio catalogue."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5 w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredProducts.length > 0 &&
                        selectedIds.length === filteredProducts.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-[#DCD9D0] text-[#20211F] focus:ring-[#85866A]"
                    />
                  </th>
                  <th className="py-3 px-5">Product Name</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Format</th>
                  <th className="py-3 px-5">Price</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => handleSelectRow(p.id)}
                        className="rounded border-[#DCD9D0] text-[#20211F] focus:ring-[#85866A]"
                      />
                    </td>
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded bg-[#F7F5F0] border border-[#E8E5DD] flex items-center justify-center shrink-0 text-[#85866A]">
                          <Package className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/admin/products/${p.slug}`}
                            className="font-medium text-[#22231F] hover:text-[#85866A] transition-colors truncate block"
                          >
                            {p.name}
                          </Link>
                          <span className="text-[11px] font-mono text-[#85847D]">
                            /products/{p.slug}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <AdminStatusBadge
                        variant={
                          p.status === "published"
                            ? "success"
                            : p.status === "draft"
                            ? "warning"
                            : "neutral"
                        }
                      >
                        {p.status}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#85847D]">
                      {p.formatLabel || "PDF Document"}
                    </td>
                    <td className="py-3.5 px-5 font-serif font-medium text-sm text-[#22231F]">
                      ₹{p.price}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/admin/products/${p.slug}`}
                          className="p-1.5 rounded hover:bg-[#F7F5F0] text-[#85847D] hover:text-[#22231F] transition-colors"
                          title="Edit Product"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Link>
                        <Link
                          href={`/products/${p.slug}?preview=1`}
                          target="_blank"
                          className="p-1.5 rounded hover:bg-[#F7F5F0] text-[#85847D] hover:text-[#22231F] transition-colors"
                          title="Preview on Storefront"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#161715]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E5DD] rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA] shrink-0">
              <h2 className="text-base font-serif font-normal text-[#22231F]">
                Create Studio Product
              </h2>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-md text-[#85847D] hover:text-[#22231F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-6 space-y-5 text-xs font-sans overflow-y-auto">
              {/* A. Basic Information */}
              <div className="space-y-3">
                <h3 className="font-mono uppercase text-[10px] tracking-wider text-[#85847D] border-b border-[#E8E5DD] pb-1">
                  A. Basic Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Product Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Toddler Routine Cards"
                      value={newProduct.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "");
                        setNewProduct({ ...newProduct, name, slug });
                      }}
                      className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">URL Slug *</label>
                    <input
                      type="text"
                      required
                      value={newProduct.slug}
                      onChange={(e) => setNewProduct({ ...newProduct, slug: e.target.value })}
                      className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[#22231F] font-medium mb-1">Tagline</label>
                  <input
                    type="text"
                    value={newProduct.tagline}
                    onChange={(e) => setNewProduct({ ...newProduct, tagline: e.target.value })}
                    className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                  />
                </div>
                <div>
                  <label className="block text-[#22231F] font-medium mb-1">Short Description</label>
                  <textarea
                    rows={2}
                    value={newProduct.short_description}
                    onChange={(e) => setNewProduct({ ...newProduct, short_description: e.target.value })}
                    className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Product Type</label>
                    <input
                      type="text"
                      value={newProduct.product_type}
                      onChange={(e) => setNewProduct({ ...newProduct, product_type: e.target.value })}
                      className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Format Label</label>
                    <input
                      type="text"
                      value={newProduct.format_label}
                      onChange={(e) => setNewProduct({ ...newProduct, format_label: e.target.value })}
                      className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                    />
                  </div>
                </div>
              </div>

              {/* B. Classification & F. SEO */}
              <div className="space-y-3">
                <h3 className="font-mono uppercase text-[10px] tracking-wider text-[#85847D] border-b border-[#E8E5DD] pb-1">
                  B. Classification & F. SEO
                </h3>
                <div>
                  <label className="block text-[#22231F] font-medium mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={newProduct.tags}
                    onChange={(e) => setNewProduct({ ...newProduct, tags: e.target.value })}
                    className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">SEO Page Title</label>
                    <input
                      type="text"
                      value={newProduct.seo_title}
                      onChange={(e) => setNewProduct({ ...newProduct, seo_title: e.target.value })}
                      className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                    />
                  </div>
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">SEO Meta Description</label>
                    <input
                      type="text"
                      value={newProduct.seo_description}
                      onChange={(e) => setNewProduct({ ...newProduct, seo_description: e.target.value })}
                      className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F]"
                    />
                  </div>
                </div>
              </div>

              {/* C. Product Media & D. Digital Assets */}
              <div className="space-y-3">
                <h3 className="font-mono uppercase text-[10px] tracking-wider text-[#85847D] border-b border-[#E8E5DD] pb-1">
                  C. Cover Media & D. Digital Assets
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Cover Image</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isUploadingMedia}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingMedia(true);
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("purpose", "cover");
                        fd.append("product_slug", newProduct.slug || "new-product");
                        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                        const d = await res.json();
                        if (res.ok && d.public_url) {
                          setNewProduct((prev) => ({ ...prev, cover_image_url: d.public_url }));
                        }
                        setIsUploadingMedia(false);
                      }}
                      className="w-full text-[11px] border border-[#E8E5DD] rounded-md p-1.5"
                    />
                  </div>
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Digital Asset (PDF/ZIP)</label>
                    <input
                      type="file"
                      accept=".pdf,.zip,.epub"
                      disabled={isUploadingFile}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingFile(true);
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("purpose", "digital_asset");
                        fd.append("product_slug", newProduct.slug || "new-product");
                        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                        const d = await res.json();
                        if (res.ok) {
                          setUploadedAssets((prev) => [
                            ...prev,
                            {
                              file_name: d.file_name,
                              storage_path: d.storage_path,
                              file_size_bytes: d.file_size_bytes,
                              mime_type: d.mime_type,
                              file_version: "v1.0.0",
                            },
                          ]);
                        }
                        setIsUploadingFile(false);
                      }}
                      className="w-full text-[11px] border border-[#E8E5DD] rounded-md p-1.5"
                    />
                    {uploadedAssets.length > 0 && (
                      <p className="text-[11px] text-emerald-700 mt-1">
                        {uploadedAssets.length} file(s) staged for attachment.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* E. Pricing & G. Publishing */}
              <div className="space-y-3">
                <h3 className="font-mono uppercase text-[10px] tracking-wider text-[#85847D] border-b border-[#E8E5DD] pb-1">
                  E. Pricing & G. Publishing
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Currency</label>
                    <select
                      value={newProduct.currency}
                      onChange={(e) => setNewProduct({ ...newProduct, currency: e.target.value as any })}
                      className="w-full border border-[#E8E5DD] rounded-md px-2.5 py-2"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                      <option value="GBP">GBP</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Base Price</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={newProduct.price}
                      onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })}
                      className="w-full border border-[#E8E5DD] rounded-md px-2.5 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Compare-at</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={newProduct.compare_at_amount}
                      onChange={(e) => setNewProduct({ ...newProduct, compare_at_amount: e.target.value })}
                      className="w-full border border-[#E8E5DD] rounded-md px-2.5 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-[#22231F] font-medium mb-1">Initial Status</label>
                    <select
                      value={newProduct.status}
                      onChange={(e) => setNewProduct({ ...newProduct, status: e.target.value as any })}
                      className="w-full border border-[#E8E5DD] rounded-md px-2.5 py-2"
                    >
                      <option value="draft">Save as Draft</option>
                      <option value="published">Publish Immediately</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[#E8E5DD]">
                <AdminButton
                  type="button"
                  variant="secondary"
                  onClick={() => setIsAddModalOpen(false)}
                >
                  Cancel
                </AdminButton>
                <AdminButton type="submit" variant="primary" disabled={isSubmitting || isUploadingMedia || isUploadingFile}>
                  {isSubmitting ? "Saving..." : newProduct.status === "published" ? "Create & Publish" : "Save as Draft"}
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
