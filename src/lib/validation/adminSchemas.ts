import { z } from "zod";

// 1. PRODUCTS SCHEMAS
export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters").max(255),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters").max(255).regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase alphanumeric characters and hyphens"),
  tagline: z.string().max(500).optional().default(""),
  short_description: z.string().max(1000).optional().default(""),
  full_description: z.string().optional().default(""),
  category_id: z.string().uuid("Invalid category ID format").optional(),
  product_type: z.string().max(100).optional().default("Digital Workbook"),
  format: z.string().max(50).optional().default("pdf"),
  format_label: z.string().max(150).optional().default("PDF (Print-Ready)"),
  cover_image_url: z.string().max(500).optional().default("/images/products/home-reset-kit/cover.jpg"),
  licence_type: z.string().max(50).optional().default("personal"),
  status: z.enum(["draft", "archived", "published"]).optional().default("draft"),
  tags: z.array(z.string()).optional().default(["digital", "draft"]),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(2).max(255).optional(),
  tagline: z.string().max(500).optional(),
  short_description: z.string().max(1000).optional(),
  full_description: z.string().optional(),
  category_id: z.string().uuid().optional(),
  product_type: z.string().max(100).optional(),
  format: z.string().max(50).optional(),
  format_label: z.string().max(150).optional(),
  cover_image_url: z.string().max(500).optional(),
  licence_type: z.string().max(50).optional(),
  status: z.enum(["draft", "archived", "published"]).optional(),
  tags: z.array(z.string()).optional(),
  seo_title: z.string().max(255).optional(),
  seo_description: z.string().max(500).optional(),
  activate_pricing: z.boolean().optional(),
  is_price_active: z.boolean().optional(),
});

// 2. COLLECTIONS SCHEMAS
export const createCollectionSchema = z.object({
  name: z.string().trim().min(2, "Collection name must be at least 2 characters").max(100),
  slug: z.string().trim().min(2, "Slug must be at least 2 characters").max(100).regex(/^[a-z0-9-]+$/, "Slug must only contain lowercase alphanumeric characters and hyphens"),
  tagline: z.string().max(255).optional().default(""),
  description: z.string().optional().default(""),
  image_url: z.string().max(500).optional().default("/images/collections/home-living/cover.jpg"),
  is_featured: z.boolean().optional().default(false),
  display_order: z.number().int().min(0).optional().default(1),
});

export const updateCollectionSchema = z.object({
  id: z.string().uuid("Invalid collection ID format"),
  name: z.string().trim().min(2).max(100).optional(),
  tagline: z.string().max(255).optional(),
  description: z.string().optional(),
  image_url: z.string().max(500).optional(),
  is_featured: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
});

// 3. COUPONS SCHEMAS
export const createCouponSchema = z.object({
  code: z.string().trim().min(3, "Coupon code must be at least 3 characters").max(50).regex(/^[A-Z0-9_-]+$/, "Coupon code must be uppercase alphanumeric"),
  discount_percent: z.number().int().min(1).max(100).nullable().optional(),
  discount_amount: z.number().positive().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional().default(true),
}).refine((data) => data.discount_percent != null || data.discount_amount != null, {
  message: "Either discount_percent (1-100) or discount_amount must be provided.",
  path: ["discount_percent"],
});

export const updateCouponSchema = z.object({
  id: z.string().uuid("Invalid coupon ID format"),
  is_active: z.boolean().optional(),
  max_uses: z.number().int().positive().nullable().optional(),
  valid_until: z.string().datetime().nullable().optional(),
});

// 4. DIGITAL ASSETS SCHEMAS
export const createAssetSchema = z.object({
  file_name: z.string().trim().min(3, "File name is required").max(255),
  storage_path: z.string().trim().min(5, "Storage path is required").max(500),
  product_id: z.string().uuid("Invalid product ID format").nullable().optional(),
  file_size_bytes: z.number().int().positive().optional(),
  mime_type: z.string().max(100).optional().default("application/pdf"),
  file_version: z.string().max(50).optional().default("1.0"),
  checksum: z.string().max(64).nullable().optional(),
});

export const updateAssetSchema = z.object({
  id: z.string().uuid("Invalid asset ID format"),
  product_id: z.string().uuid("Invalid product ID format").nullable().optional(),
  file_version: z.string().max(50).optional(),
  checksum: z.string().max(64).nullable().optional(),
});
