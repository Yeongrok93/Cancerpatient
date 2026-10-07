// Shared admin-session helpers. Uses the Web Crypto global (`crypto.subtle`)
// rather than Node's `crypto` module so this works unchanged in both
// Route Handlers (Node runtime) and Middleware (Edge runtime).
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";
export const ADMIN_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const encoder = new TextEncoder();

/** Admin login id. Defaults to "admin"; override with ADMIN_USERNAME. */
export function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME || "admin";
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return toHex(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
}

/** Constant-time string comparison (hashes first so length doesn't leak). */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([hmacHex("cmp", a), hmacHex("cmp", b)]);
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha.charCodeAt(i) ^ hb.charCodeAt(i);
  return diff === 0;
}

/** Checks the submitted id + password against ADMIN_USERNAME / ADMIN_PASSWORD. */
export async function verifyAdminCredentials(username: unknown, password: unknown): Promise<boolean> {
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword || typeof username !== "string" || typeof password !== "string") return false;
  // Evaluate both so timing doesn't reveal which one was wrong.
  const [userOk, passOk] = await Promise.all([
    safeEqual(username, getAdminUsername()),
    safeEqual(password, expectedPassword),
  ]);
  return userOk && passOk;
}

/** The cookie value a valid admin session must carry (HMAC keyed by ADMIN_PASSWORD, bound to the admin id). */
export async function computeAdminToken(): Promise<string | null> {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) return null;
  return hmacHex(secret, `pro-ctcae-admin:${getAdminUsername()}`);
}

export async function isAdminToken(cookie: string | undefined): Promise<boolean> {
  const expected = await computeAdminToken();
  return !!expected && !!cookie && (await safeEqual(cookie, expected));
}

export async function isAdminRequest(req: NextRequest): Promise<boolean> {
  return isAdminToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value);
}
