import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptTokenPayload } from "@/services/security/tokenEncryption";
import { rankRecommendedProducts, PaidOrderItemSale } from "@/services/email/purchaseEmailService";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient();

    // Query order by id or order_number
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let query = adminClient
      .from("orders")
      .select(`
        id,
        order_number,
        customer_email,
        customer_name,
        currency,
        total_amount,
        status,
        payment_status,
        created_at,
        order_items (
          id,
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price,
          products (
            id,
            name,
            slug,
            cover_image_url,
            format_label
          )
        ),
        download_entitlements (
          id,
          token,
          token_hash,
          download_count,
          download_limit,
          expires_at,
          is_active,
          is_revoked,
          digital_assets (
            id,
            product_id,
            file_name,
            file_version,
            mime_type,
            file_size_bytes
          )
        )
      `);

    if (isUUID) {
      query = query.eq("id", orderId);
    } else {
      query = query.eq("order_number", orderId);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Resolve encrypted outbox tokens for instant confirmation downloads
    const entitlements = order.download_entitlements || [];
    const entitlementIds = entitlements.map((e: any) => e.id);
    const tokenMap = new Map<string, string>();
    let emailDeliveryStatus: "queued" | "delivered" | "failed" = "queued";

    if (entitlementIds.length > 0) {
      const { data: outboxRows } = await adminClient
        .from("order_delivery_outbox")
        .select("entitlement_id, encrypted_token_payload, delivery_status")
        .in("entitlement_id", entitlementIds);

      if (outboxRows && outboxRows.length > 0) {
        const allDelivered = outboxRows.every((r: any) => r.delivery_status === "delivered");
        const anyFailed = outboxRows.some((r: any) => r.delivery_status === "failed");
        if (allDelivered) {
          emailDeliveryStatus = "delivered";
        } else if (anyFailed) {
          emailDeliveryStatus = "failed";
        }

        for (const row of outboxRows) {
          if (row.encrypted_token_payload) {
            try {
              const raw = decryptTokenPayload(row.encrypted_token_payload);
              tokenMap.set(row.entitlement_id, raw);
            } catch (decErr) {
              console.error("[Orders API] Decryption error for entitlement:", row.entitlement_id, decErr);
            }
          }
        }
      }
    }

    // Dynamic recommendations: published only, exclude purchased, featured -> verified bestsellers
    const purchasedIds = new Set<string>((order.order_items || []).map((i: any) => i.product_id).filter(Boolean));
    const { data: pubProducts } = await adminClient
      .from("products")
      .select("id, name, slug, short_description, cover_image_url, is_featured, product_prices(currency, amount, is_default)")
      .eq("status", "published");

    const eligible = (pubProducts || []).filter((p: any) => !purchasedIds.has(p.id));
    let recommendations: any[] = [];
    if (eligible.length > 0) {
      const { data: paidSales } = await adminClient
        .from("order_items")
        .select("product_id, quantity, orders!inner(status, payment_status, is_sandbox)")
        .in("orders.status", ["paid", "fulfilled", "completed"])
        .in("orders.payment_status", ["captured", "paid"])
        .eq("orders.is_sandbox", false);

      const ranked = rankRecommendedProducts(eligible, (paidSales || []) as PaidOrderItemSale[]);
      recommendations = ranked.map((p: any) => {
        const prices = p.product_prices || [];
        const matched =
          prices.find((pr: any) => pr.currency === (order.currency || "INR")) ||
          prices.find((pr: any) => pr.is_default) ||
          prices[0];
        return {
          id: p.id,
          name: p.name,
          slug: p.slug,
          shortDescription: p.short_description || "",
          coverImageUrl: p.cover_image_url || null,
          currency: matched?.currency || order.currency || "INR",
          price: matched ? Number(matched.amount) : null,
        };
      });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        currency: order.currency,
        totalAmount: order.total_amount,
        status: order.status,
        paymentStatus: order.payment_status,
        emailDeliveryStatus,
        createdAt: order.created_at,
        items: (order.order_items || []).map((i: any) => {
          const prod = Array.isArray(i.products) ? i.products[0] : i.products;
          return {
            id: i.id,
            productId: i.product_id,
            productName: prod?.name || i.product_name,
            slug: prod?.slug || null,
            coverImageUrl: prod?.cover_image_url || null,
            formatLabel: prod?.format_label || "Digital Edition",
            quantity: i.quantity,
            unitPrice: i.unit_price,
            totalPrice: i.total_price,
          };
        }),
        entitlements: entitlements.map((e: any) => ({
          id: e.id,
          productId: e.digital_assets?.product_id || null,
          downloadCount: e.download_count,
          downloadLimit: e.download_limit,
          expiresAt: e.expires_at,
          isRevoked: e.is_revoked,
          isActive: e.is_active && !e.is_revoked,
          fileName: e.digital_assets?.file_name || "Digital Product Asset",
          fileVersion: e.digital_assets?.file_version || null,
          fileSizeBytes: e.digital_assets?.file_size_bytes || 0,
          mimeType: e.digital_assets?.mime_type || "application/octet-stream",
          token: e.token || tokenMap.get(e.id) || null,
        })),
        recommendations,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error fetching order status." },
      { status: 500 }
    );
  }
}
