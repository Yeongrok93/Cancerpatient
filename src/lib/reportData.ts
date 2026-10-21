// Server-only: gathers everything the clinic hand-out needs for one patient.
// Used by both the admin route (/api/admin/report/<code>) and `npm run report`,
// so the two always produce the same document from the same data.

import { createHash } from "crypto";
import { sql } from "./db";
import { getNotesSummary, type NotesSummary } from "./notesSummary";
import { parseSex, type Sex } from "./questions";
import { REPORT_TEMPLATE_VERSION, type ReportAnswer, type ReportInput, type ReportLang, type ReportSession } from "./report";

const SAMPLE_NOTES = [
  "- (샘플) 항암 치료가 길어지며 피로와 의욕 저하를 호소함.",
  "- (샘플) 진료 간격이 길어 증상 변화를 상담할 기회가 적다고 느낌.",
  "- (샘플) 증상이 심해질 때 어디로 연락해야 하는지 안내를 원함.",
].join("\n");

const SAMPLE_NOTES_EN = [
  "- (Sample) Reports fatigue and low motivation as chemotherapy continues.",
  "- (Sample) Visits are far apart, so there is little chance to discuss symptom changes.",
  "- (Sample) Wants to know whom to contact when symptoms worsen.",
].join("\n");

export type LoadReportOptions = {
  /** The date printed as 작성일 (default: now). Pass it to regenerate a document for a past date. */
  asOf?: Date;
  autoPrint?: boolean;
  /** Layout preview with made-up notes instead of the real summary. */
  sampleNotes?: boolean;
  /** Language of the document and of the notes summary (default Korean). */
  lang?: ReportLang;
};

/** Short fingerprint of what is printed, so two copies can be compared at a glance. */
function dataId(code: string, lang: ReportLang, sex: Sex | null, sessions: ReportSession[], answers: ReportAnswer[], notes: NotesSummary): string {
  const canonAnswers = answers
    .map((a) => `${a.session_id}|${a.item_id}|${a.question_key}|${a.answer_value ?? ""}`)
    .sort();
  const summaryText = notes.kind === "summary" || notes.kind === "sample" ? notes.text : `(${notes.kind})`;
  const payload = JSON.stringify({
    v: REPORT_TEMPLATE_VERSION,
    code,
    lang,
    sex,
    sessions: sessions.map((s) => `${s.id}|${s.completed_at}`),
    answers: canonAnswers,
    summary: summaryText,
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

  const noteRows = await sql`
    SELECT note_date::text AS note_date, body FROM nursing_notes
    WHERE patient_code = ${code} ORDER BY note_date DESC, created_at DESC
  `;
  const lang: ReportLang = opts.lang ?? "ko";
  const notes: NotesSummary = opts.sampleNotes
    ? { kind: "sample", text: lang === "en" ? SAMPLE_NOTES_EN : SAMPLE_NOTES }
    : await getNotesSummary(code, noteRows.map((n) => ({ note_date: String(n.note_date), body: String(n.body) })), lang);

  const sex = parseSex(person.gender);
  return {
    code,
    name: String(person.name ?? ""),
    sex,
    lang,
    sessions,
    answers,
    notes,
    generatedAt: opts.asOf,
    autoPrint: opts.autoPrint,
    dataId: dataId(code, lang, sex, sessions, answers, notes),
  };
}
