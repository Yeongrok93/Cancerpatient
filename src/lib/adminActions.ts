"use server";

// Admin-only server actions. Middleware guards the /admin pages, but a
// server action can be invoked from any route, so every action here checks
// the admin session cookie itself.

import { cookies } from "next/headers";
import { sql, serialize, isUuid } from "./db";
import { ADMIN_COOKIE_NAME, isAdminToken } from "./adminAuth";
import { parseSex, type Sex } from "./questions";

async function requireAdmin() {
  const cookie = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!(await isAdminToken(cookie))) throw new Error("unauthorized");
}

export type AdminParticipant = {
  id: string;
  name: string;
  record_or_birth: string;
  contact: string;
  research_types: string | null;
  consent_agreed: boolean;
  applied_at: string;
  patient_code: string | null;
  sms_notified: boolean | null;
  sms_error: string | null;
  study_start_date: string | null;
  access_token: string | null;
  enrolled: boolean;
  enrolled_at: string | null;
  gender: Sex | null;
};

export type AdminMessage = {
  id: string;
  patient_code: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

export type AdminPatient = { patient_code: string; name: string };

/** Everyone with a participant code, in numeric order (001, 002, …). */
export async function adminListPatients(): Promise<AdminPatient[]> {
  await requireAdmin();
  const rows = await sql`
    SELECT DISTINCT ON (patient_code) patient_code, name
    FROM participants WHERE patient_code IS NOT NULL AND trim(patient_code) <> ''
    ORDER BY patient_code, applied_at
  `;
  const patients = rows.map((r) => ({ patient_code: String(r.patient_code), name: String(r.name ?? "") }));
  const isNum = (c: string) => /^\d+$/.test(c);
  patients.sort((a, b) =>
    isNum(a.patient_code) && isNum(b.patient_code)
      ? Number(a.patient_code) - Number(b.patient_code)
      : a.patient_code.localeCompare(b.patient_code, "ko")
  );
  return patients;
}

export async function adminListParticipants(): Promise<AdminParticipant[]> {
  await requireAdmin();
  const rows = await sql`
    SELECT id, name, record_or_birth, contact, research_types, consent_agreed, applied_at,
           patient_code, sms_notified, sms_error, study_start_date::text AS study_start_date, access_token,
           enrolled, enrolled_at, gender
    FROM participants ORDER BY applied_at DESC LIMIT 200
  `;
  return serialize(rows) as AdminParticipant[];
}

export async function adminAssignPatientCode(id: string, patientCode: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!isUuid(id) || !code || code.length > 32) return { ok: false };
  await sql`UPDATE participants SET patient_code = ${code} WHERE id = ${id}`;
  return { ok: true };
}

/** 성별. Decides which PRO-CTCAE questions are asked. Empty clears it (all questions are then shown). */
export async function adminSetGender(id: string, gender: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const value = String(gender ?? "").trim();
  const sex = parseSex(value);
  if (!isUuid(id) || (value !== "" && !sex)) return { ok: false };
  await sql`UPDATE participants SET gender = ${sex} WHERE id = ${id}`;
  return { ok: true };
}

/** 연구참여시작일 (YYYY-MM-DD). The 12-week 삶의 질 windows count from it. Empty clears it. */
export async function adminSetStudyStartDate(id: string, date: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const value = String(date ?? "").trim();
  if (!isUuid(id) || (value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(value))) return { ok: false };
  if (value === "") await sql`UPDATE participants SET study_start_date = NULL WHERE id = ${id}`;
  else await sql`UPDATE participants SET study_start_date = ${value}::date WHERE id = ${id}`;
  return { ok: true };
}

/** 연구참여 확인 — only enrolled participants get automated reminders. */
export async function adminSetEnrolled(id: string, enrolled: boolean): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false };
  if (enrolled) await sql`UPDATE participants SET enrolled = TRUE, enrolled_at = COALESCE(enrolled_at, NOW()) WHERE id = ${id}`;
  else await sql`UPDATE participants SET enrolled = FALSE, enrolled_at = NULL WHERE id = ${id}`;
  return { ok: true };
}

export async function adminListMessages(): Promise<AdminMessage[]> {
  await requireAdmin();
  const rows = await sql`
    SELECT id, patient_code, message, created_at, is_read
    FROM patient_messages ORDER BY created_at DESC LIMIT 200
  `;
  return serialize(rows) as AdminMessage[];
}

export async function adminUnreadMessageCount(): Promise<number> {
  await requireAdmin();
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM patient_messages WHERE is_read = FALSE`;
  return n;
}

export async function adminSetMessageRead(id: string, isRead: boolean): Promise<void> {
  await requireAdmin();
  if (!isUuid(id)) return;
  await sql`UPDATE patient_messages SET is_read = ${!!isRead} WHERE id = ${id}`;
}

export type DashboardSession = { id: string; completed_at: string | null };
export type DashboardAnswer = {
  session_id: string;
  item_id: number;
  question_key: string;
  question_type: string;
  answer_value: number | null;
  answer_boolean: boolean | null;
};

export async function adminGetPatientDashboard(patientCode: string): Promise<{
  name: string;
  sex: Sex | null;
  sessions: DashboardSession[];
  answers: DashboardAnswer[];
}> {
  await requireAdmin();
  const [person] = await sql`
    SELECT name, gender FROM participants WHERE patient_code = ${patientCode} ORDER BY applied_at LIMIT 1
  `;
  const name = String(person?.name ?? "");
  const sex = parseSex(person?.gender);
  const sessions = await sql`
    SELECT id, completed_at FROM survey_sessions
    WHERE patient_code = ${patientCode} AND survey_type = 'pro_ctcae' AND is_complete = TRUE
    ORDER BY completed_at ASC
  `;
  if (sessions.length === 0) return { name, sex, sessions: [], answers: [] };
  const answers = await sql`
    SELECT session_id, item_id, question_key, question_type, answer_value, answer_boolean FROM survey_answers
    WHERE session_id = ANY(${sessions.map((x) => x.id)}::uuid[])
  `;
  return {
    name,
    sex,
    sessions: serialize(sessions) as DashboardSession[],
    answers: answers as DashboardAnswer[],
  };
}

// ── Researcher Notes (per patient, free text + date; stored in the nursing_notes table) ──────────────────

export type ResearcherNote = {
  id: string;
  patient_code: string;
  note_date: string; // YYYY-MM-DD
  body: string;
  created_at: string;
  updated_at: string;
};

const MAX_NOTE_LENGTH = 20000;

function cleanNote(date: string, body: string): { date: string; body: string } | null {
  const d = String(date ?? "").trim();
  const b = String(body ?? "").replace(/\s+$/, "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)) || !b.trim() || b.length > MAX_NOTE_LENGTH) return null;
  return { date: d, body: b };
}

export async function adminListNotes(patientCode: string): Promise<ResearcherNote[]> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!code) return [];
  const rows = await sql`
    SELECT id, patient_code, note_date::text AS note_date, body, created_at, updated_at
    FROM nursing_notes WHERE patient_code = ${code}
    ORDER BY note_date DESC, created_at DESC
  `;
  return serialize(rows) as ResearcherNote[];
}

export async function adminAddNote(
  patientCode: string,
  date: string,
  body: string
): Promise<{ ok: true; note: ResearcherNote } | { ok: false; error: string }> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  const note = cleanNote(date, body);
  if (!code || !note) return { ok: false, error: "날짜와 내용을 확인해 주세요." };
  const [known] = await sql`SELECT 1 FROM participants WHERE patient_code = ${code} LIMIT 1`;
  if (!known) return { ok: false, error: "알 수 없는 환자입니다." };
  const [row] = await sql`
    INSERT INTO nursing_notes (patient_code, note_date, body)
    VALUES (${code}, ${note.date}::date, ${note.body})
    RETURNING id, patient_code, note_date::text AS note_date, body, created_at, updated_at
  `;
  return { ok: true, note: serialize([row])[0] as ResearcherNote };
}

export async function adminUpdateNote(
  id: string,
  date: string,
  body: string
): Promise<{ ok: true; note: ResearcherNote } | { ok: false; error: string }> {
  await requireAdmin();
  const note = cleanNote(date, body);
  if (!isUuid(id) || !note) return { ok: false, error: "날짜와 내용을 확인해 주세요." };
  const rows = await sql`
    UPDATE nursing_notes SET note_date = ${note.date}::date, body = ${note.body}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, patient_code, note_date::text AS note_date, body, created_at, updated_at
  `;
  if (rows.length === 0) return { ok: false, error: "노트를 찾을 수 없습니다." };
  return { ok: true, note: serialize(rows)[0] as ResearcherNote };
}

export async function adminDeleteNote(id: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  if (!isUuid(id)) return { ok: false };
  await sql`DELETE FROM nursing_notes WHERE id = ${id}`;
  return { ok: true };
}
