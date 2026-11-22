"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, ExternalLink, ShieldCheck, RefreshCw, ShoppingBag } from "lucide-react";

export default function DigitalLibraryPage() {
  const [entitlements, setEntitlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    fetch("/api/account/library")
      .then((r) => r.json())
      .then((data) => {
        setAuthenticated(data.authenticated);
        setEntitlements(data.entitlements || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-normal text-[#292B27]">
          My Digital Library
        </h2>
        <p className="text-xs text-[#77766E] mt-1">
          Your licensed digital products with permanent access, signed time-limited downloads, and version updates.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center space-y-2 bg-[#F5F2EB]/50 border border-[#DDD8CD] rounded-sm">
          <RefreshCw className="w-6 h-6 text-[#657052] animate-spin mx-auto" />
          <p className="text-xs text-[#77766E]">Loading licensed digital products...</p>
        </div>
      ) : entitlements.length === 0 ? (
        <div className="p-12 text-center space-y-4 bg-white border border-[#DDD8CD] rounded-sm">
          <ShoppingBag className="w-8 h-8 text-[#8C9196] mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#292B27]">No digital assets found</h3>
            <p className="text-xs text-[#77766E] max-w-sm mx-auto">
              {authenticated
                ? "You haven't completed any digital purchases yet. When you buy a workbook or template, your files will appear here."
                : "Sign in to view your previous purchases, or check your order confirmation email for download links."}
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-block bg-[#292B27] hover:bg-[#657052] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors"
          >
            Explore Digital Catalog
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {entitlements.map((item) => {
            const asset = item.digital_assets;
            const product = asset?.products;
            const order = item.orders;
            const isUsable = item.is_active && !item.is_revoked;

            return (
              <div
                key={item.id}
                className="p-5 border border-[#DDD8CD] rounded-sm bg-[#F5F2EB]/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-20 bg-[#EAE5DA] rounded overflow-hidden shrink-0 border border-[#DDD8CD]">
                    <img
                      src={product?.cover_image_url || "/images/products/home-reset-kit/cover.jpg"}
                      alt={product?.name || asset?.file_name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-semibold text-[#657052] tracking-wider block">
                      {asset?.file_version || "Current Edition"}
                    </span>
                    <h3 className="font-serif text-lg font-medium text-[#292B27]">
                      {product?.name || asset?.file_name}
                    </h3>
                    <div className="text-xs text-[#77766E] flex items-center gap-3">
                      <span>Order: {order?.order_number || item.order_id?.slice(0, 8)}</span>
                      <span>•</span>
                      <span>Downloads: {item.download_count} / {item.download_limit}</span>
                    </div>
                  </div>
                </div>

                <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  {isUsable && item.token ? (
                    <a
                      href={`/api/download/${item.token}`}
                      className="bg-[#292B27] hover:bg-[#657052] text-white px-5 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors flex items-center justify-center gap-2 text-center"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download File</span>
                    </a>
                  ) : (
                    <span className="px-4 py-2 bg-amber-50 text-amber-800 border border-amber-200 text-xs rounded-xs">
                      {item.is_revoked ? "Entitlement Revoked" : "Link Expired (Check Email)"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="p-4 bg-[#EAE5DA] border border-[#DDD8CD] rounded-sm text-xs text-[#292B27] flex items-start gap-3">
        <ShieldCheck className="w-4 h-4 text-[#657052] flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold block">Asset Security & Preservation</span>
          <span className="text-[#77766E]">
            All download links are cryptographically signed on the server with short-lived expiration tokens to safeguard your unique license entitlements.
          </span>
        </div>
      </div>
    </div>
  );
}
