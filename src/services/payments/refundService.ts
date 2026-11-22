import { createAdminClient } from "@/lib/supabase/admin";

export interface ProcessRefundInput {
  orderId: string;
  paymentId: string;
  productId?: string | null;
  gatewayRefundId: string;
  amount: number;
  currency: string;
  reason?: string;
  rawPayload?: Record<string, unknown>;
}

export interface ProcessRefundResult {
  success: boolean;
  alreadyProcessed: boolean;
  entitlementsRevoked: number;
  orderStatus: string;
  message: string;
}

/**
 * Processes a refund with line-item product-level entitlement revocation.
 */
export async function processRefund(
  input: ProcessRefundInput
): Promise<ProcessRefundResult> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc("process_order_refund", {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_product_id: input.productId || null,
    p_gateway_refund_id: input.gatewayRefundId,
    p_refund_amount: input.amount,
    p_refund_currency: input.currency,
    p_reason: input.reason || "Customer refund request",
    p_raw_payload: input.rawPayload || {},
  });

  if (error) {
    return {
      success: false,
      alreadyProcessed: false,
      entitlementsRevoked: 0,
      orderStatus: "unknown",
      message: error.message,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    success: row.success,
    alreadyProcessed: row.already_processed,
    entitlementsRevoked: row.entitlements_revoked,
    orderStatus: row.order_status,
    message: row.message,
  };
}
