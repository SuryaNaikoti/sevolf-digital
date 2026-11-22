import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = {
  title: "The Journal — Essays on Design, Intentionality & Living",
  description: "Reflections on minimalist architecture, early childhood development, unhurried focus, and modern design.",
};

export default function JournalPage() {
  const articles = [
    {
      slug: "quiet-interiors-quiet-minds",
      title: "Quiet Interiors, Quiet Minds: The Psychology of Living With Less",
      date: "February 14, 2026",
      category: "Home & Philosophy",
      readTime: "5 min read",
      excerpt: "How eliminating redundant physical objects creates cognitive bandwidth for thoughtful daily reflection.",
      image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
    },
    {
      slug: "analog-touch-in-digital-childhood",
      title: "The Tactile Child: Resisting Screen Overload Through Intentional Workbooks",
      date: "January 28, 2026",
      category: "Early Education",
      readTime: "6 min read",
      excerpt: "Why pencil resistance on paper and earth-toned graphics cultivate deeper focus in developing minds than touchscreen animations.",
      image: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=800&q=80",
    },
    {
      slug: "the-myth-of-the-12-hour-workday",
      title: "The Rhythm of Depth: Three Uninterrupted Hours Beat Ten Chaotic Ones",
      date: "January 15, 2026",
      category: "Productivity",
      readTime: "4 min read",
      excerpt: "A critique of perpetual reaction and an introduction to unhurried, high-leverage intellectual blocks.",
      image: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=800&q=80",
    },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-16">
      <div className="max-w-2xl mb-12">
        <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
          EDITORIAL ESSAYS
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
          The Journal
        </h1>
        <p className="text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
          Inquiries into design philosophy, intentional parenting, analog workflows, and the architecture of calm.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {articles.map((art) => (
          <article key={art.slug} className="group flex flex-col bg-white border border-[#DDD8CD] rounded-sm overflow-hidden">
            <div className="aspect-[16/10] bg-[#EAE5DA] overflow-hidden">
              <img
                src={art.image}
                alt={art.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
            <div className="p-6 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-[#77766E] uppercase tracking-wider mb-2 font-medium">
                  <span>{art.category}</span>
                  <span>{art.readTime}</span>
                </div>
                <h3 className="font-serif text-xl font-medium text-[#292B27] group-hover:text-[#657052] transition-colors leading-snug mb-3">
                  {art.title}
                </h3>
                <p className="text-xs text-[#77766E] leading-relaxed font-sans line-clamp-3">
                  {art.excerpt}
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[#DDD8CD]/60 flex items-center justify-between text-xs">
                <span className="text-[#77766E]">{art.date}</span>
                <span className="font-semibold text-[#292B27] group-hover:text-[#657052] flex items-center gap-1">
                  Read Essay <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
