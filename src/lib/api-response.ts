import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ForbiddenError, UnauthorizedError } from "@/lib/auth/rbac";

/**
 * Every route handler funnels unexpected/expected errors through this so
 * the API never leaks stack traces or Prisma internals to the client, and
 * so status codes are consistent (400 validation, 401 auth, 403 rbac,
 * 500 fallback).
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Validation failed", issues: error.flatten().fieldErrors }, { status: 400 });
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  console.error("[api-error]", error);
  return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
