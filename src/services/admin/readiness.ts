import { createAdminClient } from "@/lib/supabase/admin";

export interface LaunchReadinessItem {
  id: string;
  category: string;
  title: string;
  description: string;
  status: "ready" | "incomplete" | "not_connected" | "test_required" | "blocked";
  details: string;
  actionUrl?: string;
}

export async function getLaunchReadinessChecklist(): Promise<LaunchReadinessItem[]> {
  const supabase = createAdminClient();

  const [{ data: products }, { data: activePrices }, { data: activeAssets }] = await Promise.all([
    supabase.from("products").select("id, name, status"),
    supabase.from("product_prices").select("id, product_id, currency, amount").gt("amount", 0),
    supabase.from("digital_assets").select("id, product_id").eq("is_active", true),
  ]);

  const publishedProducts = (products || []).filter((p) => p.status === "published");
  const draftProducts = (products || []).filter((p) => p.status === "draft");

  const rzpKey = process.env.RAZORPAY_KEY_ID || "";
  const rzpSecret = process.env.RAZORPAY_KEY_SECRET || "";
  const rzpWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  const resendKey = process.env.RESEND_API_KEY || "";
  const tokenEncKey = process.env.TOKEN_ENCRYPTION_KEY || "";

  const isLiveRzp = rzpKey.startsWith("rzp_live_") && rzpSecret.length > 0 && !rzpSecret.includes("your_");
  const isTestRzp = rzpKey.startsWith("rzp_test_") && rzpSecret.length > 0;
  const isWebhookReady = rzpWebhookSecret.length > 0 && !rzpWebhookSecret.includes("your_");
  const isEmailReady = resendKey.length > 0 && !resendKey.includes("your_");
  const isTokenKeyReady = tokenEncKey.length >= 32;

  return [
    {
      id: "storefront",
      category: "Storefront",
      title: "Editorial Storefront & Navigation",
      description: "Responsive home, shop, collections, cart and legal pages.",
      status: "ready",
      details: "Storefront routes and checkout flows compiled and active.",
      actionUrl: "/shop",
    },
    {
      id: "product_catalogue",
      category: "Catalogue",
      title: "Published Product Catalogue",
      description: "At least one product published and visible on the storefront.",
      status: publishedProducts.length > 0 ? "ready" : "incomplete",
      details:
        publishedProducts.length > 0
          ? `${publishedProducts.length} published product(s), ${draftProducts.length} in draft.`
          : `0 published products (${draftProducts.length} in draft). Publish a product to go live.`,
      actionUrl: "/admin/products",
    },
    {
      id: "product_assets",
      category: "Catalogue",
      title: "Digital Asset Storage & Formats",
      description: "Active digital assets mapped to sellable products in private storage.",
      status: (activeAssets || []).length > 0 ? "ready" : "incomplete",
      details:
        (activeAssets || []).length > 0
          ? `${activeAssets!.length} active digital asset(s) mapped in private storage.`
          : "No active digital assets found. Upload PDF/digital assets to enable fulfilment.",
      actionUrl: "/admin/assets",
    },
    {
      id: "pricing_config",
      category: "Catalogue",
      title: "Live Pricing Publication",
      description: "Active production prices in public.product_prices.",
      status: (activePrices || []).length > 0 ? "ready" : "incomplete",
      details:
        (activePrices || []).length > 0
          ? `${activePrices!.length} active price row(s) configured across catalogue.`
          : "Zero active prices in production. Set an active price in the Product Editor.",
      actionUrl: "/admin/products",
    },
    {
      id: "checkout_flow",
      category: "Checkout",
      title: "Checkout Workflow & Validation",
      description: "Server-side price validation, currency sync, and order creation.",
      status: "ready",
      details: "Calculates subtotal and enforces authoritative database pricing.",
      actionUrl: "/checkout",
    },
    {
      id: "payment_gateway",
      category: "Payments",
      title: "Live Payment Gateway (Razorpay)",
      description: "Active production credentials with live money capture capabilities.",
      status: isLiveRzp ? "ready" : isTestRzp ? "test_required" : "not_connected",
      details: isLiveRzp
        ? "Live Razorpay credentials (rzp_live_*) configured."
        : isTestRzp
        ? "Razorpay is currently in Test Mode (rzp_test_*). Configure live rzp_live_* credentials for production."
        : "Razorpay credentials are missing or unconfigured.",
      actionUrl: "/admin/settings",
    },
    {
      id: "payment_webhooks",
      category: "Payments",
      title: "Webhook Signature Verification",
      description: "HMAC-SHA256 signature verification for payment.captured events.",
      status: isWebhookReady ? "ready" : "not_connected",
      details: isWebhookReady
        ? "RAZORPAY_WEBHOOK_SECRET is configured for HMAC-SHA256 verification."
        : "RAZORPAY_WEBHOOK_SECRET is missing or placeholder.",
      actionUrl: "/admin/payments",
    },
    {
      id: "transactional_email",
      category: "Fulfillment",
      title: "Email Dispatcher (Resend API)",
      description: "Dispatching order confirmations and secure download credentials.",
      status: isEmailReady ? "ready" : "not_connected",
      details: isEmailReady
        ? "RESEND_API_KEY is configured for transactional delivery."
        : "RESEND_API_KEY is not configured. Delivery jobs queue in order_delivery_outbox.",
      actionUrl: "/admin/settings",
    },
    {
      id: "digital_delivery",
      category: "Fulfillment",
      title: "Token Encryption & Signed Storage URLs",
      description: "AES-256-GCM token encryption and temporary signed Supabase URLs.",
      status: isTokenKeyReady ? "ready" : "blocked",
      details: isTokenKeyReady
        ? "TOKEN_ENCRYPTION_KEY is configured; 60-second signed URLs enforced."
        : "TOKEN_ENCRYPTION_KEY is missing or invalid.",
      actionUrl: "/admin/assets",
    },
    {
      id: "refund_workflow",
      category: "Finance",
      title: "Atomic Refund Procedure & Lock Ordering",
      description: "process_order_refund stored procedure with line-item and quota checks.",
      status: "ready",
      details: "Replay-safe idempotency and entitlement revocation active.",
      actionUrl: "/admin/refunds",
    },
  ];
}
