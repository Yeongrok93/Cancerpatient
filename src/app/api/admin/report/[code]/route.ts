import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/adminAuth";
import { sql } from "@/lib/db";
import { renderReportHtml, type ReportAnswer, type ReportSession } from "@/lib/report";
import { summarizeNotes, type NotesSummary } from "@/lib/notesSummary";

// Clinic hand-out for one patient. Admin-only (this route is outside the /admin
// proxy matcher, so it checks the session cookie itself).
//   GET /api/admin/report/<code>            → printable HTML ("PDF로 저장" from the browser)
//   ?print=1                                → also opens the print dialog on load
//   ?sample=1                               → layout preview with made-up notes; only when
//                                             ALLOW_REPORT_SAMPLE=1 (local use)

export const dynamic = "force-dynamic";

const SAMPLE_NOTES = [
  "- (샘플) 항암 치료가 길어지며 피로와 의욕 저하를 호소함.",
  "- (샘플) 진료 간격이 길어 증상 변화를 상담할 기회가 적다고 느낌.",
  "- (샘플) 증상이 심해질 때 어디로 연락해야 하는지 안내를 원함.",
].join("\n");

export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const code = decodeURIComponent((await params).code ?? "").trim();
  if (!code) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const [person] = await sql`SELECT name FROM participants WHERE patient_code = ${code} ORDER BY applied_at LIMIT 1`;
  if (!person) return NextResponse.json({ error: "not found" }, { status: 404 });

  const sessions = (await sql`
    SELECT id, completed_at FROM survey_sessions
    WHERE patient_code = ${code} AND survey_type = 'pro_ctcae' AND is_complete = TRUE
    ORDER BY completed_at ASC
  `).map((s) => ({ id: String(s.id), completed_at: s.completed_at instanceof Date ? s.completed_at.toISOString() : s.completed_at })) as ReportSession[];

  const answers = (sessions.length === 0
    ? []
    : await sql`
        SELECT session_id, item_id, question_key, question_type, answer_value FROM survey_answers
        WHERE session_id = ANY(${sessions.map((s) => s.id)}::uuid[])
      `) as ReportAnswer[];

  const notes = await sql`
    SELECT note_date::text AS note_date, body FROM nursing_notes WHERE patient_code = ${code} ORDER BY note_date DESC, created_at DESC
  `;

  const url = req.nextUrl;
  let summary: NotesSummary;
  if (url.searchParams.get("sample") === "1" && process.env.ALLOW_REPORT_SAMPLE === "1") {
    summary = { kind: "sample", text: SAMPLE_NOTES };
  } else {
    summary = await summarizeNotes(notes.map((n) => ({ note_date: String(n.note_date), body: String(n.body) })));
  }

  const html = renderReportHtml({
    code,
    name: String(person.name ?? ""),
    sessions,
    answers,
    notes: summary,
    autoPrint: url.searchParams.get("print") === "1",
  });

  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
