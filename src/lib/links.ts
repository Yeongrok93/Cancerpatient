// Server-only helpers for per-patient survey links (/s/<token>/<type>).
// Not a "use server" file on purpose: these must not be callable from the browser.

import { sql } from "./db";

const TOKEN_RE = /^[0-9a-f]{64}$/;

/** Participant code for a link token, or null if the token is unknown. */
export async function patientCodeFromToken(token: string): Promise<string | null> {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const rows = await sql`
    SELECT patient_code FROM participants WHERE access_token = ${token} AND patient_code IS NOT NULL LIMIT 1
  `;
  return rows[0]?.patient_code ?? null;
}
