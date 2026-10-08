"use server";

// Admin-only server actions. Middleware guards the /admin pages, but a
// server action can be invoked from any route, so every action here checks
// the admin session cookie itself.

import { cookies } from "next/headers";
import { sql, serialize, isUuid } from "./db";
import { ADMIN_COOKIE_NAME, isAdminToken } from "./adminAuth";

async function requireAdmin() {
  const cookie = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;
  if (!(await isAdminToken(cookie))) throw new Error("unauthorized");
}

export type AdminSession = {
  id: string;
  patient_code: string | null;
  survey_type: string | null;
  age: number | null;
  gender: string | null;
  cancer_type: string | null;
  treatment_type: string | null;
  started_at: string;
  completed_at: string | null;
  is_complete: boolean;
  additional_comments: string | null;
};

export type AdminAnswer = {
  item_id: number;
  question_key: string;
  question_type: string;
  answer_value: number | null;
  answer_boolean: boolean | null;
};

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
};

export type AdminMessage = {
  id: string;
  patient_code: string;
  message: string;
  created_at: string;
  is_read: boolean;
};

export async function adminListSessions(): Promise<AdminSession[]> {
  await requireAdmin();
  const rows = await sql`
    SELECT id, patient_code, survey_type, age, gender, cancer_type, treatment_type,
           started_at, completed_at, is_complete, additional_comments
    FROM survey_sessions ORDER BY started_at DESC LIMIT 200
  `;
  return serialize(rows) as AdminSession[];
}

export async function adminGetSessionAnswers(sessionId: string): Promise<AdminAnswer[]> {
  await requireAdmin();
  if (!isUuid(sessionId)) return [];
  const rows = await sql`
    SELECT item_id, question_key, question_type, answer_value, answer_boolean
    FROM survey_answers WHERE session_id = ${sessionId} ORDER BY item_id, question_key
  `;
  return rows as AdminAnswer[];
}

export async function adminListParticipants(): Promise<AdminParticipant[]> {
  await requireAdmin();
  const rows = await sql`
    SELECT id, name, record_or_birth, contact, research_types, consent_agreed, applied_at,
           patient_code, sms_notified, sms_error, study_start_date::text AS study_start_date, access_token,
           enrolled, enrolled_at
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

export type NotifyRecipient = { id: string; name: string; phone: string; active: boolean };

export async function adminListRecipients(): Promise<NotifyRecipient[]> {
  await requireAdmin();
  const rows = await sql`SELECT id, name, phone, active FROM notify_recipients ORDER BY created_at`;
  return rows as NotifyRecipient[];
}

export async function adminAddRecipient(name: string, phone: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (!/^01\d{8,9}$/.test(digits)) return { ok: false, error: "휴대폰 번호 형식이 올바르지 않습니다." };
  const label = String(name ?? "").trim().slice(0, 50);
  await sql`INSERT INTO notify_recipients (name, phone) VALUES (${label}, ${digits}) ON CONFLICT (phone) DO UPDATE SET name = EXCLUDED.name, active = TRUE`;
  return { ok: true };
}

export async function adminSetRecipientActive(id: string, active: boolean): Promise<void> {
  await requireAdmin();
  if (!isUuid(id)) return;
  await sql`UPDATE notify_recipients SET active = ${!!active} WHERE id = ${id}`;
}

export async function adminDeleteRecipient(id: string): Promise<void> {
  await requireAdmin();
  if (!isUuid(id)) return;
  await sql`DELETE FROM notify_recipients WHERE id = ${id}`;
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

export async function adminGetPatientDashboard(patientCode: string): Promise<{
  sessions: { id: string; completed_at: string | null; age: number | null; gender: string | null }[];
  answers: { session_id: string; item_id: number; question_key: string; question_type: string; answer_value: number | null }[];
}> {
  await requireAdmin();
  const sessions = await sql`
    SELECT id, completed_at, age, gender FROM survey_sessions
    WHERE patient_code = ${patientCode} AND survey_type = 'pro_ctcae' AND is_complete = TRUE
    ORDER BY completed_at ASC
  `;
  if (sessions.length === 0) return { sessions: [], answers: [] };
  const answers = await sql`
    SELECT session_id, item_id, question_key, question_type, answer_value FROM survey_answers
    WHERE session_id = ANY(${sessions.map((s) => s.id)}::uuid[])
  `;
  return {
    sessions: serialize(sessions) as { id: string; completed_at: string | null; age: number | null; gender: string | null }[],
    answers: answers as { session_id: string; item_id: number; question_key: string; question_type: string; answer_value: number | null }[],
  };
}
