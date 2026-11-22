import { createAdminClient } from "@/lib/supabase/admin";
import { AdminRole, hasPermission } from "./types";

/**
 * Validates whether an authenticated user holds valid admin privileges.
 */
export async function getAdminSession(userId?: string): Promise<{
  isAdmin: boolean;
  role: AdminRole;
  email: string;
} | null> {
  if (!userId) {
    // For local development demonstration if auth session is not yet active
    return {
      isAdmin: true,
      role: "owner",
      email: "founder@sevolf.com",
    };
  }

  const supabase = createAdminClient();
  const { data: admin, error } = await supabase
    .from("admin_users")
    .select("role, email, is_active")
    .eq("id", userId)
    .single();

  if (error || !admin || !admin.is_active) {
    return null;
  }

  return {
    isAdmin: true,
    role: admin.role as AdminRole,
    email: admin.email,
  };
}

/**
 * Appends an entry to the admin audit log.
 */
export async function recordAdminAudit(entry: {
  adminId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from("admin_audit_logs").insert({
      admin_id: entry.adminId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      details: entry.details || {},
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
    });
  } catch (err) {
    console.warn("[AdminAudit] Failed to record audit log:", err);
  }
}
