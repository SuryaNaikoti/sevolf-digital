import crypto from "crypto";
import { NextResponse } from "next/server";
import { processOutboxBatch } from "@/services/workers/outboxWorker";

/**
 * Worker cron endpoint. Can be triggered by Supabase pg_cron, Vercel Cron, or an external scheduler.
 * Strictly secured by WORKER_SECRET header using constant-time comparison.
 */
export async function POST(request: Request) {
  const expectedSecret = process.env.WORKER_SECRET;

  if (!expectedSecret || expectedSecret.trim().length === 0) {
    return NextResponse.json(
      { error: "Service unavailable." },
      { status: 503 }
    );
  }

  const providedSecret =
    request.headers.get("x-worker-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!providedSecret) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  // Constant-time comparison
  const expBuf = Buffer.from(expectedSecret);
  const provBuf = Buffer.from(providedSecret);

  if (expBuf.length !== provBuf.length || !crypto.timingSafeEqual(expBuf, provBuf)) {
    return NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  const result = await processOutboxBatch(10, 120);

  return NextResponse.json({
    success: true,
    ...result,
  });
}
