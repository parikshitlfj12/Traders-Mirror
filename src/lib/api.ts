import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { UnauthorizedError } from "./auth";

// =============================================================================
// API response envelope (PRD §4 decision #11 / §9 spec)
// All API routes return { data, error } shape. No bare returns.
// =============================================================================

export type ApiOk<T> = { data: T; error: null };
export type ApiErr = {
  data: null;
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
};
export type ApiEnvelope<T> = ApiOk<T> | ApiErr;

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json<ApiOk<T>>({ data, error: null }, init);
}

export function err(
  message: string,
  status = 400,
  code?: string,
  details?: unknown,
): NextResponse<ApiErr> {
  return NextResponse.json<ApiErr>(
    { data: null, error: { message, code, details } },
    { status },
  );
}

// =============================================================================
// Typed application errors that map cleanly to HTTP responses.
// =============================================================================

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// =============================================================================
// Helpers used inside route handlers
// =============================================================================

/**
 * Parse JSON body and validate it with a Zod schema. Throws ApiError on a
 * malformed body, ZodError on schema mismatch — both caught by `handle`.
 */
export async function parseJson<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400, "INVALID_JSON");
  }
  return schema.parse(raw);
}

// Next.js uses thrown errors as control flow for redirect(), notFound() and
// dynamic-rendering bailouts. The wrapper MUST re-throw these or the
// framework can't react to them.
function isNextControlFlow(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest !== "string") return false;
  return (
    digest.startsWith("NEXT_REDIRECT") ||
    digest === "NEXT_NOT_FOUND" ||
    digest === "DYNAMIC_SERVER_USAGE"
  );
}

/**
 * Wrap an async route handler so any thrown ApiError / ZodError /
 * UnauthorizedError becomes a properly-shaped { data: null, error } response.
 * Anything else logs and 500s — never leak stack traces to the client.
 */
export function handle<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (isNextControlFlow(e)) throw e;
      if (e instanceof ApiError) {
        return err(e.message, e.status, e.code, e.details);
      }
      if (e instanceof ZodError) {
        return err("Validation failed", 422, "VALIDATION", e.flatten());
      }
      if (e instanceof UnauthorizedError) {
        return err("Unauthorized", 401, "UNAUTHORIZED");
      }
      console.error("[api] unhandled error", e);
      return err("Internal server error", 500, "INTERNAL");
    }
  };
}
