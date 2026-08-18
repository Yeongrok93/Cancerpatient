import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("participants")
    .select("*")
    .order("applied_at", { ascending: false })
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id, patient_code } = await req.json().catch(() => ({}));
  if (!id || typeof patient_code !== "string" || !patient_code.trim()) {
    return NextResponse.json({ error: "id and patient_code are required" }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from("participants")
    .update({ patient_code: patient_code.trim() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
