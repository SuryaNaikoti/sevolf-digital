"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { X, ShoppingBag, ArrowRight, Trash2 } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { formatPrice } from "@/lib/currency";

export function CartDrawer() {
  const { isCartOpen, setIsCartOpen, items, updateQuantity, removeFromCart, subtotal, total } = useCart();
  const { currency } = useCurrency();

  // Prevent background scrolling and enable Escape key dismissal
  useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setIsCartOpen(false);
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [isCartOpen, setIsCartOpen]);

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Shopping Bag Drawer">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      {/* Container: Full-screen on Mobile (w-full inset-0), slide-in drawer on Desktop (right-0 max-w-md) */}
      <div className="fixed inset-0 md:inset-y-0 md:left-auto md:right-0 w-full md:max-w-md bg-[#F5F2EB] shadow-2xl flex flex-col z-50 border-l border-[#DDD8CD] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="px-5 py-4 sm:p-6 border-b border-[#DDD8CD] flex items-center justify-between bg-[#F5F2EB]">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-[#292B27]" />
            <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#292B27]">Your Bag</h2>
            <span className="text-xs text-[#77766E] ml-1">({items.length} {items.length === 1 ? "item" : "items"})</span>
          </div>
          <button
            onClick={() => setIsCartOpen(false)}
            className="p-2 text-[#77766E] hover:text-[#292B27] rounded-xs transition-colors cursor-pointer"
            aria-label="Close cart"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cart Items List: Scrollable independently */}
        <div className="flex-1 overflow-y-auto px-5 py-4 sm:p-6 space-y-4 sm:space-y-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-12 h-12 text-[#DDD8CD] mb-4" />
              <p className="font-serif text-xl sm:text-2xl text-[#292B27] mb-2">Your shopping bag is empty</p>
              <p className="text-xs sm:text-sm text-[#77766E] max-w-xs mb-6">
                Explore our carefully curated digital resources and toolkits.
              </p>
              <button
                onClick={() => setIsCartOpen(false)}
                className="bg-[#292B27] text-white text-xs uppercase tracking-wider font-semibold px-6 py-3 hover:bg-[#657052] transition-colors rounded-xs cursor-pointer"
              >
                Discover Collections
              </button>
            </div>
          ) : (
            items.map(({ product, quantity }) => (
              <div key={product.id} className="flex gap-3 sm:gap-4 pb-4 sm:pb-6 border-b border-[#DDD8CD]/60 last:border-b-0 items-start">
                <div className="w-16 h-20 sm:w-20 sm:h-24 bg-[#EAE5DA] rounded-xs overflow-hidden flex-shrink-0 relative border border-[#DDD8CD]">
                  <img
                    src={product.coverImage}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 flex flex-col justify-between min-h-[5rem] sm:min-h-[6rem]">
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <Link
                        href={`/products/${product.slug}`}
                        onClick={() => setIsCartOpen(false)}
                        className="font-serif text-base sm:text-lg font-medium text-[#292B27] hover:text-[#657052] line-clamp-1"
                      >
                        {product.name}
                      </Link>
                      <button
                        onClick={() => removeFromCart(product.id)}
                        className="text-[#77766E] hover:text-red-600 transition-colors p-1 cursor-pointer"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[11px] text-[#77766E] mt-0.5">{product.formatLabel.split("+")[0]}</p>
                  </div>

                  <div className="flex items-center justify-between mt-2 sm:mt-3">
                    <div className="flex items-center border border-[#DDD8CD] rounded-xs bg-white">
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, quantity - 1)}
                        className="px-2.5 py-0.5 text-xs text-[#292B27] hover:bg-[#F5F2EB] cursor-pointer"
                      >
                        -
                      </button>
                      <span className="px-2.5 py-0.5 text-xs font-medium text-[#292B27]">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(product.id, quantity + 1)}
                        className="px-2.5 py-0.5 text-xs text-[#292B27] hover:bg-[#F5F2EB] cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-serif text-base sm:text-lg font-bold text-[#292B27]">
                      {formatPrice(product.price * quantity, currency)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer / Checkout Actions */}
        {items.length > 0 && (
          <div className="px-5 py-4 sm:p-6 bg-[#EAE5DA] border-t border-[#DDD8CD] space-y-3 sm:space-y-4">
            <div className="space-y-1.5 text-xs sm:text-sm">
              <div className="flex justify-between text-[#77766E]">
                <span>Subtotal</span>
                <span>{formatPrice(subtotal, currency)}</span>
              </div>
              <div className="flex justify-between font-serif text-lg sm:text-xl font-bold text-[#292B27] pt-2 border-t border-[#DDD8CD]">
                <span>Total</span>
                <span>{formatPrice(total, currency)}</span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-[#77766E]">
                Instant digital download links dispatched to your email and persistent library.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:pt-2">
              <Link
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-3.5 sm:py-4 px-4 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-colors rounded-xs text-center shadow-xs cursor-pointer"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/cart"
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-white hover:bg-[#F5F2EB] text-[#292B27] border border-[#DDD8CD] py-2.5 px-4 text-xs uppercase tracking-wider font-medium text-center transition-colors rounded-xs cursor-pointer"
              >
                View Full Cart
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
