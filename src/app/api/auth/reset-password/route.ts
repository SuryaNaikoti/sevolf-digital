import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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
            // Ignored
          }
        },
      },
    });

    // Safely resolve the base origin for password recovery redirect:
    // In production, enforce HTTPS and strictly prohibit localhost or insecure HTTP
    const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
    const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    let siteUrl = "https://www.sevolf.shop";
    if (isProduction) {
      if (configuredUrl && configuredUrl.startsWith("https://") && !configuredUrl.includes("localhost") && !configuredUrl.includes("127.0.0.1")) {
        siteUrl = configuredUrl;
      } else {
        siteUrl = "https://www.sevolf.shop";
      }
    } else {
      // Local development environment
      siteUrl = configuredUrl || "http://localhost:3000";
    }

    // Strip trailing slashes for clean URL concatenation
    const sanitizedBaseUrl = siteUrl.replace(/\/+$/, "");
    const redirectTo = `${sanitizedBaseUrl}/auth/callback?next=/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Password reset request failed" }, { status: 500 });
  }
}
