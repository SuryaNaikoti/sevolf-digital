import React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getCollectionBySlug, getProducts } from "@/services/products";
import { ProductCard } from "@/components/products/ProductCard";
import { ArrowLeft } from "lucide-react";

interface CollectionSlugPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: CollectionSlugPageProps) {
  const { slug } = await params;
  const col = await getCollectionBySlug(slug);
  if (!col) return { title: "Collection Not Found" };

  return {
    title: `${col.name} Collection`,
    description: col.description,
  };
}

export default async function IndividualCollectionPage({ params }: CollectionSlugPageProps) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  const products = await getProducts({ collectionSlug: slug });

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-16">
      <Link
        href="/collections"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#77766E] hover:text-[#292B27] mb-8 transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>All Collections</span>
      </Link>

      {/* Hero Banner for Collection */}
      <div className="bg-[#EAE5DA] border border-[#DDD8CD] rounded-sm p-8 md:p-12 mb-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        <div className="md:col-span-7 space-y-4">
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold">
            COLLECTION FOCUS
          </span>
          <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#292B27]">
            {collection.name}
          </h1>
          <p className="font-serif text-lg text-[#292B27]/80 italic">
            "{collection.tagline}"
          </p>
          <p className="text-sm md:text-base text-[#77766E] leading-relaxed max-w-xl font-sans">
            {collection.description}
          </p>
        </div>

        <div className="md:col-span-5 aspect-[16/10] bg-white rounded overflow-hidden border border-[#DDD8CD]">
          <img
            src={collection.image}
            alt={collection.name}
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Products within Collection */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif text-2xl font-medium text-[#292B27]">
          Included Editions ({products.length})
        </h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((prod) => (
          <ProductCard key={prod.id} product={prod} />
        ))}
      </div>
    </div>
  );
}
