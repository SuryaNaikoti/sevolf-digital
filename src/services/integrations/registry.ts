import { IntegrationCardConfig } from "./types";

export const INTEGRATION_REGISTRY_CONFIG: IntegrationCardConfig[] = [
  // Payments
  {
    id: "razorpay",
    name: "Razorpay",
    category: "payments",
    description: "India's leading payment gateway supporting UPI, Cards, Netbanking & EMI.",
    docsUrl: "https://razorpay.com/docs",
    status: "disconnected",
    environment: "test",
    fields: [
      { key: "keyId", label: "Key ID", type: "text", placeholder: "rzp_test_...", required: true },
      { key: "keySecret", label: "Key Secret", type: "password", placeholder: "••••••••••••••••", required: true, isSecret: true },
      { key: "webhookSecret", label: "Webhook Secret", type: "password", placeholder: "••••••••••••••••", required: true, isSecret: true },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "payments",
    description: "Global payments infrastructure supporting international cards, Apple Pay & Google Pay.",
    docsUrl: "https://stripe.com/docs",
    status: "disconnected",
    environment: "test",
    fields: [
      { key: "publishableKey", label: "Publishable Key", type: "text", placeholder: "pk_test_...", required: true },
      { key: "secretKey", label: "Secret Key", type: "password", placeholder: "sk_test_••••••••", required: true, isSecret: true },
      { key: "webhookSecret", label: "Webhook Signing Secret", type: "password", placeholder: "whsec_••••••••", required: true, isSecret: true },
    ],
  },
  // Email
  {
    id: "resend",
    name: "Resend",
    category: "email",
    description: "Modern developer-first transactional email delivery platform.",
    docsUrl: "https://resend.com/docs",
    status: "disconnected",
    environment: "live",
    fields: [
      { key: "apiKey", label: "API Key", type: "password", placeholder: "re_••••••••••••", required: true, isSecret: true },
      { key: "fromEmail", label: "From Address", type: "text", placeholder: "SEVOLF Digital <orders@sevolf.com>", required: true },
      { key: "replyTo", label: "Reply-To Email", type: "text", placeholder: "support@sevolf.com" },
    ],
  },
  // Messaging
  {
    id: "whatsapp",
    name: "WhatsApp Business API",
    category: "messaging",
    description: "Send instant digital download links and order notifications via WhatsApp.",
    docsUrl: "https://developers.facebook.com/docs/whatsapp",
    status: "disconnected",
    environment: "test",
    fields: [
      { key: "phoneNumberId", label: "Phone Number ID", type: "text", placeholder: "1098234...", required: true },
      { key: "accessToken", label: "Permanent Access Token", type: "password", placeholder: "EAAG••••••••", required: true, isSecret: true },
    ],
  },
  // Storage
  {
    id: "supabase_storage",
    name: "Supabase Storage",
    category: "storage",
    description: "Private encrypted object storage for downloadable assets with signed URLs.",
    docsUrl: "https://supabase.com/docs/guides/storage",
    status: "disconnected",
    environment: "live",
    fields: [
      { key: "bucketName", label: "Private Bucket Name", type: "text", placeholder: "digital-products", required: true },
      { key: "urlExpirySeconds", label: "Default Signed URL Expiry (s)", type: "text", placeholder: "60" },
    ],
  },
  // Analytics
  {
    id: "google_analytics",
    name: "Google Analytics 4",
    category: "analytics",
    description: "Customer journey analysis, conversion events and ecommerce tracking.",
    docsUrl: "https://analytics.google.com",
    status: "disconnected",
    environment: "live",
    fields: [
      { key: "measurementId", label: "Measurement ID", type: "text", placeholder: "G-XXXXXXXXXX", required: true },
    ],
  },
  {
    id: "meta_pixel",
    name: "Meta Pixel & Conversions API",
    category: "analytics",
    description: "Track conversions, retargeting and customer events across Meta platforms.",
    docsUrl: "https://developers.facebook.com/docs/meta-pixel",
    status: "disconnected",
    environment: "test",
    fields: [
      { key: "pixelId", label: "Pixel ID", type: "text", placeholder: "1234567890", required: true },
      { key: "capiToken", label: "Conversions API Token", type: "password", placeholder: "EAA••••••••", isSecret: true },
    ],
  },
  // AI
  {
    id: "gemini_ai",
    name: "Google Gemini AI",
    category: "ai",
    description: "Assisted product drafting, SEO copy suggestion and content summarization.",
    docsUrl: "https://ai.google.dev",
    status: "disconnected",
    environment: "live",
    fields: [
      { key: "apiKey", label: "Gemini API Key", type: "password", placeholder: "AIzaSy••••••••", required: true, isSecret: true },
      { key: "model", label: "Model Version", type: "select", options: [
        { label: "Gemini 1.5 Pro (Recommended)", value: "gemini-1.5-pro" },
        { label: "Gemini 1.5 Flash", value: "gemini-1.5-flash" },
      ]},
    ],
  },
];
