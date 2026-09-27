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
  const rows = await sql`SELECT * FROM participants ORDER BY applied_at DESC LIMIT 200`;
  return serialize(rows) as AdminParticipant[];
}

export async function adminAssignPatientCode(id: string, patientCode: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!isUuid(id) || !code || code.length > 32) return { ok: false };
  await sql`UPDATE participants SET patient_code = ${code} WHERE id = ${id}`;
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
