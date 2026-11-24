import { NextResponse } from "next/server";
import {
  verifyRazorpayWebhookSignature,
  capturePaymentAndFulfillOrder,
} from "@/services/payments/paymentCaptureService";
import { processRefund } from "@/services/payments/refundService";
import { processOutboxBatch } from "@/services/workers/outboxWorker";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret || secret.includes("your_")) {
      return NextResponse.json(
        { error: "Missing or unconfigured webhook signature or server secret." },
        { status: 400 }
      );
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature, secret);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventId =
      event.event_id ||
      request.headers.get("x-razorpay-event-id") ||
      `evt_${Date.now()}`;
    const adminClient = createAdminClient();

    // 1. Webhook Idempotency Check via public.payment_webhook_events
    const { data: existingEvent } = await adminClient
      .from("payment_webhook_events")
      .select("id, status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.status === "processed") {
      return NextResponse.json({
        received: true,
        alreadyProcessed: true,
        message: "Duplicate webhook event ignored idempotently.",
      });
    }

    // Record webhook event receipt
    await adminClient.from("payment_webhook_events").upsert(
      {
        gateway: "razorpay",
        event_id: eventId,
        event_type: event.event || "unknown",
        status: "processing",
        raw_payload: event,
        received_at: new Date().toISOString(),
      },
      { onConflict: "event_id" }
    );

    // -------------------------------------------------------------------------
    // Event 1: payment.captured (Successful payment & digital entitlement grant)
    // -------------------------------------------------------------------------
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.notes?.order_id || payment.notes?.orderId;
      const gatewayOrderId = payment.order_id;
      const gatewayTransactionId = payment.id;
      const amount = payment.amount / 100; // Razorpay amounts are in paise
      const currency = payment.currency;

      if (!orderId) {
        await adminClient
          .from("payment_webhook_events")
          .update({
            status: "failed",
            error_details: "Order ID missing from payment notes",
          })
          .eq("event_id", eventId);

        return NextResponse.json(
          { error: "Order ID missing from payment notes." },
          { status: 400 }
        );
      }

      const result = await capturePaymentAndFulfillOrder({
        orderId,
        gatewayTransactionId,
        gatewayOrderId,
        amount,
        currency,
        rawPayload: payment,
      });

      if (!result.success && !result.alreadyProcessed) {
        await adminClient
          .from("payment_webhook_events")
          .update({ status: "failed", error_details: result.message })
          .eq("event_id", eventId);

        return NextResponse.json({ error: result.message }, { status: 400 });
      }

      // Mark webhook as processed
      await adminClient
        .from("payment_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("event_id", eventId);

      // Trigger delivery outbox worker
      try {
        await processOutboxBatch(5, 60);
      } catch (workerErr) {
        console.warn(
          "[Razorpay Webhook] Delivery worker trigger caught non-fatal error:",
          workerErr
        );
      }

      return NextResponse.json({
        received: true,
        alreadyProcessed: result.alreadyProcessed,
        entitlementsCreated: result.entitlementsCreated,
      });
    }

    // -------------------------------------------------------------------------
    // Event 2: payment.failed (Failed payment recording & order status update)
    // -------------------------------------------------------------------------
    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      const orderId = payment.notes?.order_id || payment.notes?.orderId;
      const gatewayOrderId = payment.order_id;
      const gatewayTransactionId = payment.id;
      const failureReason =
        payment.error_description ||
        payment.error_reason ||
        "Payment authorization failed at bank/gateway";

      if (orderId) {
        // Record failed attempt in payment_attempts
        await adminClient
          .from("payment_attempts")
          .update({
            status: "failed",
            error_message: failureReason,
            updated_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .eq("gateway_order_id", gatewayOrderId);

        // Update order status if still pending
        const { data: currentOrder } = await adminClient
          .from("orders")
          .select("id, status, payment_status")
          .eq("id", orderId)
          .maybeSingle();

        if (currentOrder && currentOrder.payment_status === "unpaid") {
          await adminClient
            .from("orders")
            .update({
              status: "failed",
              payment_status: "failed",
              metadata: {
                last_failure_reason: failureReason,
                gateway_transaction_id: gatewayTransactionId,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", orderId);
        }
      }

      await adminClient
        .from("payment_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString() })
        .eq("event_id", eventId);

      return NextResponse.json({
        received: true,
        event: "payment.failed",
        orderId: orderId || null,
        message: "Payment failure recorded cleanly.",
      });
    }

    // -------------------------------------------------------------------------
    // Event 3: refund.processed / payment.refunded (Entitlement revocation & refund ledger)
    // -------------------------------------------------------------------------
    if (event.event === "refund.processed" || event.event === "payment.refunded") {
      const refundEntity =
        event.payload.refund?.entity || event.payload.payment?.entity;
      const paymentId = refundEntity.payment_id || refundEntity.id;
      const gatewayRefundId = refundEntity.id || `rfnd_${Date.now()}`;
      const refundAmount = refundEntity.amount
        ? refundEntity.amount / 100
        : refundEntity.amount_refunded
        ? refundEntity.amount_refunded / 100
        : 0;
      const refundCurrency = refundEntity.currency || "INR";

      // Locate original internal payment record to resolve order_id
      const { data: paymentRecord } = await adminClient
        .from("payments")
        .select("id, order_id")
        .eq("gateway_transaction_id", paymentId)
        .maybeSingle();

      if (paymentRecord && paymentRecord.order_id) {
        const refundResult = await processRefund({
          orderId: paymentRecord.order_id,
          paymentId: paymentRecord.id,
          gatewayRefundId: gatewayRefundId,
          amount: refundAmount,
          currency: refundCurrency,
          reason:
            refundEntity.notes?.reason ||
            "Razorpay dashboard refund event",
          rawPayload: refundEntity,
        });

        await adminClient
          .from("payment_webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
          })
          .eq("event_id", eventId);

        return NextResponse.json({
          received: true,
          event: event.event,
          orderId: paymentRecord.order_id,
          entitlementsRevoked: refundResult.entitlementsRevoked,
          orderStatus: refundResult.orderStatus,
        });
      } else {
        // Payment record not found or already handled
        await adminClient
          .from("payment_webhook_events")
          .update({
            status: "processed",
            processed_at: new Date().toISOString(),
            error_details: "Associated internal payment record not found.",
          })
          .eq("event_id", eventId);

        return NextResponse.json({
          received: true,
          event: event.event,
          message: "Refund acknowledged; internal payment record was absent.",
        });
      }
    }

    // -------------------------------------------------------------------------
    // Other events: Acknowledge and mark processed/ignored
    // -------------------------------------------------------------------------
    await adminClient
      .from("payment_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return NextResponse.json({ received: true, ignored: true });
  } catch (error: any) {
    console.error("[Razorpay Webhook] Exception:", error);
    return NextResponse.json(
      {
        error:
          "Webhook handling failed: " + (error?.message || "Unknown error"),
      },
      { status: 500 }
    );
  }
}
