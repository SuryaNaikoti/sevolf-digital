import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Privileged server-only Supabase client using SUPABASE_SERVICE_ROLE_KEY.
 *
 * CRITICAL SECURITY RULES:
 * 1. NEVER import this file into Client Components ("use client").
 * 2. Use ONLY in protected backend Route Handlers or Server Actions for
 *    privileged operations such as generating download entitlements, verifying webhooks,
 *    and querying private buckets.
 * 3. Never send the service-role key to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server environment."
    );
  }

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
