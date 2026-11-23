"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

export function Footer() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
      } else {
        const data = await res.json();
        setStatus("error");
        setErrorMessage(data.error || "Subscription could not be processed.");
      }
    } catch {
      setStatus("error");
      setErrorMessage("An unexpected network error occurred. Please retry.");
    }
  };

  return (
    <footer className="bg-[#EAE5DA] text-[#292B27] border-t border-[#DDD8CD] pt-20 pb-12 mt-28">
      <div className="max-w-[1440px] mx-auto px-5 md:px-16">
        {/* Top Section: Brand + Newsletter */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pb-16 border-b border-[#DDD8CD]">
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <Link href="/" className="inline-block mb-4">
                <span className="font-serif text-3xl font-bold tracking-[0.2em] text-[#292B27]">
                  SEVOLF
                </span>
                <span className="block text-[11px] uppercase tracking-[0.3em] text-[#77766E] font-medium">
                  Digital Storefront
                </span>
              </Link>
              <p className="text-sm md:text-base text-[#77766E] leading-relaxed max-w-md font-sans">
                Curating quiet clarity, intentional routines, and purposeful learning tools for individuals, families, and independent builders worldwide.
              </p>
            </div>
            <div className="mt-8 text-xs text-[#77766E] space-y-1">
              <span className="block">Original editions created and published exclusively by SEVOLF.</span>
              <span className="block text-[11px] text-[#77766E]/80">Independent digital imprint of the SEVOLF design studio.</span>
            </div>
          </div>

          {/* Newsletter Box */}
          <div className="lg:col-span-7 bg-[#F5F2EB] p-8 md:p-10 border border-[#DDD8CD] rounded-sm shadow-xs">
            <h3 className="font-serif text-2xl md:text-3xl font-normal text-[#292B27] mb-2 leading-tight">
              A little inspiration, delivered.
            </h3>
            <p className="text-sm md:text-base text-[#77766E] mb-6 font-sans">
              Get thoughtful ideas, new releases, and useful digital resources delivered to your inbox. No noise, no spam.
            </p>

            {status === "success" ? (
              <div className="flex items-center gap-3 text-sm text-[#657052] bg-white p-4 border border-[#DDD8CD] rounded-xs">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span>Thank you. Your email has been registered for our quiet updates.</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address..."
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (status === "error") setStatus("idle");
                    }}
                    className="flex-1 bg-white border border-[#DDD8CD] px-4 py-3.5 text-sm text-[#292B27] placeholder:text-[#77766E] focus:outline-none focus:border-[#657052] rounded-xs"
                  />
                  <button
                    type="submit"
                    disabled={status === "loading"}
                    className="bg-[#292B27] hover:bg-[#657052] text-white px-7 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors flex items-center justify-center gap-2 rounded-xs disabled:opacity-50"
                  >
                    <span>{status === "loading" ? "Subscribing..." : "Subscribe"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {status === "error" && (
                  <p className="text-xs text-red-600 font-medium">{errorMessage}</p>
                )}
                <p className="text-xs text-[#77766E] font-sans">
                  By subscribing, you agree to our privacy policy. Unsubscribe anytime in 1 click.
                </p>
              </form>
            )}
          </div>
        </div>

        {/* Middle Section: Site Navigation Links */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-8 py-16 border-b border-[#DDD8CD] text-sm">
          <div>
            <h4 className="font-serif text-lg text-[#292B27] mb-4 font-medium">Explore</h4>
            <ul className="space-y-3 text-[#77766E]">
              <li><Link href="/shop" className="hover:text-[#292B27] transition-colors">Shop All Products</Link></li>
              <li><Link href="/collections" className="hover:text-[#292B27] transition-colors">Collections</Link></li>
              <li><Link href="/new-arrivals" className="hover:text-[#292B27] transition-colors">New Arrivals</Link></li>
              <li><Link href="/bestsellers" className="hover:text-[#292B27] transition-colors">Bestsellers</Link></li>
              <li><Link href="/bundles" className="hover:text-[#292B27] transition-colors">Product Bundles</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-lg text-[#292B27] mb-4 font-medium">Collections</h4>
            <ul className="space-y-3 text-[#77766E]">
              <li><Link href="/collections/home-living" className="hover:text-[#292B27] transition-colors">Home & Living</Link></li>
              <li><Link href="/collections/kids-education" className="hover:text-[#292B27] transition-colors">SEVOLF Little</Link></li>
              <li><Link href="/collections/productivity" className="hover:text-[#292B27] transition-colors">Productivity & Planning</Link></li>
              <li><Link href="/collections/business" className="hover:text-[#292B27] transition-colors">Business & Entrepreneurship</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-lg text-[#292B27] mb-4 font-medium">Customer Support</h4>
            <ul className="space-y-3 text-[#77766E]">
              <li><Link href="/contact" className="hover:text-[#292B27] transition-colors">Contact Us</Link></li>
              <li><Link href="/shipping-policy" className="hover:text-[#292B27] transition-colors">Shipping & Delivery Policy</Link></li>
              <li><Link href="/refund-policy" className="hover:text-[#292B27] transition-colors">Cancellation & Refunds</Link></li>
              <li><Link href="/account/library" className="hover:text-[#292B27] transition-colors">Digital Library & Downloads</Link></li>
              <li><Link href="/faq" className="hover:text-[#292B27] transition-colors">Frequently Asked Questions</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-serif text-lg text-[#292B27] mb-4 font-medium">About & Legal</h4>
            <ul className="space-y-3 text-[#77766E]">
              <li><Link href="/terms" className="hover:text-[#292B27] transition-colors">Terms and Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-[#292B27] transition-colors">Privacy Policy</Link></li>
              <li><Link href="/licensing" className="hover:text-[#292B27] transition-colors">Licensing & Terms of Use</Link></li>
              <li><Link href="/about" className="hover:text-[#292B27] transition-colors">About SEVOLF</Link></li>
              <li><Link href="/journal" className="hover:text-[#292B27] transition-colors">The Journal</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between text-xs text-[#77766E] gap-4">
          <p>© 2026 SEVOLF Digital. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Secure 256-bit SSL Commerce</span>
            <span>•</span>
            <span>Razorpay Verified Merchant</span>
            <span>•</span>
            <span>Instant Digital Delivery</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
