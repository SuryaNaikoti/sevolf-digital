"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Download,
  ArrowRight,
  ShieldCheck,
  Mail,
  RefreshCw,
  AlertCircle,
  Clock,
  FileText,
} from "lucide-react";

interface OrderDetail {
  id: string;
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  currency: string;
  totalAmount: number;
  status: string;
  paymentStatus: string;
  items: any[];
  entitlements: {
    id: string;
    downloadCount: number;
    downloadLimit: number;
    isActive: boolean;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    token: string | null;
  }[];
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

    const fetchOrder = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}?orderId=${encodeURIComponent(orderId)}`);
        if (!res.ok) {
          throw new Error(`Order lookup failed with status: ${res.status}`);
        }
        const data = await res.json();
        setOrder(data.order);
      } catch (err: any) {
        setError(err.message || "Failed to load order confirmation details.");
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [orderId]);

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-16 md:py-24">
      <div className="max-w-2xl mx-auto bg-white border border-[#DDD8CD] rounded-sm p-8 md:p-12 text-center shadow-xs">
        {loading ? (
          <div className="py-12 space-y-3">
            <RefreshCw className="w-8 h-8 text-[#657052] animate-spin mx-auto" />
            <p className="text-xs text-[#77766E]">Verifying digital entitlements and order confirmation...</p>
          </div>
        ) : error || !order ? (
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 bg-[#F5F2EB] rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#657052]" />
            </div>
            <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block">
              ORDER INITIATED
            </span>
            <h1 className="font-serif text-3xl font-normal text-[#292B27]">
              Thank you for your order.
            </h1>
            <p className="text-sm text-[#77766E] max-w-md mx-auto">
              Order Reference: <strong className="text-[#292B27]">{orderId || "ORD-PENDING"}</strong>. Your payment confirmation and digital download links are being processed.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <Link
                href="/shop"
                className="bg-[#292B27] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs"
              >
                Return to Shop
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-[#EAE5DA] rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8 text-[#657052]" />
            </div>

            <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
              PAYMENT VERIFIED & CONFIRMED
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#292B27] mb-3">
              Thank you for your order.
            </h1>
            <p className="text-sm text-[#77766E] max-w-md mx-auto mb-6">
              Order reference: <strong className="text-[#292B27]">{order.orderNumber}</strong>. A receipt and secured download access has been granted to <strong className="text-[#292B27]">{order.customerEmail}</strong>.
            </p>

            {/* Purchased Items & Download Entitlements */}
            <div className="p-6 bg-[#F5F2EB] border border-[#DDD8CD] rounded-xs text-left mb-8 space-y-4">
              <div className="flex items-center justify-between border-b border-[#DDD8CD] pb-2">
                <h2 className="font-serif text-lg font-medium text-[#292B27]">Digital Asset Access</h2>
                <span className="text-xs font-mono text-[#657052] font-semibold">
                  {order.entitlements.length} files available
                </span>
              </div>

              {order.entitlements.length > 0 ? (
                <div className="space-y-3">
                  {order.entitlements.map((asset) => (
                    <div
                      key={asset.id}
                      className="p-3 bg-white border border-[#DDD8CD] rounded-xs flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center space-x-2.5 overflow-hidden">
                        <FileText className="w-4 h-4 text-[#657052] shrink-0" />
                        <div>
                          <div className="font-semibold text-[#292B27] truncate">{asset.fileName}</div>
                          <div className="text-[11px] text-[#77766E]">
                            Limit: {asset.downloadCount} / {asset.downloadLimit} downloads
                          </div>
                        </div>
                      </div>

                      {asset.token ? (
                        <a
                          href={`/api/download/${asset.token}`}
                          className="px-3.5 py-1.5 bg-[#292B27] hover:bg-[#657052] text-white text-[11px] uppercase tracking-wider font-semibold rounded-xs transition-colors shrink-0 flex items-center space-x-1"
                        >
                          <Download className="w-3 h-3" />
                          <span>Download</span>
                        </a>
                      ) : (
                        <Link
                          href="/account/library"
                          className="px-3 py-1.5 bg-[#EAE5DA] text-[#292B27] text-[11px] uppercase tracking-wider font-medium rounded-xs hover:bg-[#DDD8CD] transition-colors shrink-0"
                        >
                          Access in Library
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-[#77766E] space-y-2">
                  <div className="flex items-start gap-2">
                    <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Digital delivery outbox has scheduled your asset tokens. They will arrive in your email shortly.</span>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3 text-xs text-[#292B27] pt-2 border-t border-[#DDD8CD]">
                <Mail className="w-4 h-4 text-[#657052] flex-shrink-0 mt-0.5" />
                <span>An automated confirmation email has been scheduled. Your direct download links remain valid for 30 days and permit up to 10 downloads.</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/account/library"
                className="w-full sm:w-auto bg-[#292B27] hover:bg-[#657052] text-white px-8 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-sm flex items-center justify-center gap-2"
              >
                <span>Open Digital Library</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/shop"
                className="w-full sm:w-auto bg-transparent hover:bg-[#F5F2EB] text-[#292B27] border border-[#DDD8CD] px-8 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-sm"
              >
                Continue Browsing
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
