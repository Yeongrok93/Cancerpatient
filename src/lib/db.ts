import { neon } from "@neondatabase/serverless";

// Server-only Neon client. Never import this file from a "use client"
// component — the connection string must never reach the browser bundle.
// Only src/lib/actions.ts and src/lib/adminActions.ts ("use server") use it.
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV !== "development") {
  console.warn("DATABASE_URL is not set. Database calls will fail.");
}

export const sql = neon(databaseUrl ?? "postgres://placeholder@localhost/placeholder");

// The Neon driver returns timestamptz columns as Date objects and bigint
// counts as strings. Pages were written against ISO-string timestamps, so
// convert every Date before handing rows to the client.
export function serialize<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
    return out as T;
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
