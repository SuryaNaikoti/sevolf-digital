import { z } from "zod";

// Provider Status
export type IntegrationStatus = "disconnected" | "configured" | "active" | "error";
export type EnvironmentMode = "test" | "live";

export interface IntegrationCardConfig {
  id: string;
  name: string;
  category: "payments" | "email" | "messaging" | "storage" | "analytics" | "ai" | "platform";
  description: string;
  docsUrl: string;
  status: IntegrationStatus;
  environment: EnvironmentMode;
  lastCheckedAt?: string;
  lastError?: string;
  fields: {
    key: string;
    label: string;
    type: "text" | "password" | "select";
    options?: { label: string; value: string }[];
    placeholder?: string;
    helpText?: string;
    required?: boolean;
    isSecret?: boolean;
  }[];
}

// Payment Provider Abstraction
export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  currency: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface CreatePaymentResult {
  success: boolean;
  paymentId?: string;
  gatewayOrderId?: string;
  clientSecret?: string;
  approvalUrl?: string;
  isTestMode: boolean;
  error?: string;
}

export interface VerifyPaymentInput {
  orderId: string;
  gatewayPaymentId: string;
  signature?: string;
  payload?: any;
}

export interface VerifyPaymentResult {
  verified: boolean;
  gatewayPaymentId: string;
  amount: number;
  currency: string;
  error?: string;
}

export interface PaymentProvider {
  id: string;
  name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
  processWebhook(rawPayload: string, signature: string): Promise<{ event: string; data: any; valid: boolean }>;
  createRefund(input: { paymentId: string; amount: number; reason?: string }): Promise<{ success: boolean; refundId?: string; error?: string }>;
  getPaymentStatus(paymentId: string): Promise<{ status: string; amount: number; currency: string }>;
}

// Email Provider Abstraction
export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailProvider {
  id: string;
  sendTransactionalEmail(payload: EmailPayload): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendOrderConfirmation(orderId: string, to: string, details: any): Promise<{ success: boolean; error?: string }>;
  sendDownloadEmail(to: string, downloadToken: string, siteUrl: string): Promise<{ success: boolean; error?: string }>;
  sendRefundNotification(to: string, amount: number, currency: string, orderId: string): Promise<{ success: boolean; error?: string }>;
}

// Storage Provider Abstraction
export interface StorageProvider {
  id: string;
  upload(bucket: string, path: string, fileBuffer: Buffer, mimeType: string): Promise<{ success: boolean; path?: string; error?: string }>;
  delete(bucket: string, path: string): Promise<{ success: boolean; error?: string }>;
  getMetadata(bucket: string, path: string): Promise<{ size: number; mimeType: string; updatedAt: string } | null>;
  createSignedDownload(bucket: string, path: string, expiresInSeconds: number): Promise<{ success: boolean; signedUrl?: string; error?: string }>;
}

// Analytics Provider Abstraction
export interface AnalyticsEvent {
  eventName: string;
  userId?: string;
  anonymousId?: string;
  properties?: Record<string, any>;
  timestamp?: string;
}

export interface AnalyticsProvider {
  id: string;
  trackEvent(event: AnalyticsEvent): Promise<void>;
  trackPurchase(purchaseData: {
    orderId: string;
    amount: number;
    currency: string;
    items: Array<{ productId: string; name: string; price: number; quantity: number }>;
  }): Promise<void>;
}
