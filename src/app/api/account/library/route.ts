import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const cookieStore = await cookies();

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
          } catch {}
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({
        authenticated: false,
        orders: [],
        entitlements: [],
      });
    }

    const adminClient = createAdminClient();

    // 1. Fetch all orders matching logged in user's id or email
    const { data: orders, error: ordersError } = await adminClient
      .from("orders")
      .select(`
        id,
        order_number,
        total_amount,
        currency,
        status,
        payment_status,
        created_at,
        order_items (
          id,
          product_name,
          quantity,
          unit_price,
          total_price
        )
      `)
      .or(`user_id.eq.${user.id},customer_email.eq.${user.email.toLowerCase()}`)
      .order("created_at", { ascending: false });

    // 2. Fetch all download entitlements for user
    const { data: entitlements, error: entError } = await adminClient
      .from("download_entitlements")
      .select(`
        id,
        order_id,
        token,
        download_count,
        download_limit,
        expires_at,
        is_active,
        is_revoked,
        created_at,
        digital_assets (
          id,
          file_name,
          mime_type,
          file_size_bytes,
          file_version,
          products (
            id,
            name,
            slug,
            cover_image_url
          )
        ),
        orders (
          id,
          order_number,
          created_at
        )
      `)
      .or(`user_id.eq.${user.id},customer_email.eq.${user.email.toLowerCase()}`)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
      orders: orders || [],
      entitlements: entitlements || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to load customer library." },
      { status: 500 }
    );
  }
}
