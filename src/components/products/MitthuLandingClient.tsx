"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Product } from "@/types/commerce";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { formatPrice } from "@/lib/currency";
import {
  BookOpen,
  Sparkles,
  Printer,
  Download,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  ChevronDown,
  ShoppingBag,
  Check,
  Heart,
  ShieldCheck,
  Clock,
  Layers,
} from "lucide-react";

interface MitthuLandingClientProps {
  product: Product;
}

const PREVIEW_PAGES = [
  { page: 1, title: "Cover", subtitle: "Mitthu's Fun Learning Book", src: "/images/products/mitthus-fun-learning/previews/page-01-cover.jpg" },
  { page: 5, title: "Rain, Rain!", subtitle: "Pre-writing Play · Standing Lines", src: "/images/products/mitthus-fun-learning/previews/page-05-rain-rain.jpg" },
  { page: 19, title: "Orange (नारंगी)", subtitle: "Colour World · Object Recognition", src: "/images/products/mitthus-fun-learning/previews/page-19-orange.jpg" },
  { page: 24, title: "Number 5 (पाँच)", subtitle: "Numbers & Counting · Trace & Count", src: "/images/products/mitthus-fun-learning/previews/page-24-number-5.jpg" },
  { page: 29, title: "Count and Match", subtitle: "Numbers & Counting · Matching", src: "/images/products/mitthus-fun-learning/previews/page-29-count-and-match.jpg" },
  { page: 33, title: "Shape Train", subtitle: "Shape Fun · Colour by Code", src: "/images/products/mitthus-fun-learning/previews/page-33-shape-train.jpg" },
  { page: 38, title: "Help Mitthu Maze", subtitle: "Brain Games · Path Tracing", src: "/images/products/mitthus-fun-learning/previews/page-38-help-mitthu-maze.jpg" },
  { page: 43, title: "Cut and Paste", subtitle: "Brain Games · Shadow Matching", src: "/images/products/mitthus-fun-learning/previews/page-43-cut-and-paste.jpg" },
  { page: 49, title: "First Letters A to F", subtitle: "English & Hindi Vocabulary", src: "/images/products/mitthus-fun-learning/previews/page-49-first-letters.jpg" },
  { page: 50, title: "Certificate of Awesomeness", subtitle: "Celebration Page", src: "/images/products/mitthus-fun-learning/previews/page-50-certificate.jpg" },
];

const LEARNING_WORLDS = [
  { title: "Pre-writing Play", pages: "Pages 5–14", desc: "Standing, sleeping and slanting lines, waves, zig-zags, spirals, loops and circles.", bg: "bg-[#DCEBF6]/65", img: PREVIEW_PAGES[1].src },
  { title: "Colour World", pages: "Pages 15–19", desc: "Red, yellow, blue, green and orange with familiar everyday objects.", bg: "bg-[#F3B6A6]/35", img: PREVIEW_PAGES[2].src },
  { title: "Numbers & Counting", pages: "Pages 20–29", desc: "Numbers 1–10, counting pictures, number tracing and matching.", bg: "bg-[#F8E4A6]/50", img: PREVIEW_PAGES[3].src },
  { title: "Shape Fun", pages: "Pages 30–33", desc: "Circle, square, triangle and rectangle through spotting and colouring.", bg: "bg-[#E9E1F4]/60", img: PREVIEW_PAGES[5].src },
  { title: "Brain Games", pages: "Pages 34–43", desc: "Big and small, matching, odd one out, shadows, maze, patterns and cut-and-paste.", bg: "bg-[#DDEDE2]/65", img: PREVIEW_PAGES[6].src },
  { title: "Creative Time", pages: "Pages 44–48", desc: "Rangoli dots, finger printing, scribbling, drawing missing parts and Festival of Lights.", bg: "bg-[#F3B6A6]/30", img: PREVIEW_PAGES[7].src },
  { title: "First Letters & Certificate", pages: "Pages 49–50", desc: "Letters A–F with English and Hindi vocabulary, plus the Certificate of Awesomeness.", bg: "bg-[#DCEBF6]/50", img: PREVIEW_PAGES[8].src },
];

const FAQS = [
  { q: "What age is this book designed for?", a: "Mitthu's Fun Learning Book is designed for toddlers aged 2 to 3 years, with large tracing paths and simple parent-guided prompts." },
  { q: "What is included in my purchase?", a: "You receive a 50-page printable A4 PDF activity book covering seven learning worlds, parent guidance, and a Certificate of Awesomeness on page 50." },
  { q: "How should I print the book?", a: "Print at home on standard A4 paper at Actual Size (100%). We recommend 120–150 gsm paper for crayons and dot markers." },
  { q: "How is the digital file delivered?", a: "Immediately after payment verification, you receive direct download buttons on the confirmation page and an email with your secure download link." },
  { q: "How long do I have download access?", a: "Each download link remains valid for 30 days and permits up to 10 downloads. You can also access your order in My Digital Library." },
  { q: "Which devices can open the PDF?", a: "Any phone, tablet, laptop, or desktop computer with a standard PDF reader." },
  { q: "Is parent supervision required?", a: "Yes. Activities are designed for parent-child sessions (~10 minutes a day). Adult supervision is required, and scissors are for adults only." },
  { q: "What are the licence terms?", a: "Single-household personal licence. Unlimited personal prints for children in your home; redistribution or commercial resale is not permitted." },
  { q: "What is your refund policy?", a: "Due to immediate electronic delivery, orders cannot be cancelled once digital files or download tokens have been accessed. Technical issues are resolved within 48 hours via support@sevolf.shop." },
];

export function MitthuLandingClient({ product }: MitthuLandingClientProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { currency } = useCurrency();
  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [hideStickyBar, setHideStickyBar] = useState(false);
  const finalSectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = finalSectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHideStickyBar(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const formattedPrice = formatPrice(product.price, currency);
  const activePreview = PREVIEW_PAGES[activeIdx];

  const handleBuyNow = () => {
    addToCart(product, 1);
    router.push("/checkout");
  };

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowRight") setActiveIdx((i) => (i + 1) % PREVIEW_PAGES.length);
      if (e.key === "ArrowLeft") setActiveIdx((i) => (i - 1 + PREVIEW_PAGES.length) % PREVIEW_PAGES.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxOpen]);

  return (
    <div className="bg-[#F7F5F0] text-[#22231F] pb-20 md:pb-0">
      {/* SECTION 1 — HERO */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-14 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F8E4A6]/80 border border-[#E6D18F] rounded-xs text-[11px] font-mono uppercase tracking-[0.15em] text-[#22231F]">
              <span>Ages 2–3</span>
              <span>·</span>
              <span>50-Page Printable Activity Book</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-[54px] font-normal text-[#22231F] leading-[1.08] tracking-tight">
              Little Hands. Big Discoveries.
            </h1>
            <p className="text-base sm:text-lg text-[#55544E] leading-relaxed max-w-xl">
              A playful collection of printable activities created for little learners aged 2–3, with simple moments of discovery to enjoy together.
            </p>

            <ul className="space-y-2 text-sm text-[#22231F]">
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#657052] shrink-0" /><span>Seven themed learning worlds from lines to first letters</span></li>
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#657052] shrink-0" /><span>English instructions with gentle Hindi vocabulary</span></li>
              <li className="flex items-center gap-2.5"><Check className="w-4 h-4 text-[#657052] shrink-0" /><span>Ready to print at home on standard A4 paper</span></li>
            </ul>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleBuyNow}
                className="bg-[#22231F] hover:bg-[#657052] text-white px-7 py-4 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Get My Copy — {formattedPrice}</span>
              </button>
              <a
                href="#preview-gallery"
                className="bg-white hover:bg-[#FAF8F5] border border-[#DDD8CD] text-[#22231F] px-7 py-4 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors text-center"
              >
                Preview the Book
              </a>
            </div>

            <p className="text-[11px] font-mono uppercase tracking-wider text-[#77766E]">
              Digital PDF Download · No physical book will be shipped
            </p>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-md py-4">
              <div className="hidden sm:block absolute -right-4 top-8 w-44 aspect-[3/4] rounded-xs overflow-hidden border border-[#DDD8CD] shadow-md rotate-6 bg-white">
                <img src={PREVIEW_PAGES[3].src} alt="Number 5 activity page" className="w-full h-full object-cover" />
              </div>
              <div className="hidden sm:block absolute -left-4 top-12 w-44 aspect-[3/4] rounded-xs overflow-hidden border border-[#DDD8CD] shadow-md -rotate-6 bg-white">
                <img src={PREVIEW_PAGES[1].src} alt="Rain, Rain! tracing page" className="w-full h-full object-cover" />
              </div>
              <div className="relative z-10 mx-auto w-72 sm:w-80 aspect-[3/4] rounded-xs overflow-hidden border-2 border-[#DDD8CD] shadow-2xl bg-white">
                <img
                  src={PREVIEW_PAGES[0].src}
                  alt="Mitthu's Fun Learning Book Cover"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2 — QUICK TRUST STRIP */}
      <section className="border-y border-[#E8E5DD] bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-[#22231F]">
          <div className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4 text-[#657052]" /><span>Designed for Ages 2–3</span></div>
          <div className="flex items-center justify-center gap-2"><BookOpen className="w-4 h-4 text-[#657052]" /><span>50-page printable activity book</span></div>
          <div className="flex items-center justify-center gap-2"><Layers className="w-4 h-4 text-[#657052]" /><span>Seven learning categories</span></div>
          <div className="flex items-center justify-center gap-2"><Download className="w-4 h-4 text-[#657052]" /><span>Instant digital access</span></div>
        </div>
      </section>

      {/* SECTION 3 — PARENT PROBLEM / EMOTIONAL CONNECTION */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center bg-white border border-[#E8E5DD] rounded-sm p-8 sm:p-12">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#657052]">Parent-Guided Play</span>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#22231F] leading-tight">
              Less scrolling. More little moments together.
            </h2>
            <p className="text-sm sm:text-base text-[#55544E] leading-relaxed">
              With ready-to-print activities, you can sit together for 10 calm minutes of drawing, colouring, counting and matching—using jumbo crayons and everyday conversation, at your child&rsquo;s own pace.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            <div className="aspect-[3/4] rounded-xs overflow-hidden border border-[#E8E5DD] bg-[#FAF8F5]">
              <img src={PREVIEW_PAGES[4].src} alt="Count and Match worksheet" className="w-full h-full object-cover" />
            </div>
            <div className="aspect-[3/4] rounded-xs overflow-hidden border border-[#E8E5DD] bg-[#FAF8F5] mt-6">
              <img src={PREVIEW_PAGES[5].src} alt="Shape Train colouring worksheet" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4 — SEVEN LEARNING WORLDS */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-16 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#657052]">Inside the 50 Pages</span>
            <h2 className="font-serif text-3xl font-normal text-[#22231F] mt-1">Seven Learning Worlds</h2>
          </div>
          <p className="text-xs text-[#77766E]">Follow the sequence or jump to any page your child enjoys.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {LEARNING_WORLDS.map((w) => (
            <div
              key={w.title}
              className={`${w.bg} border border-[#E8E5DD] rounded-sm p-5 flex flex-col justify-between space-y-4 hover:-translate-y-0.5 transition-transform`}
            >
              <div className="space-y-2">
                <span className="inline-block text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 bg-white/85 text-[#22231F] border border-[#E8E5DD]">
                  {w.pages}
                </span>
                <h3 className="font-serif text-xl text-[#22231F]">{w.title}</h3>
                <p className="text-xs text-[#55544E] leading-relaxed">{w.desc}</p>
              </div>
              <div className="aspect-[4/3] overflow-hidden border border-[#E8E5DD] bg-white">
                <img src={w.img} alt={w.title} className="w-full h-full object-cover object-top" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 5 — PRODUCT PREVIEW GALLERY */}
      <section id="preview-gallery" className="bg-white border-y border-[#E8E5DD] py-16">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#657052]">Authentic Page Previews</span>
              <h2 className="font-serif text-3xl font-normal text-[#22231F] mt-1">Inspect 10 Real Pages</h2>
            </div>
            <button
              type="button"
              onClick={handleBuyNow}
              className="bg-[#22231F] hover:bg-[#657052] text-white px-6 py-3 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              Get My Copy — {formattedPrice}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 bg-[#FAF8F5] border border-[#E8E5DD] rounded-sm p-5 sm:p-6 space-y-4">
              <div className="relative aspect-[3/4] max-h-[560px] mx-auto bg-white border border-[#DDD8CD] overflow-hidden">
                <img
                  src={activePreview.src}
                  alt={`Page ${activePreview.page}: ${activePreview.title}`}
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  aria-label="Enlarge preview"
                  className="absolute top-3 right-3 p-2 bg-white/95 hover:bg-white border border-[#DDD8CD] text-[#22231F] shadow-xs cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between text-xs">
                <div>
                  <span className="font-mono text-[#657052] font-semibold">Page {activePreview.page}</span>
                  <span className="mx-2 text-[#DDD8CD]">|</span>
                  <strong className="text-[#22231F]">{activePreview.title}</strong>
                  <span className="hidden sm:inline text-[#77766E]"> — {activePreview.subtitle}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Previous preview"
                    onClick={() => setActiveIdx((i) => (i - 1 + PREVIEW_PAGES.length) % PREVIEW_PAGES.length)}
                    className="p-2 border border-[#DDD8CD] bg-white hover:bg-[#F7F5F0] cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Next preview"
                    onClick={() => setActiveIdx((i) => (i + 1) % PREVIEW_PAGES.length)}
                    className="p-2 border border-[#DDD8CD] bg-white hover:bg-[#F7F5F0] cursor-pointer"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-5 lg:grid-cols-2 gap-3">
              {PREVIEW_PAGES.map((p, idx) => (
                <button
                  key={p.page}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  className={`text-left p-2 border transition-all cursor-pointer ${
                    idx === activeIdx
                      ? "border-[#22231F] bg-[#FAF8F5] ring-1 ring-[#22231F]"
                      : "border-[#E8E5DD] bg-white hover:border-[#657052]"
                  }`}
                >
                  <div className="aspect-[3/4] overflow-hidden bg-[#F7F5F0]">
                    <img src={p.src} alt={p.title} className="w-full h-full object-cover" />
                  </div>
                  <p className="hidden lg:block text-[11px] font-medium text-[#22231F] truncate mt-1.5">
                    p.{p.page} · {p.title}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6 — PRODUCT USAGE EXPERIENCE */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-16 space-y-8">
        <div className="text-center space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#657052]">Simple 4-Step Workflow</span>
          <h2 className="font-serif text-3xl font-normal text-[#22231F]">From download to little discoveries.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
          {[
            { step: "01", icon: ShoppingBag, title: "Purchase the book", desc: "Complete your one-time purchase securely." },
            { step: "02", icon: Download, title: "Download the PDF", desc: "Instant download link after payment verification." },
            { step: "03", icon: Printer, title: "Print the activities", desc: "Print on A4 paper at Actual Size (100%)." },
            { step: "04", icon: Heart, title: "Enjoy them together", desc: "Share 10 playful minutes a day with your child." },
          ].map((s) => (
            <div key={s.step} className="p-6 bg-white border border-[#E8E5DD] rounded-sm space-y-2.5">
              <span className="font-mono text-[11px] text-[#657052] font-semibold block">{s.step}</span>
              <s.icon className="w-5 h-5 text-[#22231F]" />
              <h3 className="font-serif text-lg text-[#22231F]">{s.title}</h3>
              <p className="text-[#77766E] leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 7 — PARENT-FRIENDLY DESIGN */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-16">
        <div className="bg-white border border-[#E8E5DD] rounded-sm p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#22231F]">
              Designed for little hands, with parents in mind.
            </h2>
            <ul className="space-y-2.5 text-sm text-[#55544E] list-disc pl-5">
              <li>Two or three pages per day (~10 minutes). Stop when your child loses interest.</li>
              <li>Praise effort, not perfection—scribbling outside the lines is welcomed.</li>
              <li>Adult supervision is required. Scissors are for adults only.</li>
              <li>Print on A4 at Actual Size (100%), preferably 120–150 gsm paper.</li>
            </ul>
          </div>
          <div className="lg:col-span-5 bg-[#FAF8F5] border border-[#E8E5DD] rounded-xs p-6 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#22231F] font-semibold">
              Recommended Materials
            </h3>
            <ul className="space-y-2 text-xs text-[#55544E]">
              <li>• Jumbo crayons or washable markers</li>
              <li>• Washable dot marker or washable ink pad</li>
              <li>• Child-safe glue stick</li>
              <li>• Scissors (for adults only)</li>
            </ul>
          </div>
        </div>
      </section>

      {/* SECTION 8 — MEET MITTHU */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-16">
        <div className="bg-[#DDEDE2]/60 border border-[#C8DEC9] rounded-sm p-8 sm:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-4 flex justify-center">
            <div className="w-48 h-60 overflow-hidden border border-[#C8DEC9] bg-white shadow-sm">
              <img src={PREVIEW_PAGES[0].src} alt="Mitthu the green parrot" className="w-full h-full object-cover object-left" />
            </div>
          </div>
          <div className="md:col-span-8 space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#55694B]">Your Learning Buddy</span>
            <h2 className="font-serif text-3xl font-normal text-[#22231F]">
              Meet Mitthu, your little learning buddy!
            </h2>
            <p className="text-lg text-[#22231F] italic font-serif">
              &ldquo;Hello, little explorer! I&rsquo;m Mitthu. Let&rsquo;s trace, count, colour and play together!&rdquo;
            </p>
            <p className="text-sm text-[#55544E] leading-relaxed">
              Mitthu guides every page with gentle parent tips so you can encourage curiosity without pressure.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 9 — PRODUCT SPECIFICATIONS */}
      <section className="max-w-4xl mx-auto px-5 sm:px-8 pb-16">
        <div className="bg-white border border-[#E8E5DD] rounded-sm p-7 sm:p-9 space-y-4">
          <h2 className="font-serif text-2xl font-normal text-[#22231F]">Product Specifications</h2>
          <dl className="divide-y divide-[#E8E5DD] text-xs sm:text-sm">
            {[
              ["Product Name", product.name],
              ["Age Group", "2–3 years"],
              ["Pages", "50-page printable activity book"],
              ["File Format", "Printable PDF"],
              ["Language", "English instructions with Hindi vocabulary"],
              ["Paper Size", "A4 (Actual Size 100%, 120–150 gsm recommended)"],
              ["Delivery", "Instant digital download after payment verification"],
              ["Licence", "Single-household personal licence"],
            ].map(([k, v]) => (
              <div key={k} className="py-3 flex justify-between gap-4">
                <dt className="text-[#77766E]">{k}</dt>
                <dd className="text-[#22231F] font-medium text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* SECTION 10 — TRUST AND FAQ */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 pb-16 space-y-6">
        <h2 className="font-serif text-3xl font-normal text-[#22231F] text-center">Frequently Asked Questions</h2>
        <div className="divide-y divide-[#E8E5DD] border border-[#E8E5DD] bg-white rounded-sm">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 text-sm font-medium text-[#22231F] hover:bg-[#FAF8F5] cursor-pointer"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 text-xs sm:text-sm text-[#55544E] leading-relaxed">
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 11 — FINAL CONVERSION SECTION */}
      <section ref={finalSectionRef} className="max-w-5xl mx-auto px-5 sm:px-8 pb-16">
        <div className="bg-white border border-[#DDD8CD] rounded-sm p-8 sm:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-4 flex justify-center">
            <img
              src={PREVIEW_PAGES[0].src}
              alt="Mitthu's Fun Learning Book Cover"
              className="w-52 aspect-[3/4] object-cover border border-[#DDD8CD] shadow-lg"
            />
          </div>
          <div className="md:col-span-8 space-y-4">
            <h2 className="font-serif text-3xl sm:text-4xl font-normal text-[#22231F]">
              Make Room for More Little Discoveries.
            </h2>
            <p className="text-sm text-[#55544E]">
              {product.name} · Ages 2–3 · 50-page printable activity book · Digital PDF
            </p>
            <div className="text-3xl font-serif text-[#22231F]">{formattedPrice}</div>
            <button
              type="button"
              onClick={handleBuyNow}
              className="w-full sm:w-auto bg-[#22231F] hover:bg-[#657052] text-white px-8 py-4 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Get My Copy — {formattedPrice}</span>
            </button>
            <p className="text-xs text-[#77766E]">
              Instant digital delivery after payment verification. Questions?{" "}
              <a href="mailto:support@sevolf.shop" className="underline text-[#22231F]">support@sevolf.shop</a>
            </p>
          </div>
        </div>
      </section>

      {/* MOBILE STICKY PURCHASE BAR (hides when final conversion section is in view) */}
      <div
        className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xs border-t border-[#E8E5DD] px-4 py-3 flex items-center justify-between gap-3 shadow-lg transition-all duration-300 ${
          hideStickyBar ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
        }`}
      >
        <div>
          <p className="text-xs font-medium text-[#22231F] truncate">Mitthu&rsquo;s Fun Learning Book</p>
          <p className="text-xs font-mono font-semibold text-[#657052]">{formattedPrice}</p>
        </div>
        <button
          type="button"
          onClick={handleBuyNow}
          className="bg-[#22231F] text-white px-5 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs shrink-0"
        >
          Get My Copy
        </button>
      </div>

      {/* LIGHTBOX */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-2xl w-full bg-white rounded-sm p-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 p-1.5 bg-white border border-[#DDD8CD] text-[#22231F] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img
              src={activePreview.src}
              alt={`Page ${activePreview.page}: ${activePreview.title}`}
              className="w-full max-h-[82vh] object-contain mx-auto"
            />
          </div>
        </div>
      )}
    </div>
  );
}
