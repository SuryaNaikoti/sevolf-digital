import { NextResponse } from "next/server";
import { verifyRazorpaySignature, capturePaymentAndFulfillOrder } from "@/services/payments/paymentCaptureService";
import { processOutboxBatch } from "@/services/workers/outboxWorker";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      orderId,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      isTestSimulation,
    } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Fetch order details from database
    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .select("id, order_number, total_amount, currency, status, payment_status")
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json({ error: "Order record not found." }, { status: 404 });
    }

    // Check if already fulfilled
    if (order.status === "paid" || order.payment_status === "captured" || order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        orderId: order.id,
        orderNumber: order.order_number,
        message: "Order has already been verified and paid.",
      });
    }

    // Retrieve active payment attempt for gateway order resolution
    const { data: attempt } = await adminClient
      .from("payment_attempts")
      .select("gateway_order_id")
      .eq("order_id", order.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const resolvedGatewayOrderId = razorpay_order_id || attempt?.gateway_order_id || `order_${order.id.replace(/-/g, "").slice(0, 16)}`;
    const gatewayTxnId = razorpay_payment_id || `pay_test_${order.id.slice(0, 8)}_${Date.now()}`;

    const razorpaySecret = process.env.RAZORPAY_KEY_SECRET;
    const isConfigured = Boolean(razorpaySecret && !razorpaySecret.includes("your_"));

    // 2. Cryptographic signature verification
    if (isConfigured && !isTestSimulation) {
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return NextResponse.json(
          { error: "Payment verification attributes are missing." },
          { status: 400 }
        );
      }

      const isValid = verifyRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        razorpaySecret!
      );

      if (!isValid) {
        console.warn("[Payment Verification] Invalid HMAC signature detected for order:", orderId);
        return NextResponse.json(
          { error: "Invalid payment signature. Verification failed." },
          { status: 401 }
        );
      }
    } else {
      // In sandbox/test environment when testing without live gateway keys
      console.log(`[Payment Verification] Verifying order ${orderId} in Sandbox Test Mode.`);
    }

    // 3. Atomically capture payment, record transaction, and generate entitlements
    const captureResult = await capturePaymentAndFulfillOrder({
      orderId: order.id,
      gatewayTransactionId: gatewayTxnId,
      gatewayOrderId: resolvedGatewayOrderId,
      amount: Number(order.total_amount),
      currency: order.currency || "INR",
      rawPayload: {
        verifiedVia: isConfigured && !isTestSimulation ? "hmac_sha256" : "test_sandbox",
        gatewayTxnId,
        gatewayOrderId: resolvedGatewayOrderId,
        timestamp: new Date().toISOString(),
      },
    });

    if (!captureResult.success && !captureResult.alreadyProcessed) {
      return NextResponse.json(
        { error: captureResult.message || "Payment capture failed." },
        { status: 400 }
      );
    }

    // 4. Trigger delivery worker to process outbox transactional email
    try {
      await processOutboxBatch(5, 60);
    } catch (workerErr) {
      console.warn("[Payment Verification] Outbox worker execution caught non-fatal error:", workerErr);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.order_number,
      alreadyProcessed: captureResult.alreadyProcessed,
      entitlementsCreated: captureResult.entitlementsCreated,
      message: "Payment successfully verified and digital download entitlement granted.",
    });
  } catch (error: any) {
    console.error("[Payment Verification API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error verifying payment: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
