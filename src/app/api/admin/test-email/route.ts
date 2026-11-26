import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { buildPurchaseEmailPayload } from "@/services/email/purchaseEmailService";
import { buildPurchaseDeliveryEmailHtml } from "@/services/email/purchaseEmailTemplate";

const ALLOWED_TEST_RECIPIENT = "suryanaikoti@gmail.com";
const TEST_ORDER_ID = "c6f37521-9351-4fc4-a6fd-76e839dd0079"; // ORD-369819
const TEST_ENTITLEMENT_ID = "2e4ba240-1f2a-4ca9-bc5a-1603183082ec";

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || resendApiKey.trim().length === 0) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }

  const { adminClient } = auth.context;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sevolf.shop";

  const { data: emailData, attachments } = await buildPurchaseEmailPayload(
    adminClient,
    TEST_ORDER_ID,
    TEST_ENTITLEMENT_ID,
    "test-verification-token",
    siteUrl
  );

  const html = buildPurchaseDeliveryEmailHtml(emailData);
  const subject = `[TEST] Your SEVOLF Digital Order ${emailData.orderNumber} is Ready`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from:
        process.env.RESEND_FROM_EMAIL ||
        process.env.NEXT_PUBLIC_SUPPORT_EMAIL ||
        "SEVOLF Digital <support@sevolf.shop>",
      reply_to: "support@sevolf.shop",
      to: ALLOWED_TEST_RECIPIENT,
      subject,
      html,
      ...(attachments.length > 0 ? { attachments } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return NextResponse.json({ error: `Resend HTTP ${res.status}: ${errText}` }, { status: 502 });
  }

  const resendJson = await res.json();
  return NextResponse.json({
    success: true,
    resendId: resendJson.id,
    recipient: ALLOWED_TEST_RECIPIENT,
    subject,
    attachment: attachments[0]
      ? { filename: attachments[0].filename, base64Length: attachments[0].content.length }
      : null,
    status: "accepted",
  });
}
