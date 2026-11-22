import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { createAssetSchema, updateAssetSchema } from "@/lib/validation/adminSchemas";
import { handleApiError } from "@/lib/api/errorHandler";

export async function GET(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const { adminClient } = auth.context;
    const { data, error } = await adminClient
      .from("digital_assets")
      .select(`
        *,
        products (id, name, slug, status)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return handleApiError(error, "Failed to retrieve digital assets.");
    }
    return NextResponse.json({ assets: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to retrieve digital assets.");
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const validated = createAssetSchema.parse(body);

    const { adminClient } = auth.context;

    // 1. PRODUCT RELATIONSHIP VALIDATION:
    // If product_id is provided, verify it exists and is not archived
    if (validated.product_id) {
      const { data: product, error: prodErr } = await adminClient
        .from("products")
        .select("id, name, status")
        .eq("id", validated.product_id)
        .single();

      if (prodErr || !product) {
        return NextResponse.json(
          {
            error: "Referenced product does not exist.",
            code: "PRODUCT_NOT_FOUND",
          },
          { status: 400 }
        );
      }

      if (product.status === "archived") {
        return NextResponse.json(
          {
            error: "Cannot bind new digital assets to an archived product.",
            code: "PRODUCT_ARCHIVED",
          },
          { status: 400 }
        );
      }
    }

    // 2. STORAGE PHYSICAL OBJECT EXISTENCE VERIFICATION:
    // Verify that the file object actually exists in the private 'digital-products' bucket,
    // including nested subdirectories and paginated directory scans.
    const cleanStoragePath = validated.storage_path.replace(/^\/+/, "");
    const pathParts = cleanStoragePath.split("/");
    const fileName = pathParts.pop();
    const folderPath = pathParts.join("/");

    if (!fileName) {
      return NextResponse.json(
        { error: "Invalid storage path provided.", code: "INVALID_STORAGE_PATH" },
        { status: 400 }
      );
    }

    // Paginated exhaustive search in target directory
    let matchedFile: any = null;
    let offset = 0;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore && !matchedFile) {
      const { data: storageFiles, error: storageErr } = await adminClient.storage
        .from("digital-products")
        .list(folderPath, {
          limit: pageSize,
          offset,
          search: fileName,
        });

      if (storageErr) {
        console.error("[POST /api/admin/assets] Storage query error:", storageErr);
        return NextResponse.json(
          {
            error: "Failed to access private storage bucket to verify asset file existence.",
            code: "STORAGE_VERIFICATION_FAILED",
          },
          { status: 500 }
        );
      }

      if (!storageFiles || storageFiles.length === 0) {
        hasMore = false;
        break;
      }

      // Exact case-sensitive matching for authoritative binary object verification
      matchedFile = storageFiles.find((f) => f.name === fileName);

      if (matchedFile || storageFiles.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }
    }

    if (!matchedFile) {
      return NextResponse.json(
        {
          error: `Physical storage object not found. File '${cleanStoragePath}' does not exist in private storage bucket 'digital-products'.`,
          code: "STORAGE_OBJECT_NOT_FOUND",
        },
        { status: 404 }
      );
    }

    // If file_size_bytes is not specified, use actual physical size from Storage
    const actualBytes = (matchedFile.metadata as any)?.size || validated.file_size_bytes || 0;

    const newAsset = {
      product_id: validated.product_id || null,
      storage_path: cleanStoragePath,
      file_name: validated.file_name,
      file_size_bytes: actualBytes,
      mime_type: validated.mime_type,
      file_version: validated.file_version,
      checksum: validated.checksum || null,
    };

    const { data, error } = await adminClient
      .from("digital_assets")
      .insert(newAsset)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "Failed to register digital asset record.");
    }

    return NextResponse.json({ success: true, asset: data }, { status: 201 });
  } catch (err: any) {
    return handleApiError(err, "Failed to register digital asset.");
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const validated = updateAssetSchema.parse(body);

    const { adminClient } = auth.context;

    // Validate product relationship if updating product_id
    if (validated.product_id) {
      const { data: product, error: prodErr } = await adminClient
        .from("products")
        .select("id, status")
        .eq("id", validated.product_id)
        .single();

      if (prodErr || !product) {
        return NextResponse.json(
          { error: "Referenced product does not exist.", code: "PRODUCT_NOT_FOUND" },
          { status: 400 }
        );
      }
      if (product.status === "archived") {
        return NextResponse.json(
          { error: "Cannot bind asset to an archived product.", code: "PRODUCT_ARCHIVED" },
          { status: 400 }
        );
      }
    }

    const updates: Record<string, any> = {};
    if (validated.product_id !== undefined) updates.product_id = validated.product_id;
    if (validated.file_version !== undefined) updates.file_version = validated.file_version;
    if (validated.checksum !== undefined) updates.checksum = validated.checksum;

    const { data, error } = await adminClient
      .from("digital_assets")
      .update(updates)
      .eq("id", validated.id)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "Failed to update digital asset record.");
    }

    return NextResponse.json({ success: true, asset: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to update digital asset.");
  }
}
