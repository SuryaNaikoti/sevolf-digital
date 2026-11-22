import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuthenticatedAdminContext {
  user: {
    id: string;
    email: string;
  };
  adminClient: ReturnType<typeof createAdminClient>;
}

export type AdminAuthResult =
  | { success: true; context: AuthenticatedAdminContext }
  | { success: false; response: NextResponse };

/**
 * Server-side authorization guard enforcing fail-closed zero-trust access on administrative APIs.
 *
 * STRICT AUTHORIZATION POLICY:
 * 1. Checks caller's session via cookieStore or Authorization Bearer header.
 * 2. Ambiguous Credentials Detection: If both cookie session and Bearer token are provided and they represent
 *    different user IDs, the request is rejected with 400 Bad Request (AMBIGUOUS_CREDENTIALS).
 * 3. Retrieves authenticated user via supabase.auth.getUser().
 *    -> If unauthenticated or token expired, returns 401 Unauthorized.
 * 4. Queries authoritative public.profiles JOIN public.roles using the exact user ID.
 *    -> If profile is missing: reject with 403 Forbidden (FORBIDDEN_MISSING_PROFILE).
 *    -> If role is not 'admin' (e.g. 'customer' or 'editor'): reject with 403 Forbidden (FORBIDDEN_INSUFFICIENT_ROLE).
 *    -> If database error occurs during query: reject with 500 Internal Server Error (DATABASE_AUTHORIZATION_ERROR).
 * 5. NEVER authorizes based on user_metadata, app_metadata, or email fallbacks.
 * 6. Only upon authoritative database confirmation does it provision createAdminClient().
 */
export async function requireAdminSession(request?: Request): Promise<AdminAuthResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[requireAdminSession] Missing Supabase environment configuration.");
      return {
        success: false,
        response: NextResponse.json(
          { error: "Server authentication service configuration missing." },
          { status: 500 }
        ),
      };
    }

    const authHeader = request?.headers.get("authorization");
    const cookieStore = await cookies();

    const supabaseCookieClient = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Can be ignored if handled in middleware
          }
        },
      },
    });

    // 1. Resolve user from cookies (if any)
    let cookieUser: any = null;
    const { data: cookieAuthData } = await supabaseCookieClient.auth.getUser();
    if (cookieAuthData?.user) {
      cookieUser = cookieAuthData.user;
    }

    // 2. Resolve user from Bearer header (if any)
    let bearerUser: any = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token) {
        const { data: bearerAuthData, error: bearerError } = await supabaseCookieClient.auth.getUser(token);
        if (!bearerError && bearerAuthData?.user) {
          bearerUser = bearerAuthData.user;
        } else if (bearerError) {
          return {
            success: false,
            response: NextResponse.json(
              {
                error: "Invalid or expired authorization token.",
                code: "INVALID_BEARER_TOKEN",
              },
              { status: 401 }
            ),
          };
        }
      }
    }

    // 3. Ambiguous Credential Verification:
    // If BOTH cookie credentials and Bearer token are supplied and resolve to conflicting user identities, fail closed.
    if (cookieUser && bearerUser && cookieUser.id !== bearerUser.id) {
      console.warn("[requireAdminSession] Conflicting credentials detected between cookie and Bearer token.", {
        cookieUserId: cookieUser.id,
        bearerUserId: bearerUser.id,
      });
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Conflicting credentials provided. Ambiguous identity detected between session cookie and authorization header.",
            code: "AMBIGUOUS_CREDENTIALS",
          },
          { status: 400 }
        ),
      };
    }

    // Use resolved user (Bearer takes precedence when matching or cookie absent)
    const user = bearerUser || cookieUser;

    // Fail closed: Unauthenticated callers receive 401
    if (!user || !user.id) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Authentication required. Please sign in to access administrative operations.",
            code: "UNAUTHENTICATED",
          },
          { status: 401 }
        ),
      };
    }

    // 4. Authoritative Database Role Verification:
    // Strictly queries public.profiles and public.roles. Zero metadata fallbacks allowed.
    const privilegedChecker = createAdminClient();
    const { data: profile, error: profileError } = await privilegedChecker
      .from("profiles")
      .select("id, role_id, roles (name)")
      .eq("id", user.id)
      .maybeSingle();

    // Database or network error during role lookup -> 500
    if (profileError) {
      console.error("[requireAdminSession] Database error during profile/role verification:", profileError);
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Database error occurred while verifying administrative authorization.",
            code: "DATABASE_AUTHORIZATION_ERROR",
          },
          { status: 500 }
        ),
      };
    }

    // Missing profile -> 403 (Zero metadata fallback)
    if (!profile) {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Access denied. Caller profile does not exist in administrative directory.",
            code: "FORBIDDEN_MISSING_PROFILE",
          },
          { status: 403 }
        ),
      };
    }

    // Authoritative role check: must be 'admin'
    const roleName = (profile.roles as any)?.name;
    if (roleName !== "admin") {
      return {
        success: false,
        response: NextResponse.json(
          {
            error: "Access denied. Caller does not have administrative privileges.",
            code: "FORBIDDEN_INSUFFICIENT_ROLE",
          },
          { status: 403 }
        ),
      };
    }

    // Authorization strictly validated against PostgreSQL database
    return {
      success: true,
      context: {
        user: {
          id: user.id,
          email: user.email || "",
        },
        adminClient: privilegedChecker,
      },
    };
  } catch (err: any) {
    console.error("[requireAdminSession] Unexpected error during admin authorization:", err);
    return {
      success: false,
      response: NextResponse.json(
        { error: "Internal server error during authorization verification." },
        { status: 500 }
      ),
    };
  }
}
