"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Script from "next/script";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { formatPrice } from "@/lib/currency";
import { 
  ShieldCheck, 
  Lock, 
  CreditCard, 
  ArrowLeft, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, total, clearCart } = useCart();
  const { currency, setCurrency } = useCurrency();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("India");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const handleCompleteOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) {
      setErrorMessage("Please complete all required customer fields.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage("");

    try {
      // 1. Initialize checkout and create order record in database + gateway intent
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { email, fullName, country },
          items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })),
          currency,
          paymentMethod: "razorpay",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setIsProcessing(false);
        setErrorMessage(data.error || "Failed to initialize checkout.");
        return;
      }

      const { orderId, orderNumber, amount, currency: responseCurrency, gatewayOrderId, keyId, isTestMode } = data;

      // 2. If Razorpay SDK is available and key is configured, trigger standard checkout modal
      if (typeof window !== "undefined" && window.Razorpay && keyId && !keyId.includes("placeholder")) {
        const options = {
          key: keyId,
          amount: Math.round(amount * 100),
          currency: responseCurrency || currency || "INR",
          name: "SEVOLF Digital",
          description: `Order ${orderNumber}`,
          order_id: gatewayOrderId,
          prefill: {
            name: fullName,
            email: email,
          },
          theme: {
            color: "#292B27",
          },
          handler: async function (response: any) {
            try {
              // 3. Verify signature authoritatively on the server
              const verifyRes = await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  orderId,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });

              const verifyData = await verifyRes.json();
              if (verifyRes.ok && verifyData.success) {
                clearCart();
                router.push(`/order/success?orderId=${orderId}`);
              } else {
                setIsProcessing(false);
                setErrorMessage(verifyData.error || "Payment signature verification failed.");
              }
            } catch (err: any) {
              setIsProcessing(false);
              setErrorMessage("Network error during payment verification: " + err.message);
            }
          },
          modal: {
            ondismiss: function () {
              setIsProcessing(false);
              setErrorMessage("Payment was cancelled. You can retry checkout at any time.");
            },
          },
        };

        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", function (resp: any) {
          setIsProcessing(false);
          setErrorMessage(`Payment failed: ${resp.error?.description || "Transaction declined."}`);
        });
        rzp.open();
      } else {
        // Test Simulation Mode (In compliance with strict rule: safe sandbox purchase-to-download test)
        console.log("[Checkout UI] Executing Test Mode Payment Verification for Order:", orderId);
        const verifyRes = await fetch("/api/checkout/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId,
            isTestSimulation: true,
          }),
        });

        const verifyData = await verifyRes.json();
        if (verifyRes.ok && verifyData.success) {
          clearCart();
          router.push(`/order/success?orderId=${orderId}`);
        } else {
          setIsProcessing(false);
          setErrorMessage(verifyData.error || "Sandbox payment verification failed.");
        }
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage("Network error occurred during checkout initialization. Please retry.");
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 py-16 text-center">
        <h1 className="font-serif text-2xl sm:text-3xl text-[#292B27] mb-4">No items to checkout</h1>
        <Link
          href="/shop"
          className="inline-block bg-[#292B27] text-white px-8 py-3 text-xs uppercase tracking-widest font-semibold rounded-xs"
        >
          Return to Shop
        </Link>
      </div>
    );
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        onLoad={() => setScriptLoaded(true)}
      />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 py-6 md:py-16 pb-20 md:pb-16">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#77766E] hover:text-[#292B27] mb-6 md:mb-8"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Cart</span>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12">
          {/* Customer Details Form */}
          <div className="lg:col-span-7 space-y-6 sm:space-y-8">
            <div>
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-[#657052] font-semibold block mb-1">
                EXPRESS DIGITAL CHECKOUT
              </span>
              <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#292B27]">
                Customer Information
              </h1>
              <p className="text-xs text-[#77766E] mt-1">
                Your digital product download entitlements will be granted and sent to this email.
              </p>
            </div>

            {errorMessage && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-sm text-xs text-rose-800 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCompleteOrder} className="space-y-6">
              <div className="p-5 sm:p-6 bg-white border border-[#DDD8CD] rounded-sm space-y-4 shadow-2xs">
                <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
                  Delivery Details
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-xs uppercase tracking-wider text-[#77766E] font-medium block">
                      Email Address (for instant file delivery) *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alexandra@example.com"
                      className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3.5 py-2.5 text-[#292B27] placeholder-[#77766E]/50 focus:outline-hidden focus:border-[#292B27]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-[#77766E] font-medium block">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Alexandra Vance"
                      className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3.5 py-2.5 text-[#292B27] placeholder-[#77766E]/50 focus:outline-hidden focus:border-[#292B27]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wider text-[#77766E] font-medium block">
                      Country / Region
                    </label>
                    <select
                      value={country}
                      onChange={(e) => {
                        const nextCountry = e.target.value;
                        setCountry(nextCountry);
                        if (nextCountry === "India") setCurrency("INR");
                        else if (nextCountry === "United States") setCurrency("USD");
                        else if (nextCountry === "United Kingdom") setCurrency("GBP");
                        else if (nextCountry === "European Union") setCurrency("EUR");
                      }}
                      className="w-full text-xs bg-[#FAF9F5] border border-[#DDD8CD] rounded-xs px-3.5 py-2.5 text-[#292B27] focus:outline-hidden focus:border-[#292B27]"
                    >
                      <option value="India">India (INR • UPI & Cards)</option>
                      <option value="United States">United States (USD)</option>
                      <option value="United Kingdom">United Kingdom (GBP)</option>
                      <option value="European Union">European Union (EUR)</option>
                      <option value="Other">Other Region</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Payment Gateway Box */}
              <div className="p-5 sm:p-6 bg-white border border-[#DDD8CD] rounded-sm space-y-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#DDD8CD] pb-2">
                  <h2 className="font-serif text-base font-medium text-[#292B27]">Payment Gateway</h2>
                </div>

                <div className="p-4 border border-[#292B27] bg-[#F5F2EB]/50 rounded-xs flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CreditCard className="w-5 h-5 text-[#292B27]" />
                    <div>
                      <div className="text-xs font-semibold text-[#292B27]">Razorpay Secure Checkout</div>
                      <div className="text-[11px] text-[#77766E]">UPI, Credit/Debit Cards, Netbanking & Wallets</div>
                    </div>
                  </div>
                  <CheckCircle2 className="w-4 h-4 text-[#657052]" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isProcessing}
                className="w-full bg-[#292B27] hover:bg-[#657052] disabled:opacity-50 text-white py-4 text-xs uppercase tracking-widest font-semibold rounded-xs transition-colors shadow-sm flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Secure Payment...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Complete Purchase • {formatPrice(total, currency)}</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Summary Column */}
          <div className="lg:col-span-5">
            <div className="p-5 sm:p-6 bg-[#FAF9F5] border border-[#DDD8CD] rounded-sm space-y-4 sticky top-6 shadow-2xs">
              <h2 className="font-serif text-base font-medium text-[#292B27] border-b border-[#DDD8CD] pb-2">
                Order Summary ({items.length} {items.length === 1 ? "item" : "items"})
              </h2>

              <div className="divide-y divide-[#DDD8CD] max-h-72 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.product.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center space-x-3 overflow-hidden">
                      <div className="w-12 h-14 bg-[#EAE5DA] rounded overflow-hidden shrink-0 border border-[#DDD8CD] relative">
                        <img
                          src={item.product.coverImage}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="truncate">
                        <div className="font-medium text-[#292B27] truncate">{item.product.name}</div>
                        <div className="text-[11px] text-[#77766E] uppercase font-mono">
                          Qty: {item.quantity} • {item.product.formatLabel || "PDF"}
                        </div>
                      </div>
                    </div>
                    <div className="font-mono font-semibold text-[#292B27] shrink-0">
                      {formatPrice(item.product.price * item.quantity, currency)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[#DDD8CD] text-xs">
                <div className="flex justify-between text-[#77766E]">
                  <span>Subtotal</span>
                  <span className="font-mono">{formatPrice(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-[#77766E]">
                  <span>Instant Delivery</span>
                  <span className="text-emerald-700 font-semibold uppercase text-[10px]">Free (Instant)</span>
                </div>
                <div className="flex justify-between text-[#292B27] font-semibold text-sm pt-2 border-t border-[#DDD8CD]">
                  <span>Total</span>
                  <span className="font-mono text-base">{formatPrice(total, currency)}</span>
                </div>
              </div>

              <div className="p-3 bg-[#EAE5DA] border border-[#DDD8CD] rounded-xs text-[11px] text-[#292B27] flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#657052] shrink-0 mt-0.5" />
                <span>Immediate delivery: Download links and PDF assets are provisioned immediately upon transaction confirmation.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
