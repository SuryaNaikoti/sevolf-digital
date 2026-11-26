import { SupabaseClient } from "@supabase/supabase-js";
import {
  PurchaseEmailData,
  PurchasedItemDisplay,
  RecommendedProductDisplay,
} from "./purchaseEmailTemplate";

const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024; // 15 MB safe limit for Resend
const SUPPORTED_ATTACHMENT_MIMES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/epub+zip",
]);

export interface EmailAttachment {
  filename: string;
  content: string; // base64
}

export interface PaidOrderItemSale {
  product_id: string;
  quantity: number;
  orders?: {
    status?: string;
    payment_status?: string;
    is_sandbox?: boolean;
  } | null;
}

const PAID_ORDER_STATUSES = new Set(["paid", "fulfilled", "completed"]);
const PAID_PAYMENT_STATUSES = new Set(["captured", "paid"]);

/**
 * Pure recommendation ranker:
 * 1. Featured published products
 * 2. Bestselling published products by verified paid order quantities
 * 3. Remaining eligible published products
 * Deduplicates by product id and caps at 3.
 */
export function rankRecommendedProducts(
  eligibleProducts: any[],
  orderItemSales: PaidOrderItemSale[]
): any[] {
  const salesByProduct = new Map<string, number>();

  for (const row of orderItemSales) {
    if (!row.product_id || !row.orders) continue;
    const ord = Array.isArray(row.orders) ? row.orders[0] : row.orders;
    if (!ord) continue;
    if (ord.is_sandbox === true) continue;
    if (!PAID_ORDER_STATUSES.has(ord.status || "")) continue;
    if (!PAID_PAYMENT_STATUSES.has(ord.payment_status || "")) continue;

    const qty = Number(row.quantity || 0);
    if (qty > 0) {
      salesByProduct.set(row.product_id, (salesByProduct.get(row.product_id) || 0) + qty);
    }
  }

  const seen = new Set<string>();
  const uniqueEligible = eligibleProducts.filter((p) => {
    if (!p?.id || seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  uniqueEligible.sort((a, b) => {
    const featDiff = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
    if (featDiff !== 0) return featDiff;
    const salesA = salesByProduct.get(a.id) || 0;
    const salesB = salesByProduct.get(b.id) || 0;
    return salesB - salesA;
  });

  return uniqueEligible.slice(0, 3);
}

export async function buildPurchaseEmailPayload(
  supabase: SupabaseClient,
  orderId: string,
  entitlementId: string | null,
  rawToken: string,
  siteUrl: string
): Promise<{ data: PurchaseEmailData; attachments: EmailAttachment[] }> {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@sevolf.shop";

  // 1. Fetch order & items
  const { data: order } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_number,
      customer_name,
      customer_email,
      total_amount,
      currency,
      created_at,
      order_items (
        product_id,
        product_name,
        products (
          id,
          name,
          slug,
          cover_image_url,
          format_label
        )
      )
    `
    )
    .eq("id", orderId)
    .single();

  const orderNumber = order?.order_number || orderId.slice(0, 8);
  const currency = order?.currency || "INR";
  const amountFormatted = `${currency} ${Number(order?.total_amount || 0).toLocaleString()}`;
  const purchaseDate = order?.created_at
    ? new Date(order.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN");

  // 2. Fetch entitlement + digital asset for attachment
  const attachments: EmailAttachment[] = [];
  let oversizedFallback = false;
  let assetMeta: { file_name: string; storage_path: string; mime_type: string; file_size_bytes: number } | null = null;

  if (entitlementId) {
    const { data: ent } = await supabase
      .from("download_entitlements")
      .select(
        `
        id,
        digital_assets (
          file_name,
          storage_path,
          mime_type,
          file_size_bytes
        )
      `
      )
      .eq("id", entitlementId)
      .single();

    const asset: any = Array.isArray(ent?.digital_assets) ? ent?.digital_assets[0] : ent?.digital_assets;
    if (asset && asset.storage_path) {
      assetMeta = asset;
      const isSupported = SUPPORTED_ATTACHMENT_MIMES.has(asset.mime_type || "");
      const isWithinLimit = (asset.file_size_bytes || 0) > 0 && asset.file_size_bytes <= MAX_ATTACHMENT_BYTES;

      if (isSupported && isWithinLimit) {
        try {
          const { data: fileBlob, error: dlErr } = await supabase.storage
            .from("digital-products")
            .download(asset.storage_path);

          if (!dlErr && fileBlob) {
            const buf = Buffer.from(await fileBlob.arrayBuffer());
            if (buf.length <= MAX_ATTACHMENT_BYTES) {
              attachments.push({
                filename: asset.file_name || "SEVOLF-Digital-Product.pdf",
                content: buf.toString("base64"),
              });
            } else {
              oversizedFallback = true;
            }
          } else {
            console.warn("[PurchaseEmail] Attachment download skipped:", dlErr?.message);
          }
        } catch (attErr: any) {
          console.warn("[PurchaseEmail] Attachment error (falling back to link):", attErr?.message);
        }
      } else if ((asset.file_size_bytes || 0) > MAX_ATTACHMENT_BYTES) {
        oversizedFallback = true;
      }
    }
  }

  const downloadUrl = `${siteUrl}/api/download/${rawToken}`;
  const orderItems = (order?.order_items || []) as any[];
  const purchasedProductIds = new Set<string>(orderItems.map((i) => i.product_id).filter(Boolean));

  const items: PurchasedItemDisplay[] =
    orderItems.length > 0
      ? orderItems.map((i) => {
          const prod = Array.isArray(i.products) ? i.products[0] : i.products;
          const cover = prod?.cover_image_url
            ? prod.cover_image_url.startsWith("http")
              ? prod.cover_image_url
              : `${siteUrl}${prod.cover_image_url}`
            : null;
          return {
            name: prod?.name || i.product_name || "SEVOLF Digital Product",
            formatLabel: prod?.format_label || "Digital Edition",
            coverImageUrl: cover,
            downloadUrl,
            fileName: assetMeta?.file_name,
            attached: attachments.length > 0,
          };
        })
      : [
          {
            name: "SEVOLF Digital Product",
            formatLabel: "Digital Edition",
            downloadUrl,
            fileName: assetMeta?.file_name,
            attached: attachments.length > 0,
          },
        ];

  // 3. Dynamic Recommendations (published only, exclude purchased, prioritize featured -> real bestsellers)
  const { data: pubProducts } = await supabase
    .from("products")
    .select(
      `
      id,
      name,
      slug,
      short_description,
      cover_image_url,
      is_featured,
      product_prices (
        currency,
        amount,
        is_default
      )
    `
    )
    .eq("status", "published");

  const eligible = (pubProducts || []).filter((p: any) => !purchasedProductIds.has(p.id));
  let recommendations: RecommendedProductDisplay[] = [];

  if (eligible.length > 0) {
    const { data: paidSales } = await supabase
      .from("order_items")
      .select("product_id, quantity, orders!inner(status, payment_status, is_sandbox)")
      .in("orders.status", ["paid", "fulfilled", "completed"])
      .in("orders.payment_status", ["captured", "paid"])
      .eq("orders.is_sandbox", false);

    const ranked = rankRecommendedProducts(eligible, (paidSales || []) as PaidOrderItemSale[]);
    recommendations = ranked.map((p: any) => {
      const prices = p.product_prices || [];
      const matchedPrice =
        prices.find((pr: any) => pr.currency === currency) ||
        prices.find((pr: any) => pr.is_default) ||
        prices[0];
      const priceStr = matchedPrice ? `${matchedPrice.currency} ${Number(matchedPrice.amount).toLocaleString()}` : "";
      const cover = p.cover_image_url
        ? p.cover_image_url.startsWith("http")
          ? p.cover_image_url
          : `${siteUrl}${p.cover_image_url}`
        : null;

      return {
        name: p.name,
        shortDescription: p.short_description || "",
        coverImageUrl: cover,
        priceFormatted: priceStr,
        productUrl: `${siteUrl}/products/${p.slug}`,
      };
    });
  }

  return {
    data: {
      orderNumber,
      purchaseDate,
      amountFormatted,
      customerName: order?.customer_name || null,
      siteUrl,
      supportEmail,
      items,
      recommendations,
      hasAttachments: attachments.length > 0,
      oversizedFallback,
    },
    attachments,
  };
}
