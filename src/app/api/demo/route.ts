import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/auth/api-keys";
import { jsonError } from "@/lib/api-response";

/**
 * This is the endpoint the "My SaaS" demo app (see /demo) calls to prove
 * an AuthForge API key actually authenticates a request end-to-end. Any
 * real application integrating AuthForge would protect its own routes the
 * same way: read `Authorization: Bearer af_live_...`, call `verifyApiKey`,
 * and trust the returned user/organization.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return jsonError("Missing Authorization header.", 401);

  const apiKey = await verifyApiKey(token);
  if (!apiKey) return jsonError("Invalid or revoked API key.", 401);

  return NextResponse.json({
    message: `Hello, ${apiKey.user.name ?? apiKey.user.email}. This request was authenticated with API key "${apiKey.name}".`,
    authenticatedAs: { userId: apiKey.userId, email: apiKey.user.email },
    keyPrefix: apiKey.prefix,
    requestedAt: new Date().toISOString(),
  });
}
