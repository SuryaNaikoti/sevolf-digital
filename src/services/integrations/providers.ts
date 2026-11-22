import {
  PaymentProvider,
  EmailProvider,
  StorageProvider,
  AnalyticsProvider,
  CreatePaymentInput,
  CreatePaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  EmailPayload,
  AnalyticsEvent,
} from "./types";

/**
 * Disconnected Razorpay Payment Provider Placeholder.
 * Adheres strictly to rule: Never fake live transactions. Clearly indicates test/disconnected status.
 */
export class RazorpayProvider implements PaymentProvider {
  id = "razorpay";
  name = "Razorpay";

  private isConfigured(): boolean {
    return Boolean(
      process.env.RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      !process.env.RAZORPAY_KEY_ID.includes("placeholder")
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        isTestMode: true,
        error: "Razorpay integration is disconnected. Configure valid test/live API keys in Admin Settings.",
      };
    }
    // Real implementation would invoke razorpay.orders.create
    return {
      success: false,
      isTestMode: true,
      error: "Live payment gateway initialization suspended in staging/preview.",
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return {
      verified: false,
      gatewayPaymentId: input.gatewayPaymentId,
      amount: 0,
      currency: "INR",
      error: "Gateway signature verification unavailable (integration disconnected).",
    };
  }

  async processWebhook(rawPayload: string, signature: string) {
    return {
      event: "unknown",
      data: null,
      valid: false,
    };
  }

  async createRefund(input: { paymentId: string; amount: number; reason?: string }) {
    return {
      success: false,
      error: "Automated gateway refund execution unavailable (integration disconnected).",
    };
  }

  async getPaymentStatus(paymentId: string) {
    return {
      status: "unverified",
      amount: 0,
      currency: "INR",
    };
  }
}

/**
 * Disconnected Stripe Payment Provider Placeholder.
 */
export class StripeProvider implements PaymentProvider {
  id = "stripe";
  name = "Stripe";

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      success: false,
      isTestMode: true,
      error: "Stripe integration is currently disconnected.",
    };
  }

  async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    return {
      verified: false,
      gatewayPaymentId: input.gatewayPaymentId,
      amount: 0,
      currency: input.payload?.currency || "USD",
      error: "Stripe integration disconnected.",
    };
  }

  async processWebhook(rawPayload: string, signature: string) {
    return { event: "unknown", data: null, valid: false };
  }

  async createRefund(input: { paymentId: string; amount: number; reason?: string }) {
    return { success: false, error: "Stripe integration disconnected." };
  }

  async getPaymentStatus(paymentId: string) {
    return { status: "unverified", amount: 0, currency: "USD" };
  }
}

/**
 * Disconnected Resend Email Provider Placeholder.
 */
export class ResendEmailProvider implements EmailProvider {
  id = "resend";

  async sendTransactionalEmail(payload: EmailPayload) {
    return {
      success: false,
      error: "Resend email provider is disconnected. Outbox jobs queued safely for future delivery.",
    };
  }

  async sendOrderConfirmation(orderId: string, to: string, details: any) {
    return { success: false, error: "Email provider disconnected." };
  }

  async sendDownloadEmail(to: string, downloadToken: string, siteUrl: string) {
    return { success: false, error: "Email provider disconnected." };
  }

  async sendRefundNotification(to: string, amount: number, currency: string, orderId: string) {
    return { success: false, error: "Email provider disconnected." };
  }
}

/**
 * Disconnected Storage Provider Placeholder.
 */
export class SupabaseStorageAdapter implements StorageProvider {
  id = "supabase_storage";

  async upload(bucket: string, path: string, fileBuffer: Buffer, mimeType: string) {
    return { success: false, error: "Direct storage upload restricted in development environment." };
  }

  async delete(bucket: string, path: string) {
    return { success: false, error: "Storage deletion restricted." };
  }

  async getMetadata(bucket: string, path: string) {
    return null;
  }

  async createSignedDownload(bucket: string, path: string, expiresInSeconds: number) {
    return { success: false, error: "Signed URL generation requires active Supabase storage credentials." };
  }
}

/**
 * Disconnected Analytics Provider.
 */
export class DisconnectedAnalyticsProvider implements AnalyticsProvider {
  id = "analytics_placeholder";

  async trackEvent(event: AnalyticsEvent) {
    // No-op in disconnected mode
  }

  async trackPurchase(purchaseData: any) {
    // No-op in disconnected mode
  }
}
