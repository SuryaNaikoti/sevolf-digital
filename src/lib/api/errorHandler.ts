import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Maps database errors and exceptions to safe, sanitized user-facing JSON responses
 * without exposing raw PostgreSQL identifiers, query text, or credentials.
 */
export function handleApiError(err: any, fallbackMessage = "An unexpected error occurred."): NextResponse {
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((i) => ({
      field: i.path.join("."),
      message: i.message,
    }));
    return NextResponse.json(
      {
        error: "Validation failed. Please verify request parameters.",
        details: formattedErrors,
        code: "VALIDATION_ERROR",
      },
      { status: 400 }
    );
  }

  // Log full internal error details securely to server stdout
  console.error("[AdminApiError]", {
    message: err?.message,
    code: err?.code,
    stack: err?.stack,
  });

  // 2. PostgreSQL / Supabase Error Codes
  const dbCode = err?.code || "";
  if (dbCode === "23505") {
    // Unique violation
    return NextResponse.json(
      {
        error: "A record with this identifier or unique value already exists.",
        code: "RECORD_CONFLICT",
      },
      { status: 409 }
    );
  }

  if (dbCode === "23503") {
    // Foreign key violation
    return NextResponse.json(
      {
        error: "Referenced related entity does not exist or has been removed.",
        code: "INVALID_FOREIGN_KEY",
      },
      { status: 400 }
    );
  }

  if (dbCode === "22P02") {
    // Invalid text representation (e.g. invalid UUID format)
    return NextResponse.json(
      {
        error: "Invalid parameter format provided in request.",
        code: "INVALID_FORMAT",
      },
      { status: 400 }
    );
  }

  // 3. Fallback generic response
  return NextResponse.json(
    {
      error: fallbackMessage,
      code: "INTERNAL_SERVER_ERROR",
    },
    { status: 500 }
  );
}
