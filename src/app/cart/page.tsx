"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { formatPrice } from "@/lib/currency";
import { Trash2, ArrowRight, ShieldCheck, Download, ShoppingBag } from "lucide-react";

export default function CartPage() {
  const { items, removeFromCart, updateQuantity, subtotal, total, clearCart } = useCart();
  const { currency } = useCurrency();

  if (items.length === 0) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 py-16 md:py-20 text-center">
        <div className="max-w-md mx-auto space-y-4">
          <ShoppingBag className="w-12 h-12 sm:w-16 sm:h-16 text-[#DDD8CD] mx-auto" />
          <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#292B27]">Your Shopping Bag is Empty</h1>
          <p className="text-xs sm:text-sm text-[#77766E] leading-relaxed">
            You haven't selected any digital editions yet. Explore our curated collections for home, early education, productivity, and business.
          </p>
          <div className="pt-4">
            <Link
              href="/shop"
              className="inline-block bg-[#292B27] hover:bg-[#657052] text-white px-8 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-xs sm:rounded-sm"
            >
              Browse The Shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 py-6 md:py-16 pb-28 md:pb-16">
      <div className="mb-6 md:mb-10 flex items-end justify-between">
        <div>
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1">
            BAG REVIEW
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl sm:text-4xl font-normal text-[#292B27]">
            Shopping Bag ({items.length})
          </h1>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-[#77766E] hover:text-red-600 transition-colors underline underline-offset-4 cursor-pointer"
        >
          Clear bag
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        {/* Items List (Left 8 Cols) */}
        <div className="lg:col-span-8 space-y-3 sm:space-y-4">
          <div className="bg-white border border-[#DDD8CD] rounded-xs sm:rounded-sm divide-y divide-[#DDD8CD]">
            {items.map(({ product, quantity }) => (
              <div key={product.id} className="p-4 sm:p-6 flex gap-3 sm:gap-6 items-start">
                <div className="w-16 h-20 sm:w-24 sm:h-28 bg-[#EAE5DA] rounded-xs overflow-hidden flex-shrink-0 relative border border-[#DDD8CD]">
                  <Image src={product.coverImage} alt={product.name} fill className="object-cover" />
                </div>
                <div className="flex-1 flex flex-col justify-between min-h-[5rem] sm:min-h-[7rem] space-y-2">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <Link href={`/products/${product.slug}`} className="font-serif text-base sm:text-xl font-medium text-[#292B27] hover:text-[#657052] transition-colors line-clamp-1">
                        {product.name}
                      </Link>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="text-[#77766E] hover:text-red-600 p-1 cursor-pointer"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="text-[11px] text-[#77766E] block mt-0.5">{product.formatLabel.split("+")[0]}</span>
                    <span className="text-[10px] sm:text-xs text-[#657052] font-medium block mt-0.5">
                      Licence: {product.licenceType.toUpperCase()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center border border-[#DDD8CD] rounded-xs bg-white">
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs text-[#292B27] hover:bg-[#F5F2EB] cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2 sm:px-3 py-0.5 text-xs font-medium text-[#292B27]">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs text-[#292B27] hover:bg-[#F5F2EB] cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <span className="font-serif text-base sm:text-xl font-bold text-[#292B27]">
                      {formatPrice(product.price * quantity, currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-[#EAE5DA] border border-[#DDD8CD] rounded-xs flex items-center gap-2.5 text-xs text-[#292B27]">
            <Download className="w-4 h-4 text-[#657052] flex-shrink-0" />
            <span>Digital orders are fulfilled instantaneously via instant download and securely archived in your account.</span>
          </div>
        </div>

        {/* Order Summary Box (Right 4 Cols) */}
        <div className="lg:col-span-4">
          <div className="bg-white border border-[#DDD8CD] rounded-xs sm:rounded-sm p-4 sm:p-6 space-y-4 sm:space-y-6 sticky top-28 shadow-2xs">
            <h2 className="font-serif text-lg sm:text-xl font-medium text-[#292B27] pb-3 border-b border-[#DDD8CD]">
              Order Summary
            </h2>

            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex justify-between text-[#77766E]">
                <span>Items Subtotal</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between text-[#77766E]">
                <span>Electronic Delivery</span>
                <span className="text-[#657052] font-medium">FREE (Instant)</span>
              </div>
              <div className="flex justify-between font-serif text-lg sm:text-xl font-bold text-[#292B27] pt-3 border-t border-[#DDD8CD]">
                <span>Total Due</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
            </div>

            <Link
              href="/checkout"
              className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-3.5 sm:py-4 px-6 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-xs sm:rounded-sm text-center shadow-xs"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="pt-3 border-t border-[#DDD8CD] space-y-1.5 text-[11px] text-[#77766E]">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#657052]" />
                <span>SSL Encrypted Checkout</span>
              </div>
              <p>Supports Razorpay (UPI, Netbanking, Cards) and Stripe (Global Cards).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Mobile Checkout Action (Positioned cleanly above bottom nav on mobile) */}
      <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 bg-[#F5F2EB]/95 backdrop-blur-md border-t border-[#DDD8CD] px-4 py-2.5 shadow-[0_-4px_16px_rgba(41,43,39,0.06)] flex items-center justify-between gap-4">
        <div>
          <span className="text-[10px] uppercase font-semibold text-[#77766E] block font-sans">Total</span>
          <span className="font-serif text-xl font-bold text-[#292B27]">
            {formatPrice(total, currency)}
          </span>
        </div>

        <Link
          href="/checkout"
          className="flex-1 bg-[#292B27] hover:bg-[#657052] text-white py-3 px-4 text-xs uppercase tracking-widest font-semibold rounded-xs transition-all flex items-center justify-center gap-1.5 shadow-xs text-center"
        >
          <span>Checkout</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
