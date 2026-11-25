"use client";

import { useState } from "react";
import { FolderKanban, Plus, ExternalLink, Edit, CheckCircle2, AlertCircle, X, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";

interface CollectionItem {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  image_url: string | null;
  is_featured: boolean;
  display_order: number;
}

interface AdminCollectionsClientProps {
  initialCollections: CollectionItem[];
}

export default function AdminCollectionsClient({ initialCollections }: AdminCollectionsClientProps) {
  const router = useRouter();
  const [collections, setCollections] = useState<CollectionItem[]>(initialCollections);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<CollectionItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    tagline: "",
    description: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const openCreateModal = () => {
    setEditingCollection(null);
    setFormData({ name: "", slug: "", tagline: "", description: "" });
    setIsModalOpen(true);
  };

  const openEditModal = (col: CollectionItem) => {
    setEditingCollection(col);
    setFormData({
      name: col.name,
      slug: col.slug,
      tagline: col.tagline || "",
      description: col.description || "",
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      if (editingCollection) {
        const res = await fetch("/api/admin/collections", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCollection.id,
            name: formData.name,
            tagline: formData.tagline,
            description: formData.description,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update collection");

        setFeedback({ type: "success", message: `Collection "${formData.name}" updated successfully!` });
        setCollections((prev) =>
          prev.map((c) => (c.id === editingCollection.id ? { ...c, ...formData } : c))
        );
      } else {
        const res = await fetch("/api/admin/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create collection");

        setFeedback({ type: "success", message: `Collection "${data.collection.name}" created successfully!` });
        setCollections((prev) => [data.collection, ...prev]);
      }
      setIsModalOpen(false);
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
        title="Collections & Categories"
        subtitle="Curate themed product groupings and educational categories for SEVOLF storefront."
        badge={{ text: `${collections.length} Collections`, variant: "neutral" }}
        actions={
          <AdminButton variant="primary" icon={Plus} onClick={openCreateModal}>
            Add Collection
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

      {/* Collections Card */}
      <AdminCard padding={false}>
        {collections.length === 0 ? (
          <AdminEmptyState
            icon={Layers}
            title="No Collections Created"
            description="Organize your digital products into thematic collections to display on the storefront."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Collection Name</th>
                  <th className="py-3 px-5">Slug</th>
                  <th className="py-3 px-5">Tagline</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {collections.map((col) => (
                  <tr key={col.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded bg-[#F7F5F0] border border-[#E8E5DD] flex items-center justify-center shrink-0 text-[#85866A]">
                          <Layers className="w-4 h-4" />
                        </div>
                        <span className="font-medium text-[#22231F]">{col.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#85847D]">
                      /collections/{col.slug}
                    </td>
                    <td className="py-3.5 px-5 text-[#85847D] max-w-xs truncate">
                      {col.tagline || "—"}
                    </td>
                    <td className="py-3.5 px-5">
                      <AdminStatusBadge variant="success">Active</AdminStatusBadge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEditModal(col)}
                          className="p-1.5 rounded hover:bg-[#F7F5F0] text-[#85847D] hover:text-[#22231F] transition-colors"
                          title="Edit Collection"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <Link
                          href={`/collections/${col.slug}`}
                          target="_blank"
                          className="p-1.5 rounded hover:bg-[#F7F5F0] text-[#85847D] hover:text-[#22231F] transition-colors"
                          title="Preview Collection"
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#161715]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E5DD] rounded-xl max-w-md w-full overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
              <h2 className="text-base font-serif font-normal text-[#22231F]">
                {editingCollection ? "Edit Collection" : "Add Studio Collection"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-md text-[#85847D] hover:text-[#22231F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#22231F] font-medium mb-1">Collection Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Early Childhood Mastery"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = editingCollection
                      ? formData.slug
                      : name
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "-")
                          .replace(/(^-|-$)+/g, "");
                    setFormData({ ...formData, name, slug });
                  }}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
                />
              </div>

              <div>
                <label className="block text-[#22231F] font-medium mb-1">Slug</label>
                <input
                  type="text"
                  required
                  disabled={!!editingCollection}
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] font-mono focus:outline-hidden focus:border-[#85866A] disabled:bg-[#F7F5F0]"
                />
              </div>

              <div>
                <label className="block text-[#22231F] font-medium mb-1">Tagline</label>
                <input
                  type="text"
                  placeholder="e.g. Montessori-aligned foundational learning kits"
                  value={formData.tagline}
                  onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
                />
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
                  {isSubmitting ? "Saving..." : "Save Collection"}
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
