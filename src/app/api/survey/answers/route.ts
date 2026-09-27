import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { SURVEY_ITEMS } from "@/lib/questions";

// PRO-CTCAE answer upsert. Goes through the service role because the anon
// role has INSERT but no UPDATE policy on survey_answers — a client-side
// upsert that changes an already-saved answer fails RLS, so edits (going back
// a category, or resuming) were silently dropped.
//
// Only item_id / question_key / value come from the client; item_term_en and
// question_type are looked up from SURVEY_ITEMS so they can't be forged.

type IncomingRow = { item_id: number; question_key: string; value: number | boolean };

const QUESTIONS = new Map(
  SURVEY_ITEMS.flatMap((item) =>
    item.questions.map((q) => [`${item.id}-${q.key}`, { item, q }] as const)
  )
);

export async function POST(req: NextRequest) {
  const { sessionId, rows } = (await req.json().catch(() => ({}))) as {
    sessionId?: string;
    rows?: IncomingRow[];
  };
  if (!sessionId || !Array.isArray(rows) || rows.length === 0 || rows.length > 200) {
    return NextResponse.json({ error: "sessionId and rows are required" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const { data: session, error: sessionError } = await admin
    .from("survey_sessions")
    .select("survey_type, is_complete")
    .eq("id", sessionId)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ error: sessionError.message }, { status: 500 });
  if (!session || session.survey_type !== "pro_ctcae") {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }
  if (session.is_complete) {
    return NextResponse.json({ error: "session already submitted" }, { status: 409 });
  }

  const records = [];
  for (const r of rows) {
    const entry = QUESTIONS.get(`${r?.item_id}-${r?.question_key}`);
    if (!entry) return NextResponse.json({ error: "unknown question" }, { status: 400 });
    const { item, q } = entry;
    const isPresence = q.type === "presence";
    const valid = isPresence
      ? typeof r.value === "boolean"
      : Number.isInteger(r.value) && (r.value as number) >= 0 && (r.value as number) <= 4;
    if (!valid) return NextResponse.json({ error: "invalid value" }, { status: 400 });
    records.push({
      session_id: sessionId,
      item_id: item.id,
      item_term_en: item.termEn,
      question_key: q.key,
      question_type: q.type,
      answer_value: isPresence ? null : (r.value as number),
      answer_boolean: isPresence ? (r.value as boolean) : null,
    });
  }

  const { error } = await admin
    .from("survey_answers")
    .upsert(records, { onConflict: "session_id,item_id,question_key" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
