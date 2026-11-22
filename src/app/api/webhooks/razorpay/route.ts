import { NextResponse } from "next/server";
import { verifyRazorpayWebhookSignature, capturePaymentAndFulfillOrder } from "@/services/payments/paymentCaptureService";
import { processOutboxBatch } from "@/services/workers/outboxWorker";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature");
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!signature || !secret || secret.includes("your_")) {
      return NextResponse.json({ error: "Missing or unconfigured webhook signature or server secret." }, { status: 400 });
    }

    const isValid = verifyRazorpayWebhookSignature(rawBody, signature, secret);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventId = event.event_id || request.headers.get("x-razorpay-event-id") || `evt_${Date.now()}`;
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

    // 2. Process payment.captured event
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
          .update({ status: "failed", error_details: "Order ID missing from payment notes" })
          .eq("event_id", eventId);

        return NextResponse.json({ error: "Order ID missing from payment notes." }, { status: 400 });
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
        console.warn("[Razorpay Webhook] Delivery worker trigger caught non-fatal error:", workerErr);
      }

      return NextResponse.json({
        received: true,
        alreadyProcessed: result.alreadyProcessed,
        entitlementsCreated: result.entitlementsCreated,
      });
    }

    // Mark other events as processed/ignored
    await adminClient
      .from("payment_webhook_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return NextResponse.json({ received: true, ignored: true });
  } catch (error: any) {
    console.error("[Razorpay Webhook] Exception:", error);
    return NextResponse.json(
      { error: "Webhook handling failed: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
