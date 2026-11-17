// Server-only: gathers everything the clinic hand-out needs for one patient.
// Used by both the admin route (/api/admin/report/<code>) and `npm run report`,
// so the two always produce the same document from the same data.

import { createHash } from "crypto";
import { sql } from "./db";
import type { NotesSummary } from "./notesSummary";
import { parseSex, type Sex } from "./questions";
import {
  REPORT_TEMPLATE_VERSION,
  type ReportAnswer,
  type ReportInput,
  type ReportLang,
  type ReportPeriod,
  type ReportSession,
} from "./report";

export type LoadReportOptions = {
  /** The date printed as 작성일 (default: now). Pass it to regenerate a document for a past date. */
  asOf?: Date;
  autoPrint?: boolean;
  /** Kept for compatibility; the hand-out no longer prints notes, so this has no effect. */
  sampleNotes?: boolean;
  /** Language of the document and of the notes summary (default Korean). */
  lang?: ReportLang;
  /** "all" prints every survey instead of the latest 항암 cycle. */
  range?: "cycle" | "all";
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

const kstYmd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

/** First hand-out: Baseline … 2주차. */
const FIRST_REPORT_SURVEYS = 3;
/** A cycle's hand-out starts this many days before the latest 항암일 (to include the pre-treatment survey). */
const CYCLE_LEAD_DAYS = 7;

export async function loadReportInput(code: string, opts: LoadReportOptions = {}): Promise<ReportInput | null> {
  const [person] = await sql`SELECT name, gender FROM participants WHERE patient_code = ${code} ORDER BY applied_at LIMIT 1`;
  if (!person) return null;

  const asOfDay = kstYmd(opts.asOf ?? new Date());
  const all = (
    await sql`
      SELECT id, completed_at FROM survey_sessions
      WHERE patient_code = ${code} AND survey_type = 'pro_ctcae' AND is_complete = TRUE
      ORDER BY completed_at ASC
    `
  )
    .map((s, i) => ({
      id: String(s.id),
      completed_at: s.completed_at instanceof Date ? s.completed_at.toISOString() : (s.completed_at as string | null),
      week: i,
    }))
    .filter((s) => !s.completed_at || kstYmd(new Date(s.completed_at)) <= asOfDay) as ReportSession[];

  // Which surveys the hand-out covers:
  //  - before any 항암일 is on file (first visit): Baseline … 2주차
  //  - otherwise: from 1 week before the latest 항암일 up to the print date. A 항암일 on the print date itself
  //    is the visit the document is for (treatment comes after the doctor reads it), so it does not count yet.
  // 항암일 = researcher-entered dates (chemo_dates) + the 마지막 투여일 patients report in the 증상 설문 (adc_doses).
  const chemoDates = (
    await sql`
      SELECT chemo_date::text AS d FROM chemo_dates WHERE patient_code = ${code}
      UNION
      SELECT dose_date::text AS d FROM adc_doses WHERE patient_code = ${code} AND dose_date IS NOT NULL
      ORDER BY d
    `
  ).map((r) => String(r.d));
  const lastChemo = chemoDates.filter((d) => d < asOfDay).at(-1) ?? null;
  let sessions: ReportSession[];
  let period: ReportPeriod;
  if (opts.range === "all") {
    sessions = all;
    period = { mode: "all", chemo: lastChemo, chemoDates, asOf: asOfDay };
  } else if (lastChemo) {
    const from = addDays(lastChemo, -CYCLE_LEAD_DAYS);
    // A survey exactly 7 days before covers the week before that, so the window starts the day after.
    sessions = all.filter((s) => s.completed_at && kstYmd(new Date(s.completed_at)) > from);
    period = { mode: "cycle", chemo: lastChemo, chemoDates, asOf: asOfDay };
  } else {
    sessions = all.slice(0, FIRST_REPORT_SURVEYS);
    period = { mode: "first", chemo: null, chemoDates, asOf: asOfDay };
  }

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
    SELECT body FROM nursing_notes WHERE patient_code = ${code} AND body <> '' ORDER BY note_date DESC, created_at DESC
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
    period,
    generatedAt: opts.asOf,
    autoPrint: opts.autoPrint,
    dataId: dataId(code, lang, sex, sessions, answers, notesText + `|${period.mode}|${chemoDates.join(",")}`),
  };
}
