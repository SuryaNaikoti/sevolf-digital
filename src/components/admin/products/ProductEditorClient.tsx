"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types/commerce";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Plus,
  Archive,
  Globe,
  EyeOff,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProductEditorClientProps {
  product: Product;
}

interface PriceRow {
  id: string;
  currency: "INR" | "USD" | "GBP" | "EUR";
  amount: number;
  compare_at_amount: number | null;
  is_default: boolean;
}

interface AssetRow {
  id: string;
  file_name: string;
  file_version: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  is_active: boolean;
}

export default function ProductEditorClient({ product }: ProductEditorClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<"draft" | "published" | "archived">(product.status);
  const [formData, setFormData] = useState({
    name: product.name,
    slug: product.slug,
    tagline: product.tagline,
    short_description: product.shortDescription,
    full_description: product.fullDescription,
    product_type: product.productType,
    format: product.format,
    format_label: product.formatLabel,
    cover_image_url: product.coverImage,
    seo_title: product.seoTitle || product.name,
    seo_description: product.seoDescription || product.shortDescription,
    tags: product.tags.join(", "),
  });

  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [newPrice, setNewPrice] = useState({
    currency: "INR" as "INR" | "USD" | "GBP" | "EUR",
    amount: String(product.price || 499),
    compare_at_amount: product.compareAtPrice ? String(product.compareAtPrice) : "",
    is_active: true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [assetEdition, setAssetEdition] = useState("v1.0.0");
  const [confirmAction, setConfirmAction] = useState<"published" | "draft" | "archived" | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  useEffect(() => {
    fetch(`/api/admin/products/${product.slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.product) {
          setPrices(data.product.product_prices || []);
          setAssets(data.product.digital_assets || []);
          setStatus(data.product.status);
        }
      })
      .catch(() => {});
  }, [product.slug]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/products/${product.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          tagline: formData.tagline,
          short_description: formData.short_description,
          full_description: formData.full_description,
          product_type: formData.product_type,
          format: formData.format,
          format_label: formData.format_label,
          cover_image_url: formData.cover_image_url,
          seo_title: formData.seo_title,
          seo_description: formData.seo_description,
          tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update product");

      setFeedback({ type: "success", message: "Product changes saved to database." });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (targetStatus: "published" | "draft" | "archived") => {
    setConfirmAction(null);
    setIsSaving(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/admin/products/${product.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to change status to ${targetStatus}`);

      setStatus(targetStatus);
      setFeedback({
        type: "success",
        message:
          targetStatus === "published"
            ? "Product is now Published and live on the storefront."
            : targetStatus === "draft"
            ? "Product unpublished and moved to Draft."
            : "Product retired (Archived). Historical orders and entitlements remain intact.",
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePrice = async () => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/products/${product.slug}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: newPrice.currency,
          amount: Number(newPrice.amount),
          compare_at_amount: newPrice.compare_at_amount ? Number(newPrice.compare_at_amount) : null,
          is_active: newPrice.is_active,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save price");

      const refreshed = await fetch(`/api/admin/products/${product.slug}`).then((r) => r.json());
      if (refreshed.product) setPrices(refreshed.product.product_prices || []);
      setFeedback({ type: "success", message: `Saved ${newPrice.currency} ${newPrice.amount} pricing.` });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePriceActive = async (row: PriceRow) => {
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/admin/products/${product.slug}/prices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          price_id: row.id,
          currency: row.currency,
          amount: Number(row.amount),
          compare_at_amount: row.compare_at_amount,
          is_active: !row.is_default,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update price status");

      const refreshed = await fetch(`/api/admin/products/${product.slug}`).then((r) => r.json());
      if (refreshed.product) setPrices(refreshed.product.product_prices || []);
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoverUpload = async (file: File) => {
    setIsUploadingCover(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "cover");
      fd.append("product_slug", product.slug);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Cover upload failed");
      setFormData((prev) => ({ ...prev, cover_image_url: data.public_url }));
      setFeedback({ type: "success", message: "Cover image uploaded. Click Save Changes to persist." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsUploadingCover(false);
    }
  };

  const handleAssetUpload = async (file: File) => {
    setIsUploadingAsset(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "digital_asset");
      fd.append("product_slug", product.slug);
      const upRes = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error || "Asset upload failed");

      const regRes = await fetch("/api/admin/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: upData.file_name,
          storage_path: upData.storage_path,
          product_id: product.id,
          file_size_bytes: upData.file_size_bytes,
          mime_type: upData.mime_type,
          file_version: assetEdition || "v1.0.0",
        }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) throw new Error(regData.error || "Asset registration failed");

      setAssets((prev) => [regData.asset, ...prev]);
      setFeedback({ type: "success", message: `Digital asset "${upData.file_name}" uploaded and attached.` });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsUploadingAsset(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-sm border text-xs flex items-center space-x-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : feedback.type === "error"
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DDD8CD] pb-5">
        <div className="flex items-center space-x-3">
          <Link
            href="/admin/products"
            className="p-2 bg-white border border-[#DDD8CD] rounded-xs text-[#292B27] hover:bg-[#F5F2EB] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-serif text-2xl font-normal text-[#292B27]">{formData.name}</h1>
              <span
                className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                  status === "published"
                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                    : status === "archived"
                    ? "bg-[#F7F5F0] text-[#77766E] border-[#DDD8CD]"
                    : "bg-amber-50 text-amber-800 border-amber-200"
                }`}
              >
                {status === "published" ? "Published" : status === "archived" ? "Retired" : "Draft"}
              </span>
            </div>
            <p className="text-xs text-[#77766E] mt-0.5 font-mono">/{product.slug}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/products/${product.slug}`}
            target="_blank"
            className="px-3.5 py-2 bg-white border border-[#DDD8CD] text-[#292B27] text-xs font-medium rounded-xs hover:bg-[#F5F2EB] flex items-center space-x-1.5"
          >
            <span>Preview</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-2 bg-[#292B27] hover:bg-[#657052] disabled:opacity-50 text-white text-xs font-semibold rounded-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white border border-[#DDD8CD] rounded-sm p-6 space-y-4 shadow-2xs">
            <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
              Basic Information
            </h2>
            <div>
              <label className="block text-xs font-semibold text-[#292B27] mb-1">Product Title</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292B27] mb-1">Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292B27] mb-1">Short Description</label>
              <textarea
                rows={2}
                value={formData.short_description}
                onChange={(e) => setFormData({ ...formData, short_description: e.target.value })}
                className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292B27] mb-1">Full Description</label>
              <textarea
                rows={5}
                value={formData.full_description}
                onChange={(e) => setFormData({ ...formData, full_description: e.target.value })}
                className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#292B27] mb-1">Product Type</label>
                <input
                  type="text"
                  value={formData.product_type}
                  onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                  className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#292B27] mb-1">Format Label</label>
                <input
                  type="text"
                  value={formData.format_label}
                  onChange={(e) => setFormData({ ...formData, format_label: e.target.value })}
                  className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
                />
              </div>
            </div>
          </div>

          {/* Pricing Management */}
          <div className="bg-white border border-[#DDD8CD] rounded-sm p-6 space-y-4 shadow-2xs">
            <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
              Production Pricing Management
            </h2>

            {prices.length > 0 && (
              <div className="divide-y divide-[#E8E5DD] border border-[#E8E5DD] rounded-xs text-xs">
                {prices.map((pr) => (
                  <div key={pr.id} className="p-3 flex items-center justify-between">
                    <div>
                      <span className="font-mono font-semibold text-[#292B27]">
                        {pr.currency} {pr.amount}
                      </span>
                      {pr.compare_at_amount && (
                        <span className="ml-2 line-through text-[#85847D] font-mono">
                          {pr.currency} {pr.compare_at_amount}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePriceActive(pr)}
                      className={`px-2.5 py-1 rounded text-[11px] font-mono border cursor-pointer ${
                        pr.is_default
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-[#F7F5F0] text-[#85847D] border-[#E8E5DD]"
                      }`}
                    >
                      {pr.is_default ? "Default" : "Secondary"}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#292B27] mb-1">Currency</label>
                <select
                  value={newPrice.currency}
                  onChange={(e) => setNewPrice({ ...newPrice, currency: e.target.value as any })}
                  className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-2.5 py-2"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#292B27] mb-1">Base Price</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={newPrice.amount}
                  onChange={(e) => setNewPrice({ ...newPrice, amount: e.target.value })}
                  className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#292B27] mb-1">Compare-at (Opt.)</label>
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={newPrice.compare_at_amount}
                  onChange={(e) => setNewPrice({ ...newPrice, compare_at_amount: e.target.value })}
                  className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-2.5 py-2"
                />
              </div>
              <button
                type="button"
                onClick={handleSavePrice}
                disabled={isSaving}
                className="px-3 py-2 bg-[#292B27] hover:bg-[#657052] text-white text-xs font-semibold rounded-xs flex items-center justify-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Set Price</span>
              </button>
            </div>
          </div>

          {/* Digital Assets */}
          <div className="bg-white border border-[#DDD8CD] rounded-sm p-6 space-y-4 shadow-2xs">
            <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
              Digital Assets (Private Storage)
            </h2>
            {assets.length > 0 ? (
              <div className="divide-y divide-[#E8E5DD] border border-[#E8E5DD] rounded-xs text-xs">
                {assets.map((a) => (
                  <div key={a.id} className="p-3 flex items-center justify-between">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#657052] shrink-0" />
                      <div className="truncate">
                        <p className="font-medium text-[#292B27] truncate">{a.file_name}</p>
                        <p className="text-[11px] text-[#77766E] font-mono">
                          {a.file_version} • {a.storage_path}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono border shrink-0 ${
                        a.is_active
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-[#F7F5F0] text-[#85847D] border-[#E8E5DD]"
                      }`}
                    >
                      {a.is_active ? "Active" : "Retired"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#77766E]">No digital assets attached yet.</p>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 pt-2">
              <div>
                <label className="block text-[11px] font-semibold text-[#292B27] mb-1">Edition / Version</label>
                <input
                  type="text"
                  value={assetEdition}
                  onChange={(e) => setAssetEdition(e.target.value)}
                  className="text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-2.5 py-2 w-32"
                />
              </div>
              <label className="px-4 py-2 bg-[#F5F2EB] hover:bg-[#EAE5DA] border border-[#DDD8CD] text-[#292B27] text-xs font-medium rounded-xs cursor-pointer flex items-center space-x-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>{isUploadingAsset ? "Uploading..." : "Upload PDF / Digital File"}</span>
                <input
                  type="file"
                  accept=".pdf,.zip,.epub"
                  className="hidden"
                  disabled={isUploadingAsset}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleAssetUpload(f);
                  }}
                />
              </label>
            </div>
          </div>

          {/* SEO */}
          <div className="bg-white border border-[#DDD8CD] rounded-sm p-6 space-y-4 shadow-2xs">
            <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
              SEO & Metadata
            </h2>
            <div>
              <label className="block text-xs font-semibold text-[#292B27] mb-1">SEO Title</label>
              <input
                type="text"
                value={formData.seo_title}
                onChange={(e) => setFormData({ ...formData, seo_title: e.target.value })}
                className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292B27] mb-1">Meta Description</label>
              <textarea
                rows={2}
                value={formData.seo_description}
                onChange={(e) => setFormData({ ...formData, seo_description: e.target.value })}
                className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#292B27] mb-1">Tags (Comma-separated)</label>
              <input
                type="text"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3 py-2 text-[#292B27]"
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <div className="bg-white border border-[#DDD8CD] rounded-sm p-6 space-y-4 shadow-2xs">
            <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
              Product Lifecycle
            </h2>
            <div className="text-xs flex justify-between items-center py-1">
              <span className="text-[#77766E]">Authoritative Status</span>
              <span className="font-mono font-semibold text-[#292B27] uppercase">{status}</span>
            </div>

            <div className="space-y-2 pt-2">
              {status !== "published" && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("published")}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Publish Product</span>
                </button>
              )}

              {status === "published" && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("draft")}
                  disabled={isSaving}
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>Unpublish to Draft</span>
                </button>
              )}

              {status !== "archived" && (
                <button
                  type="button"
                  onClick={() => setConfirmAction("archived")}
                  disabled={isSaving}
                  className="w-full py-2 bg-white hover:bg-[#F5F2EB] border border-[#DDD8CD] text-[#77766E] text-xs font-medium rounded-xs flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Retire Product</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-[#DDD8CD] rounded-sm p-6 space-y-4 shadow-2xs">
            <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
              Cover Image
            </h2>
            <div className="aspect-[3/4] bg-[#F5F2EB] rounded border border-[#DDD8CD] overflow-hidden">
              <img
                src={formData.cover_image_url}
                alt={formData.name}
                className="w-full h-full object-cover"
              />
            </div>
            <label className="w-full py-2 bg-[#F5F2EB] hover:bg-[#EAE5DA] border border-[#DDD8CD] text-[#292B27] text-xs font-medium rounded-xs cursor-pointer flex items-center justify-center space-x-1.5">
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploadingCover ? "Uploading..." : "Upload New Cover"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={isUploadingCover}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCoverUpload(f);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 bg-[#161715]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#DDD8CD] rounded-md max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="font-serif text-lg text-[#292B27]">
              {confirmAction === "published"
                ? "Confirm Product Publication"
                : confirmAction === "draft"
                ? "Confirm Unpublish to Draft"
                : "Confirm Product Retirement"}
            </h3>
            <p className="text-xs text-[#77766E] leading-relaxed">
              {confirmAction === "published"
                ? "This will make the product live on the public storefront. It requires an active price and at least one active digital asset."
                : confirmAction === "draft"
                ? "This will hide the product from the public storefront and move it back to Draft. Existing customer orders and entitlements are preserved."
                : "This will retire the product from active sales. Historical orders, payments, and customer download entitlements will never be deleted."}
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 text-xs border border-[#DDD8CD] rounded-xs text-[#292B27] hover:bg-[#F5F2EB] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange(confirmAction)}
                className="px-4 py-2 text-xs bg-[#292B27] text-white rounded-xs hover:bg-[#657052] cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
