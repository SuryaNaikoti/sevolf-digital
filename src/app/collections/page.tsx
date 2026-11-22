import React from "react";
import { getCollections } from "@/services/products";
import { CollectionCard } from "@/components/collections/CollectionCard";

export const metadata = {
  title: "Curated Collections",
  description: "Explore SEVOLF digital product collections across Home & Living, SEVOLF Little, Productivity & Planning, and Business.",
};

export default async function CollectionsPage() {
  const collections = await getCollections();

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-16">
      <div className="max-w-2xl mb-12">
        <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
          THE DISCIPLINES
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
          Curated Collections
        </h1>
        <p className="text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
          Our digital catalogue is organised around distinct pillars of daily life. Explore resources engineered to bring measured calm, clarity, and competence to each discipline.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {collections.map((collection) => (
          <CollectionCard key={collection.id} collection={collection} />
        ))}
      </div>
    </div>
  );
}
