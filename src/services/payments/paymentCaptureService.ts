import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateBearerToken, hashToken, encryptTokenPayload } from "@/services/security/tokenEncryption";

export interface DeliveryPayloadInput {
  asset_id: string;
  token_hash: string;
  encrypted_payload: string;
}

export interface CaptureOrderInput {
  orderId: string;
  gatewayTransactionId: string;
  gatewayOrderId: string;
  amount: number;
  currency: string;
  rawPayload: Record<string, unknown>;
}

export interface CaptureOrderResult {
  success: boolean;
  alreadyProcessed: boolean;
  entitlementsCreated: number;
  totalEntitlements: number;
  message: string;
}

/**
 * Validates a Razorpay payment signature HMAC SHA-256.
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): boolean {
  if (!orderId || !paymentId || !signature || !secret) {
    return false;
  }
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signature, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Validates a Razorpay webhook signature header.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string
): boolean {
  if (!rawBody || !signatureHeader || !secret) {
    return false;
  }
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    const sigBuf = Buffer.from(signatureHeader, "hex");
    const expBuf = Buffer.from(expectedSignature, "hex");
    if (sigBuf.length !== expBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch {
    return false;
  }
}

/**
 * Executes atomic payment capture, entitlement generation and encrypted delivery outbox insertion.
 */
export async function capturePaymentAndFulfillOrder(
  input: CaptureOrderInput
): Promise<CaptureOrderResult> {
  const supabase = createAdminClient();

  // 1. Fetch order items and their products' active digital assets
  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select(`
      product_id,
      products (
        id,
        digital_assets (
          id,
          is_active
        )
      )
    `)
    .eq("order_id", input.orderId);

  if (itemsError || !orderItems || orderItems.length === 0) {
    return {
      success: false,
      alreadyProcessed: false,
      entitlementsCreated: 0,
      totalEntitlements: 0,
      message: `Failed to resolve order items: ${itemsError?.message || "No items found"}`,
    };
  }

  // 2. Prepare tokens and encrypted outbox payloads for every active asset
  const deliveryPayloads: DeliveryPayloadInput[] = [];
  for (const item of orderItems) {
    const prod: any = Array.isArray(item.products) ? item.products[0] : item.products;
    const rawAssets = prod?.digital_assets || [];
    const assets = Array.isArray(rawAssets) ? rawAssets : [rawAssets];

    for (const asset of assets) {
      if (asset && asset.is_active) {
        const rawToken = generateBearerToken();
        const tHash = hashToken(rawToken);
        const encrypted = encryptTokenPayload(rawToken);

        deliveryPayloads.push({
          asset_id: asset.id,
          token_hash: tHash,
          encrypted_payload: encrypted,
        });
      }
    }
  }

  // 3. Call the atomic database capture RPC
  const { data, error } = await supabase.rpc("process_order_capture", {
    p_order_id: input.orderId,
    p_gateway_transaction_id: input.gatewayTransactionId,
    p_gateway_order_id: input.gatewayOrderId,
    p_charged_amount: input.amount,
    p_charged_currency: input.currency,
    p_delivery_payloads: deliveryPayloads,
    p_raw_payload: input.rawPayload,
  });

  if (error) {
    return {
      success: false,
      alreadyProcessed: false,
      entitlementsCreated: 0,
      totalEntitlements: 0,
      message: `Database capture error: ${error.message}`,
    };
  }

  const resultRow = Array.isArray(data) ? data[0] : data;
  return {
    success: resultRow.success,
    alreadyProcessed: resultRow.already_processed,
    entitlementsCreated: resultRow.entitlements_created,
    totalEntitlements: resultRow.total_entitlements,
    message: resultRow.message,
  };
}
