// Server-only: gathers everything the clinic hand-out needs for one patient.
// Used by both the admin route (/api/admin/report/<code>) and `npm run report`,
// so the two always produce the same document from the same data.

import { createHash } from "crypto";
import { sql } from "./db";
import type { NotesSummary } from "./notesSummary";
import { parseSex, type Sex } from "./questions";
import { REPORT_TEMPLATE_VERSION, type ReportAnswer, type ReportInput, type ReportLang, type ReportSession } from "./report";

export type LoadReportOptions = {
  /** The date printed as 작성일 (default: now). Pass it to regenerate a document for a past date. */
  asOf?: Date;
  autoPrint?: boolean;
  /** Kept for compatibility; the hand-out no longer prints notes, so this has no effect. */
  sampleNotes?: boolean;
  /** Language of the document and of the notes summary (default Korean). */
  lang?: ReportLang;
};

/** Short fingerprint of what is printed, so two copies can be compared at a glance. */
function dataId(code: string, lang: ReportLang, sex: Sex | null, sessions: ReportSession[], answers: ReportAnswer[], notesText: string): string {
  const canonAnswers = answers
    .map((a) => `${a.session_id}|${a.item_id}|${a.question_key}|${a.answer_value ?? ""}`)
    .sort();
  const payload = JSON.stringify({
    v: REPORT_TEMPLATE_VERSION,
    code,
    lang,
    sex,
    sessions: sessions.map((s) => `${s.id}|${s.completed_at}`),
    answers: canonAnswers,
    notes: notesText ? createHash("sha256").update(notesText).digest("hex").slice(0, 12) : "",
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 10).toUpperCase();
}

export async function loadReportInput(code: string, opts: LoadReportOptions = {}): Promise<ReportInput | null> {
  const [person] = await sql`SELECT name, gender FROM participants WHERE patient_code = ${code} ORDER BY applied_at LIMIT 1`;
  if (!person) return null;

  const sessions = (
    await sql`
      SELECT id, completed_at FROM survey_sessions
      WHERE patient_code = ${code} AND survey_type = 'pro_ctcae' AND is_complete = TRUE
      ORDER BY completed_at ASC
    `
  ).map((s) => ({
    id: String(s.id),
    completed_at: s.completed_at instanceof Date ? s.completed_at.toISOString() : (s.completed_at as string | null),
  })) as ReportSession[];

  const answers = (
    sessions.length === 0
      ? []
      : await sql`
          SELECT session_id, item_id, question_key, question_type, answer_value FROM survey_answers
          WHERE session_id = ANY(${sessions.map((s) => s.id)}::uuid[])
        `
  ) as ReportAnswer[];

  const lang: ReportLang = opts.lang ?? "ko";
  // The notes are never printed on the hand-out. Their text only decides which symptoms are put first and
  // starred in the summary (matched by name, locally — nothing is sent to an API).
  const noteRows = await sql`
    SELECT body FROM nursing_notes WHERE patient_code = ${code} ORDER BY note_date DESC, created_at DESC
  `;
  const notesText = noteRows.map((n) => String(n.body)).join("\n");
  const notes: NotesSummary = { kind: "none" };

  const sex = parseSex(person.gender);
  return {
    code,
    name: String(person.name ?? ""),
    sex,
    lang,
    sessions,
    answers,
    notes,
    notesText,
    generatedAt: opts.asOf,
    autoPrint: opts.autoPrint,
    dataId: dataId(code, lang, sex, sessions, answers, notesText),
  };
}
