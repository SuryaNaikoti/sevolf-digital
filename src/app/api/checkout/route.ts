import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveRazorpayEnvironment } from "@/lib/commerce/transactionClassifier";
import { PRODUCTS } from "@/services/products/mockData";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customer, items, currency = "INR" } = body;

    if (!customer?.email || !items || items.length === 0) {
      return NextResponse.json(
        { error: "Valid customer email and items are required." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const targetCurrency = currency || "INR";
    let computedTotal = 0;
    const validatedOrderItems: {
      productId: string;
      productName: string;
      unitPrice: number;
      quantity: number;
      totalPrice: number;
    }[] = [];

    // 1. Validate items and resolve authoritative prices
    for (const item of items) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.productId);
      let query = adminClient
        .from("products")
        .select(`
          id,
          name,
          slug,
          status,
          product_prices (currency, amount, is_default)
        `);

      if (isUUID) {
        query = query.eq("id", item.productId);
      } else {
        query = query.eq("slug", item.productId);
      }

      const { data: dbProd } = await query.maybeSingle();

      let resolvedPrice = 0;
      let resolvedName = "";
      let resolvedId = "";

      if (dbProd) {
        resolvedId = dbProd.id;
        resolvedName = dbProd.name;
        const priceRec =
          dbProd.product_prices?.find((p: any) => p.currency === targetCurrency) ||
          dbProd.product_prices?.find((p: any) => p.is_default);

        if (priceRec && Number(priceRec.amount) > 0) {
          resolvedPrice = Number(priceRec.amount);
        } else {
          // Pre-launch staging fallback for mock catalogue items with 0 product_prices rows
          const match = PRODUCTS.find((p) => p.id === resolvedId || p.slug === dbProd.slug);
          resolvedPrice = match?.price || 499;
        }
      } else {
        // Mock data fallback if ID belongs to mock catalogue
        const match = PRODUCTS.find((p) => p.id === item.productId || p.slug === item.productId);
        if (!match) {
          return NextResponse.json(
            { error: `Product item ${item.productId} was not found.` },
            { status: 400 }
          );
        }
        // Match with database products by slug if possible
        const { data: matchedDb } = await adminClient
          .from("products")
          .select("id, name")
          .eq("slug", match.slug)
          .maybeSingle();

        resolvedId = matchedDb?.id || match.id;
        resolvedName = match.name;
        resolvedPrice = match.price;
      }

      const qty = item.quantity || 1;
      const itemTotal = resolvedPrice * qty;
      computedTotal += itemTotal;

      validatedOrderItems.push({
        productId: resolvedId,
        productName: resolvedName,
        unitPrice: resolvedPrice,
        quantity: qty,
        totalPrice: itemTotal,
      });
    }

    // 2. Generate clean, human-readable order number
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    // 3. Create real order record in public.orders
    // In production store operations, normal catalog products use standard order processing.
    // Sandbox mode is reserved exclusively for the Phase 1C canonical sandbox test fixture (UUID 22222222-2222-2222-2222-222222222222).
    const isSandbox = items.length === 1 && items[0].productId === "22222222-2222-2222-2222-222222222222";
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    const serverEnvironment = isSandbox ? "test" : resolveRazorpayEnvironment(razorpayKeyId);

    const { data: newOrder, error: orderError } = await adminClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        customer_email: customer.email.trim().toLowerCase(),
        customer_name: customer.fullName || "Customer",
        currency: targetCurrency,
        subtotal: computedTotal,
        discount: 0,
        total_amount: computedTotal,
        status: "pending",
        payment_method: "razorpay",
        payment_status: "unpaid",
        is_sandbox: isSandbox,
        environment: serverEnvironment,
        metadata: {
          country: customer.country || "India",
          source: "web_checkout",
        },
      })
      .select("id, order_number, total_amount, currency")
      .single();

    if (orderError || !newOrder) {
      console.error("[Checkout API] Order Creation Error:", orderError);
      return NextResponse.json(
        { error: "Failed to initialize order record in database." },
        { status: 500 }
      );
    }

    // 4. Insert order items in public.order_items
    const orderItemsRows = validatedOrderItems.map((vi) => ({
      order_id: newOrder.id,
      product_id: vi.productId,
      product_name: vi.productName,
      unit_price: vi.unitPrice,
      quantity: vi.quantity,
      total_price: vi.totalPrice,
    }));

    const { error: itemsInsertError } = await adminClient
      .from("order_items")
      .insert(orderItemsRows);

    if (itemsInsertError) {
      console.error("[Checkout API] Order Items Insert Error:", itemsInsertError);
    }

    // 5. Create Razorpay Payment Order (Live gateway or Sandbox Test Mode)
    let gatewayOrderId = `order_${newOrder.id.replace(/-/g, "").slice(0, 16)}`;
    let isTestMode = serverEnvironment === "test";

    if (razorpayKeyId && razorpaySecret && !razorpayKeyId.includes("your_key")) {
      try {
        const authHeader = "Basic " + Buffer.from(`${razorpayKeyId}:${razorpaySecret}`).toString("base64");
        const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: Math.round(computedTotal * 100), // In paise
            currency: targetCurrency,
            receipt: newOrder.order_number,
            notes: {
              order_id: newOrder.id,
              order_number: newOrder.order_number,
              customer_email: customer.email,
            },
          }),
        });

        if (rzpRes.ok) {
          const rzpData = await rzpRes.json();
          gatewayOrderId = rzpData.id;
          isTestMode = razorpayKeyId.startsWith("rzp_test");
        } else {
          console.warn("[Checkout API] Razorpay Orders API returned non-200. Falling back to test intent:", await rzpRes.text());
        }
      } catch (gatewayErr) {
        console.warn("[Checkout API] Gateway order creation exception:", gatewayErr);
      }
    }

    // 6. Record pre-checkout intent in public.payment_attempts ledger
    await adminClient.from("payment_attempts").insert({
      order_id: newOrder.id,
      gateway: "razorpay",
      gateway_order_id: gatewayOrderId,
      amount: computedTotal,
      currency: targetCurrency,
      status: "created",
      environment: serverEnvironment,
    });

    return NextResponse.json({
      success: true,
      orderId: newOrder.id,
      orderNumber: newOrder.order_number,
      amount: computedTotal,
      currency: targetCurrency,
      gatewayOrderId,
      keyId: razorpayKeyId && !razorpayKeyId.includes("your_key") ? razorpayKeyId : "rzp_test_placeholder",
      isTestMode,
    });
  } catch (error: any) {
    console.error("[Checkout API] Unexpected Error:", error);
    return NextResponse.json(
      { error: "Failed to initialize checkout session: " + (error?.message || "Internal error") },
      { status: 500 }
    );
  }
}
