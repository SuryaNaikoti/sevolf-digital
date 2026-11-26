"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Download,
  ArrowRight,
  Mail,
  RefreshCw,
  Clock,
  FileText,
  AlertCircle,
  BookOpen,
} from "lucide-react";

interface OrderItemDetail {
  id: string;
  productId: string | null;
  productName: string;
  slug: string | null;
  coverImageUrl: string | null;
  formatLabel: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface EntitlementDetail {
  id: string;
  productId: string | null;
  downloadCount: number;
  downloadLimit: number;
  expiresAt: string | null;
  isRevoked: boolean;
  isActive: boolean;
  fileName: string;
  fileVersion: string | null;
  fileSizeBytes: number;
  mimeType: string;
  token: string | null;
}

interface RecommendationDetail {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  coverImageUrl: string | null;
  currency: string;
  price: number | null;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string | null;
  currency: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  emailDeliveryStatus?: "queued" | "delivered" | "failed";
  createdAt: string;
  items: OrderItemDetail[];
  entitlements: EntitlementDetail[];
  recommendations: RecommendationDetail[];
}

export default function OrderSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    fetch(`/api/orders/${encodeURIComponent(orderId)}?orderId=${encodeURIComponent(orderId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Order lookup failed (${res.status})`);
        return res.json();
      })
      .then((data) => setOrder(data.order))
      .catch((err: any) => setError(err?.message || "Failed to load order details."))
      .finally(() => setLoading(false));
  }, [orderId]);

  const isPaymentVerified =
    order &&
    ["paid", "fulfilled", "completed"].includes(order.status) &&
    ["captured", "paid"].includes(order.paymentStatus);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#22231F]">
      <div className="max-w-[920px] mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">
        {loading ? (
          <div className="bg-white border border-[#E8E5DD] rounded-sm p-12 text-center space-y-3">
            <RefreshCw className="w-7 h-7 text-[#657052] animate-spin mx-auto" />
            <p className="text-xs text-[#77766E]">Verifying payment and digital entitlements...</p>
          </div>
        ) : error || !order ? (
          <div className="bg-white border border-[#E8E5DD] rounded-sm p-8 sm:p-12 text-center space-y-4">
            <AlertCircle className="w-8 h-8 text-[#8C6D34] mx-auto" />
            <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#22231F]">
              Order not found
            </h1>
            <p className="text-sm text-[#77766E] max-w-md mx-auto">
              {error || "We could not locate this order reference. Please check your confirmation email or visit your Digital Library."}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/account/library"
                className="bg-[#22231F] hover:bg-[#657052] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors"
              >
                Open My Digital Library
              </Link>
              <Link
                href="/shop"
                className="border border-[#DDD8CD] text-[#22231F] px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs hover:bg-[#FAF8F5]"
              >
                Return to Shop
              </Link>
            </div>
          </div>
        ) : !isPaymentVerified ? (
          <div className="bg-white border border-[#E8E5DD] rounded-sm p-8 sm:p-12 text-center space-y-4">
            <Clock className="w-9 h-9 text-[#8C6D34] mx-auto" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#8C6D34] block">
              Payment {order.paymentStatus || "Pending"}
            </span>
            <h1 className="font-serif text-2xl sm:text-3xl font-normal text-[#22231F]">
              Payment verification in progress
            </h1>
            <p className="text-sm text-[#77766E] max-w-md mx-auto">
              Order <strong className="text-[#22231F]">{order.orderNumber}</strong> has not been confirmed as paid yet. Digital downloads will unlock automatically once payment is verified.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link
                href="/checkout"
                className="bg-[#22231F] hover:bg-[#657052] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors"
              >
                Return to Checkout
              </Link>
              <Link
                href="/shop"
                className="border border-[#DDD8CD] text-[#22231F] px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs hover:bg-[#FAF8F5]"
              >
                Browse Shop
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* 2. Purchase Confirmation */}
            <section className="bg-white border border-[#E8E5DD] rounded-sm p-7 sm:p-10 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E5DD] pb-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center space-x-2 text-[#657052]">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[11px] font-mono uppercase tracking-[0.18em] font-semibold">
                      Payment Verified
                    </span>
                  </div>
                  <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#22231F] tracking-tight">
                    Your purchase is complete.
                  </h1>
                  <p className="text-sm text-[#77766E] max-w-xl leading-relaxed">
                    {order.customerName ? `Thank you, ${order.customerName}. ` : "Thank you for your order. "}
                    Your digital edition{order.items.length > 1 ? "s are" : " is"} ready for immediate download below.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-[#FAF8F5] border border-[#E8E5DD] rounded-xs p-5">
                <div>
                  <span className="text-[#77766E] block text-[11px] font-mono uppercase tracking-wider">Order Reference</span>
                  <span className="font-mono text-sm font-semibold text-[#22231F] mt-1 block">{order.orderNumber}</span>
                </div>
                <div>
                  <span className="text-[#77766E] block text-[11px] font-mono uppercase tracking-wider">Purchase Date</span>
                  <span className="text-sm font-medium text-[#22231F] mt-1 block">
                    {new Date(order.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div>
                  <span className="text-[#77766E] block text-[11px] font-mono uppercase tracking-wider">Amount Paid</span>
                  <span className="font-mono text-sm font-semibold text-[#22231F] mt-1 block">
                    {order.currency} {Number(order.totalAmount).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-[#77766E]">
                <Mail className="w-4 h-4 text-[#657052] shrink-0 mt-0.5" />
                <span>
                  {order.emailDeliveryStatus === "delivered"
                    ? `Your confirmation email to ${order.customerEmail} has been accepted by our email provider.`
                    : order.emailDeliveryStatus === "failed"
                    ? "We could not send your confirmation email automatically, but your download links below are ready to use."
                    : `Your confirmation email to ${order.customerEmail} is queued for delivery.`}
                </span>
              </div>
            </section>

            {/* 3. Purchased Products & Downloads */}
            <section className="bg-white border border-[#E8E5DD] rounded-sm p-7 sm:p-10 space-y-6">
              <div className="flex items-center justify-between border-b border-[#E8E5DD] pb-3">
                <h2 className="font-serif text-xl font-normal text-[#22231F]">
                  Your Digital Downloads
                </h2>
                <span className="text-xs font-mono text-[#657052]">
                  {order.entitlements.length} {order.entitlements.length === 1 ? "file" : "files"}
                </span>
              </div>

              <div className="space-y-6">
                {order.items.map((item) => {
                  const itemEntitlements = order.entitlements.filter(
                    (e) => !e.productId || !item.productId || e.productId === item.productId
                  );
                  return (
                    <div
                      key={item.id}
                      className="border border-[#E8E5DD] rounded-xs p-5 bg-[#FAF8F5]/60 space-y-4"
                    >
                      <div className="flex items-center gap-5">
                        <div className="w-20 h-24 sm:w-24 sm:h-32 bg-[#EAE5DA] rounded-xs overflow-hidden border border-[#DDD8CD] shrink-0 flex items-center justify-center">
                          {item.coverImageUrl ? (
                            <img
                              src={item.coverImageUrl}
                              alt={item.productName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <BookOpen className="w-7 h-7 text-[#657052]" />
                          )}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <h3 className="font-serif text-xl font-normal text-[#22231F] truncate">
                            {item.productName}
                          </h3>
                          <p className="text-xs text-[#77766E]">
                            {item.formatLabel} &bull; Qty {item.quantity}
                          </p>
                        </div>
                      </div>

                      {itemEntitlements.length > 0 ? (
                        <div className="space-y-2.5 pt-2 border-t border-[#E8E5DD]">
                          {itemEntitlements.map((asset) => {
                            const isExpired = asset.expiresAt && new Date(asset.expiresAt) < new Date();
                            const isLimitReached =
                              asset.downloadLimit !== null && asset.downloadCount >= asset.downloadLimit;
                            const canDownload = asset.isActive && !asset.isRevoked && !isExpired && !isLimitReached && Boolean(asset.token);

                            return (
                              <div
                                key={asset.id}
                                className="p-3 bg-white border border-[#E8E5DD] rounded-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center space-x-2.5 min-w-0">
                                  <FileText className="w-4 h-4 text-[#657052] shrink-0" />
                                  <div className="min-w-0">
                                    <div className="font-medium text-[#22231F] truncate">{asset.fileName}</div>
                                    <div className="text-[11px] text-[#77766E]">
                                      {asset.downloadLimit - asset.downloadCount} of {asset.downloadLimit} downloads remaining &bull; Valid 30 days
                                    </div>
                                  </div>
                                </div>

                                {canDownload ? (
                                  <a
                                    href={`/api/download/${asset.token}`}
                                    className="px-4 py-2 bg-[#22231F] hover:bg-[#657052] text-white text-[11px] uppercase tracking-wider font-semibold rounded-xs transition-colors shrink-0 inline-flex items-center justify-center space-x-1.5"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                  </a>
                                ) : (
                                  <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 text-[11px] rounded-xs shrink-0">
                                    {asset.isRevoked
                                      ? "Revoked"
                                      : isLimitReached
                                      ? "Download Limit Reached"
                                      : isExpired
                                      ? "Link Expired"
                                      : "Processing"}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-[#77766E]">
                          Your digital files are being prepared. Check your email or Digital Library shortly.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 4. Digital Library */}
            <section className="bg-[#EAE5DA]/60 border border-[#DDD8CD] rounded-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="space-y-1.5">
                <h2 className="font-serif text-lg font-normal text-[#22231F]">
                  Access your downloads in My Digital Library
                </h2>
                <p className="text-xs text-[#77766E] max-w-xl leading-relaxed">
                  Your library tracks active order entitlements for {order.customerEmail}. Each download link is valid for 30 days and permits up to 10 downloads per file.
                </p>
              </div>
              <Link
                href="/account/library"
                className="w-full sm:w-auto bg-[#22231F] hover:bg-[#657052] text-white px-6 py-3 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors inline-flex items-center justify-center gap-2 shrink-0"
              >
                <span>Open My Digital Library</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </section>

            {/* 5. Recommendations */}
            {order.recommendations && order.recommendations.length > 0 && (
              <section className="space-y-5">
                <h2 className="font-serif text-2xl font-normal text-[#22231F]">
                  Something else you might love.
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {order.recommendations.map((rec) => (
                    <Link
                      key={rec.id}
                      href={`/products/${rec.slug}`}
                      className="group bg-white border border-[#E8E5DD] rounded-sm overflow-hidden hover:border-[#657052] transition-colors flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-[#EAE5DA] overflow-hidden">
                        {rec.coverImageUrl ? (
                          <img
                            src={rec.coverImageUrl}
                            alt={rec.name}
                            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <BookOpen className="w-7 h-7 text-[#657052]" />
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                        <div>
                          <h3 className="font-serif text-base font-normal text-[#22231F] group-hover:text-[#657052] transition-colors">
                            {rec.name}
                          </h3>
                          <p className="text-xs text-[#77766E] line-clamp-2 mt-1">
                            {rec.shortDescription}
                          </p>
                        </div>
                        <div className="pt-2 flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-[#22231F]">
                            {rec.price !== null ? `${rec.currency} ${rec.price.toLocaleString()}` : ""}
                          </span>
                          <span className="text-[#657052] font-medium uppercase tracking-wider text-[11px]">
                            View &rarr;
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 6. Customer Relationship */}
            <section className="border-t border-[#DDD8CD] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#77766E]">
              <p>
                Questions about your order? Reach us at{" "}
                <a href="mailto:support@sevolf.shop" className="text-[#22231F] underline hover:text-[#657052]">
                  support@sevolf.shop
                </a>
                .
              </p>
              <Link
                href="/shop"
                className="px-5 py-2.5 border border-[#DDD8CD] bg-white hover:bg-[#FAF8F5] text-[#22231F] text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors"
              >
                Continue Shopping
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
