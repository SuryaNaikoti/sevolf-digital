import { createAdminClient } from "@/lib/supabase/admin";
import { decryptTokenPayload } from "@/services/security/tokenEncryption";

export interface OutboxDeliveryJob {
  job_id: string;
  order_id: string;
  customer_email: string;
  encrypted_token_payload: string;
  lease_token: string;
}

export interface WorkerBatchResult {
  claimed: number;
  delivered: number;
  failed: number;
}

/**
 * Dispatches an email with a secure bearer download link.
 * Strictly verifies Resend configuration.
 */
async function sendDeliveryEmail(
  customerEmail: string,
  rawToken: string,
  siteUrl: string
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey || resendApiKey.trim().length === 0) {
    return {
      success: false,
      error: "RESEND_API_KEY is not configured.",
    };
  }

  const downloadUrl = `${siteUrl}/api/download/${rawToken}`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@sevolf.store",
        to: customerEmail,
        subject: "Your SEVOLF Digital Download is Ready",
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Thank you for your purchase!</h2>
            <p>Your digital product is ready for instant download.</p>
            <p><a href="${downloadUrl}" style="display: inline-block; padding: 12px 24px; background: #000; color: #fff; text-decoration: none; border-radius: 4px;">Download Your File</a></p>
            <p style="color: #666; font-size: 12px;">This link is valid for 30 days and allows up to 10 downloads.</p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `Resend HTTP ${res.status}: ${errText}` };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: `Network error: ${err?.message || "Unknown error"}` };
  }
}

/**
 * Polls and processes a batch of pending delivery jobs concurrently.
 */
export async function processOutboxBatch(
  batchSize = 10,
  leaseSeconds = 120
): Promise<WorkerBatchResult> {
  const supabase = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  // 1. Claim batch of jobs using FOR UPDATE SKIP LOCKED and generate worker lease
  const { data: jobs, error: claimError } = await supabase.rpc("claim_pending_delivery_jobs", {
    p_batch_size: batchSize,
    p_lease_seconds: leaseSeconds,
  });

  if (claimError || !jobs || jobs.length === 0) {
    return { claimed: 0, delivered: 0, failed: 0 };
  }

  let deliveredCount = 0;
  let failedCount = 0;

  for (const job of jobs as OutboxDeliveryJob[]) {
    try {
      // 2. Decrypt bearer token using server KMS key
      const rawToken = decryptTokenPayload(job.encrypted_token_payload);

      // 3. Dispatch transactional email
      const result = await sendDeliveryEmail(job.customer_email, rawToken, siteUrl);

      if (result.success) {
        // 4. Mark job completed with lease token ownership validation
        const { data: completed, error: completeError } = await supabase.rpc("complete_delivery_job", {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
        });

        if (completeError) {
          console.error(
            `[OutboxWorker] Failed to complete delivery job ${job.job_id}: ${completeError.message}`
          );
          failedCount++;
        } else if (completed) {
          deliveredCount++;
        } else {
          // Lease was lost or expired
          console.warn(
            `[OutboxWorker] Delivery job ${job.job_id} lease token mismatch or lease expired.`
          );
          failedCount++;
        }
      } else {
        // 5. Mark job failed with backoff and lease token check
        const { error: failError } = await supabase.rpc("fail_delivery_job", {
          p_job_id: job.job_id,
          p_lease_token: job.lease_token,
          p_error_msg: result.error,
          p_backoff_seconds: 300,
        });
        if (failError) {
          console.error(
            `[OutboxWorker] Failed to record failure for delivery job ${job.job_id}: ${failError.message}`
          );
        }
        failedCount++;
      }
    } catch (err: any) {
      const { error: failError } = await supabase.rpc("fail_delivery_job", {
        p_job_id: job.job_id,
        p_lease_token: job.lease_token,
        p_error_msg: err?.message || "Decryption or processing exception",
        p_backoff_seconds: 600,
      });
      if (failError) {
        console.error(
          `[OutboxWorker] Failed to record error failure for delivery job ${job.job_id}: ${failError.message}`
        );
      }
      failedCount++;
    }
  }

  return {
    claimed: jobs.length,
    delivered: deliveredCount,
    failed: failedCount,
  };
}
