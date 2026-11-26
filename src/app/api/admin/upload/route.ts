import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_ASSET_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/epub+zip",
]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ASSET_BYTES = 100 * 1024 * 1024; // 100 MB

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const purpose = (formData.get("purpose") as string) || "digital_asset";
    const productSlug = ((formData.get("product_slug") as string) || "general")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-");

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    const isImage = purpose === "cover" || purpose === "gallery" || purpose === "preview";
    const allowedSet = isImage ? ALLOWED_IMAGE_TYPES : ALLOWED_ASSET_TYPES;
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_ASSET_BYTES;

    if (!allowedSet.has(file.type)) {
      return NextResponse.json(
        {
          error: isImage
            ? "Invalid image type. Allowed: JPEG, PNG, WebP."
            : "Invalid digital asset type. Allowed: PDF, ZIP, EPUB.",
        },
        { status: 400 }
      );
    }

    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          error: `File exceeds maximum allowed size (${isImage ? "10 MB" : "100 MB"}).`,
        },
        { status: 400 }
      );
    }

    const { adminClient } = auth.context;
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const timestamp = Date.now();
    const bucket =
      purpose === "cover" || purpose === "gallery"
        ? "product-covers"
        : purpose === "preview"
        ? "product-previews"
        : "digital-products";

    const storagePath = `products/${productSlug}/${timestamp}-${sanitizedName}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await adminClient.storage
      .from(bucket)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      );
    }

    let publicUrl: string | null = null;
    if (isImage) {
      const { data: urlData } = adminClient.storage.from(bucket).getPublicUrl(storagePath);
      publicUrl = urlData?.publicUrl || null;
    }

    return NextResponse.json({
      success: true,
      bucket,
      storage_path: storagePath,
      file_name: sanitizedName,
      file_size_bytes: file.size,
      mime_type: file.type,
      public_url: publicUrl,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unexpected upload error." },
      { status: 500 }
    );
  }
}
