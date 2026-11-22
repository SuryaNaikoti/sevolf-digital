"use client";

import { useState } from "react";
import { Product } from "@/types/commerce";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Lock,
  Eye,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProductEditorClientProps {
  product: Product;
}

export default function ProductEditorClient({ product }: ProductEditorClientProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: product.name,
    tagline: product.tagline,
    short_description: product.shortDescription,
    full_description: product.fullDescription,
    product_type: product.productType,
    format: product.format,
    format_label: product.formatLabel,
    seo_title: product.seoTitle || product.name,
    seo_description: product.seoDescription || product.shortDescription,
    tags: product.tags.join(", "),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
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
          seo_title: formData.seo_title,
          seo_description: formData.seo_description,
          tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update product");
      }

      setFeedback({ type: "success", message: "Draft product changes saved successfully to database!" });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishAttempt = () => {
    setFeedback({
      type: "info",
      message:
        "RESTRICTED POLICY: Direct product publication is locked in pre-launch staging. Flagship products remain safely in 'draft' mode pending Phase 2 commercial authorization and production gateway sign-off.",
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#E3F1DF] border-[#C3E6BD] text-[#008060]"
              : feedback.type === "info"
              ? "bg-[#FDF8E2] border-[#FBEB9F] text-[#8C6B00]"
              : "bg-[#FFF4F4] border-[#FED2D2] text-[#D72C0D]"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : feedback.type === "info" ? (
              <Lock className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-current opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <Link
            href="/admin/products"
            className="p-1 hover:bg-[#E1E3E5] rounded text-[#6D7175] hover:text-[#202223] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold text-[#202223] tracking-tight">{product.name}</h1>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-[#FDF8E2] text-[#B98900] border border-[#FBEB9F]">
                {product.status}
              </span>
            </div>
            <p className="text-xs text-[#6D7175]">/{product.slug}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handlePublishAttempt}
            className="px-3 py-1.5 border border-[#BABFC3] bg-white text-[#202223] text-xs font-semibold rounded-md shadow-2xs hover:bg-[#F6F6F7] transition-colors flex items-center space-x-1"
            title="Publishing is guarded in staging review"
          >
            <Lock className="w-3.5 h-3.5 text-[#B98900]" />
            <span>Publish Product</span>
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-3.5 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors flex items-center space-x-1.5 disabled:opacity-70"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? "Saving..." : "Save Changes"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2 Columns: Core Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title & Description Card */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 shadow-2xs space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1">Title</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full text-xs bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] focus:outline-hidden focus:border-[#202223]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1">Tagline</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
                className="w-full text-xs bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] focus:outline-hidden focus:border-[#202223]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1">Short Description</label>
              <textarea
                rows={2}
                value={formData.short_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, short_description: e.target.value }))}
                className="w-full text-xs bg-white border border-[#BABFC3] rounded p-2.5 text-[#202223] focus:outline-hidden focus:border-[#202223]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1">Full Description</label>
              <textarea
                rows={5}
                value={formData.full_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, full_description: e.target.value }))}
                className="w-full text-xs bg-white border border-[#BABFC3] rounded p-2.5 text-[#202223] focus:outline-hidden focus:border-[#202223]"
              />
            </div>
          </div>

          {/* Digital File Delivery Card */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-[#202223] uppercase tracking-wider">
              Secure Digital Payload Association
            </h2>
            <div className="p-3 bg-[#FAFBFB] border border-[#E1E3E5] rounded flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded bg-white border border-[#E1E3E5] flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#008060]" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#202223] font-mono">
                    products/{product.slug}/v1.2.3/payload.pdf
                  </p>
                  <p className="text-[11px] text-[#6D7175]">Storage: Private Bucket (60s signed access token)</p>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#008060] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Bound
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Specifications & Staging Pricing */}
        <div className="space-y-4">
          {/* Status & Organization */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-[#202223] uppercase tracking-wider">Product Status</h2>
            <div className="p-2.5 bg-[#FAFBFB] rounded border border-[#E1E3E5] space-y-1">
              <span className="text-xs font-semibold text-[#202223] block">Lifecycle: Staging Draft</span>
              <p className="text-[11px] text-[#6D7175]">
                In accordance with Phase 1C invariants, products are saved directly as drafts. Zero products are published to the public storefront until formal sign-off.
              </p>
            </div>
          </div>

          {/* Pricing Policy Card */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-[#202223] uppercase tracking-wider">Pricing Specification</h2>
            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1">Staging Reference Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[#6D7175]">₹</span>
                <input
                  type="number"
                  disabled
                  value={product.price}
                  className="w-full text-xs bg-[#FAF8F5] border border-[#BABFC3] rounded pl-7 pr-3 py-1.5 text-[#202223] font-mono font-medium cursor-not-allowed"
                />
              </div>
              <p className="text-[11px] text-[#6D7175] mt-1.5">
                🔒 Production prices remain unactivated (0 rows in public.product_prices). Price changes require authorized database migrations.
              </p>
            </div>
          </div>

          {/* SEO & Search Engine Listing Preview */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 shadow-2xs space-y-3">
            <h2 className="text-xs font-bold text-[#202223] uppercase tracking-wider">Search Engine Listing</h2>
            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1">Page Title</label>
              <input
                type="text"
                value={formData.seo_title}
                onChange={(e) => setFormData((prev) => ({ ...prev, seo_title: e.target.value }))}
                className="w-full text-xs bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#202223] mb-1">Meta Description</label>
              <textarea
                rows={2}
                value={formData.seo_description}
                onChange={(e) => setFormData((prev) => ({ ...prev, seo_description: e.target.value }))}
                className="w-full text-xs bg-white border border-[#BABFC3] rounded p-2 text-[#202223]"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
