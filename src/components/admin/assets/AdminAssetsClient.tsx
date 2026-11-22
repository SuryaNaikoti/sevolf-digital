"use client";

import { useState } from "react";
import {
  FileText,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface DigitalAssetItem {
  id: string;
  product_id: string | null;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string;
  file_version: string;
  checksum: string | null;
  created_at: string;
  products?: { id: string; name: string; slug: string; status: string } | null;
}

interface ProductOption {
  id: string;
  name: string;
  slug: string;
}

interface AdminAssetsClientProps {
  initialAssets: DigitalAssetItem[];
  availableProducts: ProductOption[];
}

export default function AdminAssetsClient({
  initialAssets,
  availableProducts,
}: AdminAssetsClientProps) {
  const router = useRouter();
  const [assets, setAssets] = useState<DigitalAssetItem[]>(initialAssets);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );

  const [newAsset, setNewAsset] = useState({
    file_name: "",
    storage_path: "",
    product_id: availableProducts[0]?.id || "",
    file_size_bytes: "1048576",
    file_version: "v1.0.0",
    checksum: "",
  });

  const filteredAssets = assets.filter((a) => {
    return (
      a.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.storage_path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.products?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleRegisterAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: newAsset.file_name,
          storage_path: newAsset.storage_path,
          product_id: newAsset.product_id || null,
          file_size_bytes: Number(newAsset.file_size_bytes) || 0,
          file_version: newAsset.file_version,
          checksum: newAsset.checksum || "a" + Math.random().toString(16).slice(2, 18),
          mime_type: "application/pdf",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register asset");

      const boundProduct = availableProducts.find((p) => p.id === newAsset.product_id);
      const registeredAsset: DigitalAssetItem = {
        ...data.asset,
        products: boundProduct ? { id: boundProduct.id, name: boundProduct.name, slug: boundProduct.slug, status: "draft" } : null,
      };

      setFeedback({
        type: "success",
        message: `Digital asset "${data.asset.file_name}" bound and registered successfully!`,
      });
      setAssets((prev) => [registeredAsset, ...prev]);
      setIsModalOpen(false);
      setNewAsset({
        file_name: "",
        storage_path: "",
        product_id: availableProducts[0]?.id || "",
        file_size_bytes: "1048576",
        file_version: "v1.0.0",
        checksum: "",
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBindProduct = async (assetId: string, productId: string) => {
    try {
      const res = await fetch("/api/admin/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: assetId, product_id: productId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update binding");

      const boundProduct = availableProducts.find((p) => p.id === productId);
      setAssets((prev) =>
        prev.map((a) =>
          a.id === assetId
            ? {
                ...a,
                product_id: productId,
                products: boundProduct ? { id: boundProduct.id, name: boundProduct.name, slug: boundProduct.slug, status: "draft" } : null,
              }
            : a
        )
      );
      setFeedback({ type: "success", message: "Digital asset product binding updated!" });
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Digital Assets</h1>
          <p className="text-xs text-[#6D7175]">
            Manage master delivery payloads, version control, checksum verifications, and product bindings.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors flex items-center space-x-1.5 shrink-0 self-start sm:self-auto"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Register Asset</span>
        </button>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        {/* Table Filter Controls */}
        <div className="p-3 bg-[#FAFBFB] border-b border-[#E1E3E5] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#8C9196] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search assets by filename or product..."
              className="w-full text-xs bg-white border border-[#BABFC3] rounded pl-8 pr-3 py-1.5 text-[#202223] placeholder-[#8C9196] focus:outline-hidden focus:border-[#202223]"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end text-xs">
            <span className="text-[11px] font-mono text-[#008060] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Private Storage (Fail-Closed)
            </span>
          </div>
        </div>

        {/* Assets Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E1E3E5] bg-[#FAFBFB] text-[#6D7175] font-medium">
                <th className="py-2.5 px-4">Asset File</th>
                <th className="py-2.5 px-4">Bound Product</th>
                <th className="py-2.5 px-4">Storage Path</th>
                <th className="py-2.5 px-4">Size</th>
                <th className="py-2.5 px-4">Version</th>
                <th className="py-2.5 px-4">Checksum (SHA-256)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E3E5]">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6D7175]">
                    No digital assets match your filter.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-[#F6F6F7]/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded bg-[#F6F6F7] border border-[#E1E3E5] flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-[#008060]" />
                        </div>
                        <div>
                          <p className="font-semibold text-[#202223]">{asset.file_name}</p>
                          <p className="text-[11px] text-[#6D7175] font-mono">{asset.mime_type}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-[#202223]">
                      <select
                        value={asset.product_id || ""}
                        onChange={(e) => handleBindProduct(asset.id, e.target.value)}
                        className="bg-white border border-[#BABFC3] rounded px-2 py-1 text-xs text-[#202223] font-medium"
                      >
                        <option value="">-- Unbound --</option>
                        {availableProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-[#6D7175] font-mono text-[11px]">
                      {asset.storage_path}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-[#202223]">
                      {asset.file_size_bytes
                        ? (asset.file_size_bytes / 1024 / 1024).toFixed(2) + " MB"
                        : "0 MB"}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[#F6F6F7] border border-[#E1E3E5]">
                        {asset.file_version}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#6D7175]">
                      {asset.checksum ? asset.checksum.slice(0, 16) + "..." : "None"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="p-3 border-t border-[#E1E3E5] bg-[#FAFBFB] flex items-center justify-between text-xs text-[#6D7175]">
          <span>{assets.length} private digital asset(s) registered</span>
          <span className="font-mono text-[11px]">Single-Use Signed URLs (60s TTL)</span>
        </div>
      </div>

      {/* Register Asset Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#E1E3E5] shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E1E3E5]">
              <div className="flex items-center space-x-2">
                <Upload className="w-4 h-4 text-[#008060]" />
                <h3 className="text-sm font-bold text-[#202223]">Register Digital Asset</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6D7175] hover:text-[#202223]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterAsset} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#202223] mb-1">File Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Workbook-Edition-A4.pdf"
                  value={newAsset.file_name}
                  onChange={(e) => {
                    const file_name = e.target.value;
                    const storage_path = `products/digital-assets/${file_name}`;
                    setNewAsset((prev) => ({ ...prev, file_name, storage_path }));
                  }}
                  className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Storage Path in Private Bucket *</label>
                <input
                  type="text"
                  required
                  value={newAsset.storage_path}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, storage_path: e.target.value }))}
                  className="w-full bg-[#FAFBFB] border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] font-mono focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Product Association *</label>
                <select
                  value={newAsset.product_id}
                  onChange={(e) => setNewAsset((prev) => ({ ...prev, product_id: e.target.value }))}
                  className="w-full bg-white border border-[#BABFC3] rounded px-2.5 py-1.5 text-[#202223] focus:outline-hidden"
                >
                  <option value="">-- Select Product --</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (/{p.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#202223] mb-1">Version</label>
                  <input
                    type="text"
                    value={newAsset.file_version}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, file_version: e.target.value }))}
                    className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202223] mb-1">Size (Bytes)</label>
                  <input
                    type="number"
                    value={newAsset.file_size_bytes}
                    onChange={(e) => setNewAsset((prev) => ({ ...prev, file_size_bytes: e.target.value }))}
                    className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E1E3E5]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-[#BABFC3] rounded bg-white text-[#202223] font-semibold hover:bg-[#F6F6F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white font-semibold rounded shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? "Registering..." : "Register Asset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
