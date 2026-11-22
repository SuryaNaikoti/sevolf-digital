import { z } from "zod";

export type AdminRole = "owner" | "administrator" | "product_manager" | "support_agent" | "analyst";

export interface AdminUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
}

export interface AdminAuditLog {
  id: string;
  adminId?: string;
  adminEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// Role Permissions Matrix
export const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  owner: ["*"],
  administrator: [
    "products:*",
    "collections:*",
    "assets:*",
    "orders:*",
    "customers:*",
    "discounts:*",
    "bundles:*",
    "reviews:*",
    "content:*",
    "analytics:*",
    "settings:*",
    "integrations:*",
    "audit:read",
  ],
  product_manager: [
    "products:*",
    "collections:*",
    "assets:*",
    "bundles:*",
    "content:*",
    "reviews:*",
    "analytics:read",
  ],
  support_agent: [
    "orders:read",
    "orders:resend_download",
    "customers:read",
    "refunds:request",
    "reviews:moderate",
  ],
  analyst: [
    "analytics:read",
    "orders:read",
    "customers:read",
    "products:read",
  ],
};

export function hasPermission(role: AdminRole, permission: string): boolean {
  const allowed = ROLE_PERMISSIONS[role] || [];
  if (allowed.includes("*")) return true;
  if (allowed.includes(permission)) return true;

  const [category] = permission.split(":");
  if (allowed.includes(`${category}:*`)) return true;

  return false;
}

// Zod schemas for input validation
export const ProductFormSchema = z.object({
  name: z.string().min(3, "Name must be at least 3 characters").max(120),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase alphanumeric characters and hyphens"),
  tagline: z.string().max(200).optional(),
  shortDescription: z.string().min(10, "Short description required"),
  fullDescription: z.string().min(30, "Full description must be detailed"),
  category: z.enum(["home-living", "kids-education", "productivity", "business"]),
  format: z.enum(["pdf", "zip", "template", "digital_resource", "interactive_app", "bundle", "subscription"]),
  price: z.number().nonnegative("Price cannot be negative"),
  compareAtPrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).default("INR"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  licenceType: z.enum(["personal", "commercial", "extended"]).default("personal"),
  isFeatured: z.boolean().default(false),
  isNewArrival: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});
