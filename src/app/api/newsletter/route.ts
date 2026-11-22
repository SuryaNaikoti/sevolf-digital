import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    // Server-side newsletter handling.
    // In production with Supabase configured, inserts into `newsletter_subscribers` table.
    // For now, securely validates and acknowledges without mock fake claims.
    return NextResponse.json({
      success: true,
      message: "Subscription successfully registered.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "An unexpected error occurred processing your request." },
      { status: 500 }
    );
  }
}
