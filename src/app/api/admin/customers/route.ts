import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const { adminClient } = auth.context;

    // Fetch registered customer profiles with role information
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        country,
        avatar_url,
        created_at,
        updated_at,
        roles!inner (
          id,
          name
        )
      `)
      .order("created_at", { ascending: false });

    if (profilesError) {
      console.error("[Admin Customers API] Profiles Error:", profilesError);
      return NextResponse.json(
        { error: "Failed to retrieve customers from database." },
        { status: 500 }
      );
    }

    // Fetch order aggregation per customer email/user_id
    const { data: orders, error: ordersError } = await adminClient
      .from("orders")
      .select("id, user_id, customer_email, total_amount, currency, status, created_at");

    if (ordersError) {
      console.error("[Admin Customers API] Orders Error:", ordersError);
    }

    const orderList = orders || [];

    // Map profiles into enriched customer records
    const customers = (profiles || []).map((prof: any) => {
      const customerOrders = orderList.filter(
        (o: any) => o.user_id === prof.id || (o.customer_email && o.customer_email.toLowerCase() === prof.email.toLowerCase())
      );
      const paidOrders = customerOrders.filter((o: any) => o.status === "paid" || o.status === "fulfilled");
      const totalSpent = paidOrders.reduce((acc: number, curr: any) => acc + Number(curr.total_amount || 0), 0);

      return {
        id: prof.id,
        email: prof.email,
        fullName: prof.full_name || "Guest / Anonymous",
        country: prof.country || "India",
        role: Array.isArray(prof.roles) ? prof.roles[0]?.name : prof.roles?.name || "customer",
        ordersCount: customerOrders.length,
        paidOrdersCount: paidOrders.length,
        totalSpent,
        currency: paidOrders[0]?.currency || "INR",
        createdAt: prof.created_at,
        lastActiveAt: prof.updated_at || prof.created_at,
      };
    });

    return NextResponse.json({
      customers,
      totalCount: customers.length,
    });
  } catch (err: any) {
    console.error("[Admin Customers API] Unexpected Error:", err);
    return NextResponse.json(
      { error: "Internal server error fetching customers." },
      { status: 500 }
    );
  }
}
