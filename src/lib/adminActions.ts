"use server";

// Admin-only server actions. Middleware guards the /admin pages, but a
// server action can be invoked from any route, so every action here checks
// the admin session cookie itself.

import { cookies } from "next/headers";
import { sql, serialize, isUuid } from "./db";
import { ADMIN_COOKIE_NAME, isAdminToken } from "./adminAuth";
import { parseSex, type Sex } from "./questions";
import { NOTE_KIND_BY_KEY, parseNoteKind, type NoteKind } from "./noteKinds";
import {
  DEMOGRAPHICS,
  ECOG_KEY,
  ECOG_OPTIONS,
  EMERGENCY_SCREENING,
  IPAQ_ITEMS,
  SITTING_KEYS,
} from "./w0";

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
  remark: string | null;
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
           enrolled, enrolled_at, gender, remark
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

/** 비고 - free-text admin note on an applicant (e.g. 참여거부). Empty clears it. */
export async function adminSetRemark(id: string, remark: string): Promise<{ ok: boolean }> {
  await requireAdmin();
  const value = String(remark ?? "").trim();
  if (!isUuid(id) || value.length > 200) return { ok: false };
  await sql`UPDATE participants SET remark = ${value === "" ? null : value} WHERE id = ${id}`;
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

/** The latest 다음 외래 the patient entered in a 증상 설문 (date/time in Korea time), if any. */
export async function adminGetNextVisit(
  patientCode: string
): Promise<{ date: string; time: string; past: boolean } | null> {
  await requireAdmin();
  const [r] = await sql`
    SELECT visit_date::text AS date, to_char(visit_time, 'HH24:MI') AS time,
           (((visit_date + visit_time) AT TIME ZONE 'Asia/Seoul') <= NOW()) AS past
    FROM clinic_visits WHERE patient_code = ${patientCode}
    ORDER BY visit_date DESC, visit_time DESC LIMIT 1
  `;
  return r ? { date: String(r.date), time: String(r.time), past: Boolean(r.past) } : null;
}

// ── Researcher Notes (per patient, free text + date + kind; stored in the nursing_notes table) ──────────

export type ResearcherNote = {
  id: string;
  patient_code: string;
  note_date: string; // YYYY-MM-DD
  kind: NoteKind;
  body: string;
  created_at: string;
  updated_at: string;
};

const MAX_NOTE_LENGTH = 20000;

function cleanNote(date: string, body: string, kind: unknown): { date: string; body: string; kind: NoteKind } | null {
  const d = String(date ?? "").trim();
  const k = parseNoteKind(kind);
  const b = String(body ?? "").replace(/\s+$/, "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d)) || b.length > MAX_NOTE_LENGTH) return null;
  // A call / missed call / text can be logged with no text; everything else needs some.
  if (!b.trim() && !NOTE_KIND_BY_KEY[k].contact) return null;
  return { date: d, body: b, kind: k };
}

export async function adminListNotes(patientCode: string): Promise<ResearcherNote[]> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!code) return [];
  const rows = await sql`
    SELECT id, patient_code, note_date::text AS note_date, kind, body, created_at, updated_at
    FROM nursing_notes WHERE patient_code = ${code}
    ORDER BY note_date DESC, created_at DESC
  `;
  return serialize(rows) as ResearcherNote[];
}

export async function adminAddNote(
  patientCode: string,
  date: string,
  body: string,
  kind: NoteKind = "note"
): Promise<{ ok: true; note: ResearcherNote } | { ok: false; error: string }> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  const note = cleanNote(date, body, kind);
  if (!code || !note) return { ok: false, error: "날짜와 내용을 확인해 주세요." };
  const [known] = await sql`SELECT 1 FROM participants WHERE patient_code = ${code} LIMIT 1`;
  if (!known) return { ok: false, error: "알 수 없는 환자입니다." };
  const [row] = await sql`
    INSERT INTO nursing_notes (patient_code, note_date, body, kind)
    VALUES (${code}, ${note.date}::date, ${note.body}, ${note.kind})
    RETURNING id, patient_code, note_date::text AS note_date, kind, body, created_at, updated_at
  `;
  return { ok: true, note: serialize([row])[0] as ResearcherNote };
}

export async function adminUpdateNote(
  id: string,
  date: string,
  body: string,
  kind: NoteKind = "note"
): Promise<{ ok: true; note: ResearcherNote } | { ok: false; error: string }> {
  await requireAdmin();
  const note = cleanNote(date, body, kind);
  if (!isUuid(id) || !note) return { ok: false, error: "날짜와 내용을 확인해 주세요." };
  const rows = await sql`
    UPDATE nursing_notes SET note_date = ${note.date}::date, body = ${note.body}, kind = ${note.kind}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING id, patient_code, note_date::text AS note_date, kind, body, created_at, updated_at
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

// ── 참여자 기본정보 (신청 정보) 조회·수정 ────────────────────────────────────────────────

export type ParticipantInfo = {
  id: string;
  name: string;
  record_or_birth: string;
  contact: string;
  gender: Sex | null;
  study_start_date: string | null;
  remark: string | null;
  applied_at: string;
  enrolled: boolean;
};

export async function adminGetParticipantInfo(patientCode: string): Promise<ParticipantInfo | null> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!code) return null;
  const [r] = await sql`
    SELECT id, name, record_or_birth, contact, gender, study_start_date::text AS study_start_date, remark, applied_at, enrolled
    FROM participants WHERE patient_code = ${code} ORDER BY applied_at LIMIT 1
  `;
  return r ? (serialize([r])[0] as ParticipantInfo) : null;
}

export async function adminUpdateParticipantInfo(
  id: string,
  info: { name: string; record_or_birth: string; contact: string; gender: string; study_start_date: string; remark: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const name = String(info?.name ?? "").trim();
  const birth = String(info?.record_or_birth ?? "").trim();
  const contact = String(info?.contact ?? "").trim();
  const genderRaw = String(info?.gender ?? "").trim();
  const sex = parseSex(genderRaw);
  const start = String(info?.study_start_date ?? "").trim();
  const remark = String(info?.remark ?? "").trim();
  if (!isUuid(id)) return { ok: false, error: "잘못된 요청입니다." };
  if (!name || name.length > 50) return { ok: false, error: "이름을 확인해 주세요." };
  if (!birth || birth.length > 32) return { ok: false, error: "생년월일을 확인해 주세요." };
  if (!contact || contact.length > 32) return { ok: false, error: "연락처를 확인해 주세요." };
  if (genderRaw !== "" && !sex) return { ok: false, error: "성별을 확인해 주세요." };
  if (start !== "" && (!/^\d{4}-\d{2}-\d{2}$/.test(start) || Number.isNaN(Date.parse(start)))) {
    return { ok: false, error: "연구참여시작일을 확인해 주세요." };
  }
  if (remark.length > 200) return { ok: false, error: "비고는 200자 이내로 적어 주세요." };
  await sql`
    UPDATE participants SET name = ${name}, record_or_birth = ${birth}, contact = ${contact}, gender = ${sex},
      study_start_date = ${start === "" ? null : start}::date, remark = ${remark === "" ? null : remark}
    WHERE id = ${id}
  `;
  return { ok: true };
}

// ── 기본정보 설문(W0) 응답 조회·수정 ────────────────────────────────────────────────────

export type AdminW0 = {
  sessionId: string;
  completedAt: string | null;
  answers: Record<string, { num: number | null; text: string | null }>;
} | null;

type W0Rule = { kind: "choice"; values: number[] } | { kind: "number"; min: number; max: number } | { kind: "multi"; values: number[] };

function buildW0Rules(): Map<string, W0Rule> {
  const m = new Map<string, W0Rule>();
  for (const q of DEMOGRAPHICS) {
    if (q.type === "radio") m.set(q.key, { kind: "choice", values: q.options.map((o) => o.value) });
    else if (q.type === "multi") m.set(q.key, { kind: "multi", values: q.options.map((o) => o.value) });
    else if (q.type === "number") m.set(q.key, { kind: "number", min: q.min ?? 0, max: q.max ?? 1000 });
  }
  m.set(ECOG_KEY, { kind: "choice", values: ECOG_OPTIONS.map((o) => o.value) });
  for (const q of EMERGENCY_SCREENING) m.set(q.key, { kind: "choice", values: q.options.map((o) => o.value) });
  for (const it of IPAQ_ITEMS) {
    m.set(it.daysKey, { kind: "number", min: 0, max: 7 });
    m.set(it.hoursKey, { kind: "number", min: 0, max: 24 });
    m.set(it.minutesKey, { kind: "number", min: 0, max: 59 });
  }
  m.set(SITTING_KEYS.hours, { kind: "number", min: 0, max: 24 });
  m.set(SITTING_KEYS.minutes, { kind: "number", min: 0, max: 59 });
  return m;
}
const W0_RULES = buildW0Rules();

export async function adminGetW0(patientCode: string): Promise<AdminW0> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!code) return null;
  const [s] = await sql`
    SELECT id, completed_at FROM survey_sessions
    WHERE patient_code = ${code} AND survey_type = 'w0' AND is_complete = TRUE
    ORDER BY completed_at DESC LIMIT 1
  `;
  if (!s) return null;
  const rows = await sql`SELECT question_key, answer_number, answer_text FROM w0_answers WHERE session_id = ${s.id}`;
  const answers: Record<string, { num: number | null; text: string | null }> = {};
  for (const r of rows) {
    answers[String(r.question_key)] = {
      num: r.answer_number === null || r.answer_number === undefined ? null : Number(r.answer_number),
      text: r.answer_text === null || r.answer_text === undefined ? null : String(r.answer_text),
    };
  }
  return { sessionId: String(s.id), completedAt: s.completed_at ? new Date(s.completed_at).toISOString() : null, answers };
}

/** Sets one 기본정보 answer. value is the number for choice/number questions, "2,3" style text for multi. */
export async function adminSetW0Answer(
  sessionId: string,
  key: string,
  value: number | string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const rule = W0_RULES.get(String(key));
  if (!isUuid(sessionId) || !rule) return { ok: false, error: "알 수 없는 문항입니다." };
  const [s] = await sql`SELECT 1 FROM survey_sessions WHERE id = ${sessionId} AND survey_type = 'w0'`;
  if (!s) return { ok: false, error: "세션을 찾을 수 없습니다." };

  if (value === null || value === "") {
    await sql`DELETE FROM w0_answers WHERE session_id = ${sessionId} AND question_key = ${key}`;
    return { ok: true };
  }
  let num: number | null = null;
  let text: string | null = null;
  if (rule.kind === "multi") {
    const parts = String(value).split(",").map((x) => Number(x.trim()));
    if (parts.length === 0 || parts.some((p) => !rule.values.includes(p))) return { ok: false, error: "값을 확인해 주세요." };
    text = [...new Set(parts)].sort((a, b) => a - b).join(",");
  } else {
    const n = Number(value);
    if (!Number.isFinite(n)) return { ok: false, error: "값을 확인해 주세요." };
    if (rule.kind === "choice" && !rule.values.includes(n)) return { ok: false, error: "값을 확인해 주세요." };
    if (rule.kind === "number" && (n < rule.min || n > rule.max)) return { ok: false, error: "범위를 확인해 주세요." };
    num = n;
  }
  await sql`
    INSERT INTO w0_answers (session_id, question_key, answer_number, answer_text)
    VALUES (${sessionId}, ${key}, ${num}, ${text})
    ON CONFLICT (session_id, question_key)
    DO UPDATE SET answer_number = EXCLUDED.answer_number, answer_text = EXCLUDED.answer_text
  `;
  return { ok: true };
}

// ── 삶의 질(QLQ-C30) 응답 조회 ────────────────────────────────────────────

export type QlqDashboard = {
  sessions: { id: string; completed_at: string | null }[];
  answers: { session_id: string; question_no: number; answer_value: number }[];
};

export async function adminGetQlq(patientCode: string): Promise<QlqDashboard> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!code) return { sessions: [], answers: [] };
  const sessions = await sql`
    SELECT id, completed_at FROM survey_sessions
    WHERE patient_code = ${code} AND survey_type = 'qlq_c30' AND is_complete = TRUE
    ORDER BY completed_at ASC
  `;
  if (sessions.length === 0) return { sessions: [], answers: [] };
  const answers = await sql`
    SELECT session_id, question_no, answer_value FROM qlq_c30_answers
    WHERE session_id = ANY(${sessions.map((x) => x.id)}::uuid[])
  `;
  return {
    sessions: serialize(sessions) as QlqDashboard["sessions"],
    answers: answers.map((a) => ({
      session_id: String(a.session_id),
      question_no: Number(a.question_no),
      answer_value: Number(a.answer_value),
    })),
  };
}

// ── 임상정보 (연구자 입력) ──────────────────────────────────────────────────────────────

export type ClinicalInfo = {
  adc_drug: string;
  cancer_type: string;
  cancer_stage: "" | "I" | "II" | "III" | "IV";
  tx_line: string; // digits or ""
  ecog: string; // "0".."4" or ""
  comorbidity_count: string; // digits or ""
  comorbidity_names: string;
};

export async function adminGetClinicalInfo(patientCode: string): Promise<ClinicalInfo> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  const [r] = code ? await sql`SELECT * FROM clinical_info WHERE patient_code = ${code}` : [];
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));
  return {
    adc_drug: str(r?.adc_drug),
    cancer_type: str(r?.cancer_type),
    cancer_stage: str(r?.cancer_stage) as ClinicalInfo["cancer_stage"],
    tx_line: str(r?.tx_line),
    ecog: str(r?.ecog),
    comorbidity_count: str(r?.comorbidity_count),
    comorbidity_names: str(r?.comorbidity_names),
  };
}

export async function adminSaveClinicalInfo(
  patientCode: string,
  info: ClinicalInfo
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const code = String(patientCode ?? "").trim();
  if (!code) return { ok: false, error: "잘못된 요청입니다." };
  const [known] = await sql`SELECT 1 FROM participants WHERE patient_code = ${code} LIMIT 1`;
  if (!known) return { ok: false, error: "알 수 없는 환자입니다." };

  const text = (v: unknown, max: number) => {
    const t = String(v ?? "").trim();
    return t.length > max ? null : t === "" ? "" : t;
  };
  const adc = text(info?.adc_drug, 200);
  const cancer = text(info?.cancer_type, 200);
  const names = text(info?.comorbidity_names, 2000);
  if (adc === null || cancer === null || names === null) return { ok: false, error: "입력이 너무 깁니다." };

  const stage = String(info?.cancer_stage ?? "").trim();
  if (stage !== "" && !["I", "II", "III", "IV"].includes(stage)) return { ok: false, error: "병기를 확인해 주세요." };

  const int = (v: unknown, min: number, max: number): number | null | "bad" => {
    const t = String(v ?? "").trim();
    if (t === "") return null;
    if (!/^\d{1,3}$/.test(t)) return "bad";
    const n = Number(t);
    return n < min || n > max ? "bad" : n;
  };
  const tx = int(info?.tx_line, 0, 50);
  const ecog = int(info?.ecog, 0, 4);
  const cc = int(info?.comorbidity_count, 0, 50);
  if (tx === "bad") return { ok: false, error: "치료 차수를 확인해 주세요 (0~50)." };
  if (ecog === "bad") return { ok: false, error: "ECOG는 0~4 사이 숫자로 입력해 주세요." };
  if (cc === "bad") return { ok: false, error: "동반질환 개수를 확인해 주세요 (0~50)." };

  const nul = (t: string) => (t === "" ? null : t);
  await sql`
    INSERT INTO clinical_info (patient_code, adc_drug, cancer_type, cancer_stage, tx_line, ecog, comorbidity_count, comorbidity_names, updated_at)
    VALUES (${code}, ${nul(adc)}, ${nul(cancer)}, ${nul(stage)}, ${tx}, ${ecog}, ${cc}, ${nul(names)}, NOW())
    ON CONFLICT (patient_code) DO UPDATE SET
      adc_drug = EXCLUDED.adc_drug, cancer_type = EXCLUDED.cancer_type, cancer_stage = EXCLUDED.cancer_stage,
      tx_line = EXCLUDED.tx_line, ecog = EXCLUDED.ecog, comorbidity_count = EXCLUDED.comorbidity_count,
      comorbidity_names = EXCLUDED.comorbidity_names, updated_at = NOW()
  `;
  return { ok: true };
}
