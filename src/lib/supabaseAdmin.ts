// Server-only Supabase client using the service_role key — bypasses RLS
// entirely. Only import this from Route Handlers gated by isAdminRequest().
// Never import from a "use client" component or any code reachable by the
// browser bundle.
import { createClient } from "@supabase/supabase-js";

export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin client is not configured (missing URL or SUPABASE_SERVICE_ROLE)");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
