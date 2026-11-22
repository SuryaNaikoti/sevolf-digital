"use client";

import { useState } from "react";
import { FolderKanban, Plus, ExternalLink, Edit, CheckCircle2, AlertCircle, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
        // Edit collection
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
        // Create collection
        const res = await fetch("/api/admin/collections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to create collection");

        setFeedback({ type: "success", message: `Collection "${formData.name}" created successfully!` });
        setCollections((prev) => [...prev, data.collection]);
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
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Collections</h1>
          <p className="text-xs text-[#6D7175]">
            Organize digital assets into curated thematic packages and storefront catalogs.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors flex items-center space-x-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create collection</span>
        </button>
      </div>

      {/* Collection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collections.map((col) => (
          <div
            key={col.id}
            className="bg-white border border-[#E1E3E5] rounded-lg p-5 shadow-2xs space-y-3 hover:border-[#BABFC3] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-mono font-semibold uppercase text-[#6D7175] tracking-wider">
                  COLLECTION #{col.display_order}
                </span>
                <h3 className="text-sm font-bold text-[#202223]">{col.name}</h3>
                <p className="text-xs font-mono text-[#008060]">/{col.slug}</p>
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => openEditModal(col)}
                  className="p-1 hover:bg-[#F6F6F7] rounded text-[#6D7175] hover:text-[#202223]"
                  title="Edit collection"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <Link
                  href={`/shop/collections/${col.slug}`}
                  target="_blank"
                  className="p-1 hover:bg-[#F6F6F7] rounded text-[#6D7175] hover:text-[#202223]"
                  title="Preview in Storefront"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            <p className="text-xs text-[#6D7175] line-clamp-2">
              {col.description || col.tagline || "No description provided."}
            </p>

            <div className="pt-2 border-t border-[#E1E3E5] flex items-center justify-between text-xs">
              <span className="text-[11px] text-[#6D7175]">Active & Visible in Catalog</span>
              <span className="text-[11px] font-semibold text-[#008060]">Ready</span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#E1E3E5] shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E1E3E5]">
              <div className="flex items-center space-x-2">
                <FolderKanban className="w-4 h-4 text-[#008060]" />
                <h3 className="text-sm font-bold text-[#202223]">
                  {editingCollection ? "Edit Collection" : "Create New Collection"}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6D7175] hover:text-[#202223]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#202223] mb-1">Collection Title *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = editingCollection
                      ? formData.slug
                      : name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    setFormData((prev) => ({ ...prev, name, slug }));
                  }}
                  className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  disabled={!!editingCollection}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  className="w-full bg-[#FAFBFB] border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] font-mono focus:outline-hidden disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Tagline</label>
                <input
                  type="text"
                  value={formData.tagline}
                  onChange={(e) => setFormData((prev) => ({ ...prev, tagline: e.target.value }))}
                  className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white border border-[#BABFC3] rounded p-2 text-[#202223] focus:border-[#008060] focus:outline-hidden"
                />
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
                  {isSubmitting ? "Saving..." : "Save Collection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
