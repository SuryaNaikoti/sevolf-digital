import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return NextResponse.json({ error: "Invalid download token." }, { status: 400 });
  }

  const rawToken = token.trim();
  const adminClient = createAdminClient();

  // Generate an idempotency key based on client headers or unique request ID
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "direct";
  const idempotencyKey = request.headers.get("x-idempotency-key") || `claim-${rawToken.slice(0, 16)}-${Date.now()}`;

  // 1. Claim download entitlement via privileged service_role RPC
  const { data: claimRows, error: claimError } = await adminClient.rpc("claim_download_entitlement", {
    p_raw_token: rawToken,
    p_idempotency_key: idempotencyKey,
  });

  if (claimError || !claimRows || claimRows.length === 0) {
    const errorMsg = claimError?.message || "Entitlement unavailable";

    if (errorMsg.includes("ENTITLEMENT_NOT_FOUND")) {
      return NextResponse.json({ error: "Download link not found or invalid." }, { status: 404 });
    }
    if (errorMsg.includes("ENTITLEMENT_REVOKED")) {
      return NextResponse.json({ error: "This download entitlement has been revoked." }, { status: 403 });
    }
    if (errorMsg.includes("ENTITLEMENT_EXPIRED")) {
      return NextResponse.json({ error: "Download link has expired." }, { status: 410 });
    }
    if (errorMsg.includes("DOWNLOAD_LIMIT_REACHED")) {
      return NextResponse.json({ error: "Download limit reached for this entitlement." }, { status: 429 });
    }
    if (errorMsg.includes("IDEMPOTENCY_EXPIRED")) {
      return NextResponse.json({ error: "Prior download authorization expired. Please refresh." }, { status: 410 });
    }

    return NextResponse.json({ error: errorMsg }, { status: 400 });
  }

  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;

  // 2. Generate secure short-lived signed URL (valid for 60 seconds)
  const { data: signedData, error: signError } = await adminClient.storage
    .from("digital-products")
    .createSignedUrl(claim.storage_path, 60);

  if (signError || !signedData?.signedUrl) {
    // Report failure to release reservation without consuming quota
    await adminClient.rpc("fail_download_claim", {
      p_claim_id: claim.claim_id,
      p_claim_token: claim.claim_token,
      p_failure_reason: signError?.message || "STORAGE_SIGNED_URL_ERROR",
    });

    return NextResponse.json({ error: "Failed to generate download link from storage." }, { status: 500 });
  }

  // 3. Finalize download claim (atomically increments download_count in DB)
  const { data: finalized, error: finalizeError } = await adminClient.rpc("finalize_download_claim", {
    p_claim_id: claim.claim_id,
    p_claim_token: claim.claim_token,
  });

  if (finalizeError || !finalized) {
    return NextResponse.json({ error: "Download claim could not be finalized." }, { status: 410 });
  }

  // 4. Record access log asynchronously
  const userAgent = request.headers.get("user-agent") || "unknown";
  adminClient
    .from("download_logs")
    .insert({
      entitlement_id: claim.entitlement_id,
      ip_address: clientIp.slice(0, 45),
      user_agent: userAgent.slice(0, 500),
    })
    .then();

  // 5. Redirect client to temporary signed storage URL
  return NextResponse.redirect(signedData.signedUrl, 302);
}
