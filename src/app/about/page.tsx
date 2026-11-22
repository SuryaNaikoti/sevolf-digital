import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "About SEVOLF Digital",
  description: "Learn about SEVOLF's philosophy, craft, and vision for quiet, intentional digital commerce.",
};

export default function AboutPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-12">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            OUR STORY
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal text-[#292B27] leading-tight mb-6">
            Make room for better things.
          </h1>
          <p className="font-serif text-xl text-[#292B27]/80 italic leading-relaxed">
            SEVOLF Digital was founded on a simple conviction: modern screens are full of clutter, yet digital mediums can be quiet, intentional, and deeply restorative.
          </p>
        </div>

        <div className="aspect-[16/9] bg-[#EAE5DA] rounded-sm overflow-hidden border border-[#DDD8CD]">
          <img
            src="https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1600&q=80"
            alt="Quiet workspace with daylight and journals"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="prose text-base md:text-lg text-[#77766E] leading-relaxed space-y-6 font-sans">
          <p>
            In an era of hyper-stimulating notification feeds and disposable software, we craft digital publications that stand apart. Whether it is an early phonetic workbook for a preschooler, a room-by-room home curation guide, or an unhurried 90-day focus planner, every piece is designed with editorial warmth and typographic restraint.
          </p>
          <p>
            All products are owned, designed, and published directly by SEVOLF. We do not aggregate generic marketplace uploads. When you acquire a SEVOLF edition, you receive a thoroughly tested, beautifully typeset work engineered for real use—whether printed on physical paper or held inside your digital tablet journal.
          </p>
        </div>

        <div className="p-8 bg-[#EAE5DA] border border-[#DDD8CD] rounded-sm flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="font-serif text-2xl text-[#292B27]">Explore the Catalogue</h3>
            <p className="text-xs text-[#77766E] mt-1 font-sans">
              Discover our initial collections in Home, Education, Productivity, and Business.
            </p>
          </div>
          <Link
            href="/shop"
            className="bg-[#292B27] hover:bg-[#657052] text-white px-6 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <span>Browse Products</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
