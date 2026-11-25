"use client";

import { useState } from "react";
import {
  FileArchive,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Download,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";

interface DigitalAssetItem {
  id: string;
  product_id: string | null;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string;
  file_version: string;
  checksum: string | null;
  is_active?: boolean;
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
          file_size_bytes: Number(newAsset.file_size_bytes),
          file_version: newAsset.file_version,
          checksum: newAsset.checksum || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register digital asset");

      setFeedback({ type: "success", message: `Asset "${data.asset.file_name}" registered in storage vault!` });
      setAssets((prev) => [data.asset, ...prev]);
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

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Digital Asset Vault"
        subtitle="Secure downloadable PDF files, print-ready workbooks, and encrypted storage entitlements."
        badge={{ text: `${assets.length} Vault Assets`, variant: "neutral" }}
        actions={
          <AdminButton variant="primary" icon={Upload} onClick={() => setIsModalOpen(true)}>
            Register Asset
          </AdminButton>
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

      {/* Assets Table Card */}
      <AdminCard padding={false}>
        <div className="p-4 sm:p-5 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#85847D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search assets by file name, path, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-sans bg-white border border-[#E8E5DD] rounded-md pl-8 pr-3 py-1.5 text-[#22231F] placeholder-[#85847D] focus:outline-hidden focus:border-[#85866A]"
            />
          </div>
          <span className="text-[11px] font-mono text-[#85847D] uppercase tracking-wider hidden sm:inline">
            Encrypted Supabase Storage
          </span>
        </div>

        {filteredAssets.length === 0 ? (
          <AdminEmptyState
            icon={FileArchive}
            title="No Digital Assets Found"
            description="Register PDF workbooks and digital assets into Supabase storage to attach them to sellable products."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">File Name</th>
                  <th className="py-3 px-5">Attached Product</th>
                  <th className="py-3 px-5">Version</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Size</th>
                  <th className="py-3 px-5 text-right">Storage Path</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {filteredAssets.map((a) => (
                  <tr key={a.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded bg-[#F7F5F0] border border-[#E8E5DD] flex items-center justify-center shrink-0 text-[#85866A]">
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-[#22231F]">{a.file_name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-[#85847D]">
                      {a.products?.name || "Unassigned"}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#22231F]">
                      {a.file_version}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono border ${
                          a.is_active !== false
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-[#F7F5F0] text-[#85847D] border-[#E8E5DD]"
                        }`}
                      >
                        {a.is_active !== false ? "Active" : "Retired"}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#85847D]">
                      {formatFileSize(a.file_size_bytes)}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-[11px] text-[#85847D] truncate max-w-xs">
                      {a.storage_path}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#161715]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E5DD] rounded-xl max-w-md w-full overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
              <h2 className="text-base font-serif font-normal text-[#22231F]">
                Register Digital Asset
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-md text-[#85847D] hover:text-[#22231F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterAsset} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#22231F] font-medium mb-1">File Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. toddler-routine-cards-v1.pdf"
                  value={newAsset.file_name}
                  onChange={(e) => setNewAsset({ ...newAsset, file_name: e.target.value })}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
                />
              </div>

              <div>
                <label className="block text-[#22231F] font-medium mb-1">Storage Path</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. digital-products/toddler-routine-cards-v1.pdf"
                  value={newAsset.storage_path}
                  onChange={(e) => setNewAsset({ ...newAsset, storage_path: e.target.value })}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] font-mono focus:outline-hidden focus:border-[#85866A]"
                />
              </div>

              <div>
                <label className="block text-[#22231F] font-medium mb-1">Attach to Product</label>
                <select
                  value={newAsset.product_id}
                  onChange={(e) => setNewAsset({ ...newAsset, product_id: e.target.value })}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
                >
                  <option value="">Leave Unassigned</option>
                  {availableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[#E8E5DD]">
                <AdminButton
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </AdminButton>
                <AdminButton type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Registering..." : "Register Asset"}
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
