// Shared admin-session helpers. Uses the Web Crypto global (`crypto.subtle`)
// rather than Node's `crypto` module so this works unchanged in both
// Route Handlers (Node runtime) and Middleware (Edge runtime).
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** The cookie value a valid admin session must carry, derived from ADMIN_PASSWORD. */
export async function computeAdminToken(): Promise<string | null> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  return sha256Hex(`pro-ctcae-admin:${secret}`);
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const expected = await computeAdminToken();
  const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  return !!expected && cookie === expected;
}
