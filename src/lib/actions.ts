"use server";

// Patient-facing server actions. With Supabase, pages talked to the DB
// directly from the browser and access was limited by RLS; on Neon every
// query runs here instead, so each action validates its own input. A session
// id (random UUID in the URL) is what authorizes writes to that session —
// the same trust model the Supabase version had.

import { sql, isUuid } from "./db";
import { SURVEY_ITEMS } from "./questions";
import { QLQ_QUESTIONS } from "./qlq-c30";
import { sendSms } from "./solapi";
import { headers } from "next/headers";
import { clientIp, rateLimit } from "./rateLimit";
import { formatMonthDay, kstToday, qlqStatus } from "./surveySchedule";

/** 증상 설문 reopens this many days after the previous one was completed. */
const PRO_REOPEN_AFTER_DAYS = 6;

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

type SurveyType = "pro_ctcae" | "qlq_c30" | "w0";

// Phone numbers live in env vars (SMS_SENDER = registered Solapi sender,
// SMS_NOTIFY_TO = comma-separated recipients), not in the public repo.
function smsConfig(): { sender: string; recipients: string[] } {
  const sender = (process.env.SMS_SENDER ?? "").trim();
  const recipients = (process.env.SMS_NOTIFY_TO ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  if (!sender || recipients.length === 0) throw new Error("SMS_SENDER / SMS_NOTIFY_TO 환경변수가 설정되지 않았습니다.");
  return { sender, recipients };
}

async function callerIp(): Promise<string> {
  return clientIp(await headers());
}

// ── 본인확인 / 참여신청 ─────────────────────────────────────────────

/** Exact name + birth-date match → that participant's code, never any other column. */
export async function findPatientCode(name: string, birth: string): Promise<string | null> {
  if (typeof name !== "string" || typeof birth !== "string" || !name.trim() || !birth.trim()) return null;
  // Slows guessing name/birth-date pairs: 15 lookups per 10 minutes per IP.
  if (!rateLimit(`find-code:${await callerIp()}`, 15, 10 * 60 * 1000)) return null;
  const rows = await sql`
    SELECT patient_code FROM participants
    WHERE trim(name) = trim(${name})
      AND regexp_replace(record_or_birth, '\\D', '', 'g') = regexp_replace(${birth}, '\\D', '', 'g')
      AND patient_code IS NOT NULL
    LIMIT 1
  `;
  return rows[0]?.patient_code ?? null;
}

async function patientExists(code: string) {
  if (typeof code !== "string" || !code.trim()) return false;
  const rows = await sql`SELECT 1 FROM participants WHERE patient_code = ${code} LIMIT 1`;
  return rows.length > 0;
}

export async function registerParticipant(input: {
  name: string;
  recordOrBirth: string;
  contact: string;
  researchTypes: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = String(input?.name ?? "").trim().slice(0, 100);
  const recordOrBirth = String(input?.recordOrBirth ?? "").trim().slice(0, 50);
  const contact = String(input?.contact ?? "").trim().slice(0, 50);
  const researchTypes = (Array.isArray(input?.researchTypes) ? input.researchTypes : [])
    .filter((t) => t === "설문조사" || t === "면담");
  if (!name || !recordOrBirth || !contact || researchTypes.length === 0) {
    return { ok: false, error: "필수 항목이 비어 있습니다." };
  }
  if (!rateLimit(`register:${await callerIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "신청 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요." };
  }

  const [row] = await sql`
    INSERT INTO participants (name, record_or_birth, contact, research_types, consent_agreed)
    VALUES (${name}, ${recordOrBirth}, ${contact}, ${researchTypes.join(",")}, TRUE)
    RETURNING id
  `;

  // Notify the research team. A failed SMS must not fail the registration —
  // the outcome is recorded on the row and shown in the admin 참여신청 tab
  // (previously failures only reached server logs, which is how a revoked
  // Solapi key went unnoticed).
  // SMS (not LMS) tops out around 45 Korean characters / 90 bytes, so this
  // packs everything into one slash-separated line.
  const text = `[연구참여신청] ${[name, recordOrBirth, researchTypes.join(","), contact].join("/")}`;
  try {
    const { sender, recipients } = smsConfig();
    await sendSms({ to: recipients, from: sender, text });
    await sql`UPDATE participants SET sms_notified = TRUE, sms_error = NULL WHERE id = ${row.id}`;
  } catch (err) {
    console.error("Failed to send registration SMS:", err);
    const message = err instanceof Error ? err.message.slice(0, 500) : "unknown error";
    await sql`UPDATE participants SET sms_notified = FALSE, sms_error = ${message} WHERE id = ${row.id}`;
  }
  return { ok: true };
}

// ── 세션 ─────────────────────────────────────────────────────────

/** Most recent unfinished PRO-CTCAE session for this patient, if any (no time limit). */
export async function getResumableProCtcaeSession(code: string): Promise<string | null> {
  if (typeof code !== "string" || !code.trim()) return null;
  const rows = await sql`
    SELECT id FROM survey_sessions
    WHERE patient_code = ${code} AND survey_type = 'pro_ctcae' AND is_complete = FALSE
    ORDER BY started_at DESC
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

export type SurveyAvailability = {
  open: boolean;
  /** Short badge text, e.g. "완료". */
  label?: string;
  /** Sentence shown under the survey title. */
  note?: string;
};

/**
 * Which surveys this patient can start right now.
 *  - w0 (기본정보): once. Locked after it has been submitted.
 *  - pro_ctcae (증상): free the first time, then 6 days after the last completion.
 *  - qlq_c30 (삶의 질): only in the Mon–Sun week containing each 12-week mark
 *    after the participant's start date, and once per window.
 */
export async function getSurveyAvailability(code: string): Promise<Record<SurveyType, SurveyAvailability>> {
  const result: Record<SurveyType, SurveyAvailability> = {
    w0: { open: true },
    pro_ctcae: { open: true },
    qlq_c30: { open: false, label: "대기", note: "삶의 질 설문은 연구 시작 후 12주마다 열립니다." },
  };
  if (typeof code !== "string" || !code.trim()) return result;

  const [w0Done] = await sql`
    SELECT 1 FROM survey_sessions WHERE patient_code = ${code} AND survey_type = 'w0' AND is_complete = TRUE LIMIT 1
  `;
  if (w0Done) {
    result.w0 = { open: false, label: "완료", note: "기본정보는 한 번만 입력하며, 이미 제출하셨어요." };
  }

  // 증상: first one is free; after that it reopens 6 days after the last completion
  // (6 rather than 7 so a patient who answers a day early isn't locked out).
  const [lastPro] = await sql`
    SELECT (max(completed_at) AT TIME ZONE 'Asia/Seoul')::date::text AS last
    FROM survey_sessions
    WHERE patient_code = ${code} AND survey_type = 'pro_ctcae' AND is_complete = TRUE
  `;
  if (lastPro?.last) {
    const reopen = addDays(lastPro.last, PRO_REOPEN_AFTER_DAYS);
    if (kstToday() < reopen) {
      result.pro_ctcae = {
        open: false,
        label: "완료",
        note: `최근 증상 설문을 ${formatMonthDay(lastPro.last)}에 완료하셨어요. ${formatMonthDay(reopen)}부터 다시 작성할 수 있어요.`,
      };
    }
  }

  const [p] = await sql`
    SELECT study_start_date::text AS start FROM participants WHERE patient_code = ${code} ORDER BY applied_at LIMIT 1
  `;
  const start: string | null = p?.start ?? null;
  if (!start) {
    result.qlq_c30 = { open: false, label: "대기", note: "첫 설문을 시작하신 뒤 12주째 주에 열립니다." };
    return result;
  }

  const { current, next } = qlqStatus(start, kstToday());
  if (!current) {
    result.qlq_c30 = {
      open: false,
      label: "대기",
      note: `다음 작성 기간: ${formatMonthDay(next.from)} ~ ${formatMonthDay(next.to)}`,
    };
    return result;
  }
  const [doneInWindow] = await sql`
    SELECT 1 FROM survey_sessions
    WHERE patient_code = ${code} AND survey_type = 'qlq_c30' AND is_complete = TRUE
      AND (completed_at AT TIME ZONE 'Asia/Seoul')::date BETWEEN ${current.from}::date AND ${current.to}::date
    LIMIT 1
  `;
  if (doneInWindow) {
    const after = qlqStatus(start, addDays(current.to, 1)).next;
    result.qlq_c30 = {
      open: false,
      label: "완료",
      note: `이번 분기 설문을 완료하셨어요. 다음: ${formatMonthDay(after.from)} ~ ${formatMonthDay(after.to)}`,
    };
  } else {
    result.qlq_c30 = { open: true, note: `${formatMonthDay(current.to)}까지 작성할 수 있어요.` };
  }
  return result;
}

/** Starts a survey — or continues the patient's unfinished one of the same type. */
export async function startSurveySession(
  code: string,
  surveyType: SurveyType
): Promise<{ ok: true; sessionId: string } | { ok: false; error: string }> {
  if (!["pro_ctcae", "qlq_c30", "w0"].includes(surveyType)) return { ok: false, error: "invalid survey type" };
  if (!(await patientExists(code))) return { ok: false, error: "unknown patient" };

  const availability = (await getSurveyAvailability(code))[surveyType];
  if (!availability.open) return { ok: false, error: availability.note ?? "지금은 작성할 수 없는 설문입니다." };

  // The first survey a participant starts fixes their study start date; the
  // quarterly 삶의 질 windows count from it.
  await sql`
    UPDATE participants SET study_start_date = ${kstToday()}::date
    WHERE patient_code = ${code} AND study_start_date IS NULL
  `;

  const [unfinished] = await sql`
    SELECT id FROM survey_sessions
    WHERE patient_code = ${code} AND survey_type = ${surveyType} AND is_complete = FALSE
    ORDER BY started_at DESC LIMIT 1
  `;
  if (unfinished) return { ok: true, sessionId: unfinished.id };
  const [row] = await sql`
    INSERT INTO survey_sessions (patient_code, survey_type) VALUES (${code}, ${surveyType}) RETURNING id
  `;
  return { ok: true, sessionId: row.id };
}

async function getOpenSession(sessionId: string, surveyType: SurveyType) {
  if (!isUuid(sessionId)) return { error: "not_found" as const };
  const rows = await sql`SELECT survey_type, is_complete FROM survey_sessions WHERE id = ${sessionId}`;
  const s = rows[0];
  if (!s || s.survey_type !== surveyType) return { error: "not_found" as const };
  if (s.is_complete) return { error: "complete" as const };
  return { error: null };
}

export async function getSessionPatientCode(sessionId: string): Promise<string | null> {
  if (!isUuid(sessionId)) return null;
  const rows = await sql`SELECT patient_code FROM survey_sessions WHERE id = ${sessionId}`;
  return rows[0]?.patient_code ?? null;
}

// ── PRO-CTCAE ────────────────────────────────────────────────────

export type ProCtcaeAnswer = { item_id: number; question_key: string; value: number | boolean };

const PRO_QUESTIONS = new Map(
  SURVEY_ITEMS.flatMap((item) => item.questions.map((q) => [`${item.id}-${q.key}`, { item, q }] as const))
);

export async function loadProCtcaeSession(
  sessionId: string
): Promise<{ status: "ok"; answers: ProCtcaeAnswer[] } | { status: "complete" | "not_found" }> {
  const open = await getOpenSession(sessionId, "pro_ctcae");
  if (open.error) return { status: open.error };
  const rows = await sql`
    SELECT item_id, question_key, question_type, answer_value, answer_boolean
    FROM survey_answers WHERE session_id = ${sessionId}
  `;
  return {
    status: "ok",
    answers: rows.map((r) => ({
      item_id: r.item_id,
      question_key: r.question_key,
      value: r.question_type === "presence" ? r.answer_boolean : r.answer_value,
    })),
  };
}

// item_term_en / question_type come from SURVEY_ITEMS, not the client.
export async function saveProCtcaeAnswers(
  sessionId: string,
  answers: ProCtcaeAnswer[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(answers) || answers.length === 0 || answers.length > 200) return { ok: false, error: "invalid rows" };
  const open = await getOpenSession(sessionId, "pro_ctcae");
  if (open.error) return { ok: false, error: open.error };

  const itemIds: number[] = [], keys: string[] = [], terms: string[] = [], types: string[] = [];
  const values: (number | null)[] = [], booleans: (boolean | null)[] = [];
  for (const a of answers) {
    const entry = PRO_QUESTIONS.get(`${a?.item_id}-${a?.question_key}`);
    if (!entry) return { ok: false, error: "unknown question" };
    const presence = entry.q.type === "presence";
    const valid = presence
      ? typeof a.value === "boolean"
      : Number.isInteger(a.value) && (a.value as number) >= 0 && (a.value as number) <= 4;
    if (!valid) return { ok: false, error: "invalid value" };
    itemIds.push(entry.item.id);
    keys.push(entry.q.key);
    terms.push(entry.item.termEn);
    types.push(entry.q.type);
    values.push(presence ? null : (a.value as number));
    booleans.push(presence ? (a.value as boolean) : null);
  }

  await sql`
    INSERT INTO survey_answers (session_id, item_id, question_key, item_term_en, question_type, answer_value, answer_boolean)
    SELECT ${sessionId}::uuid, * FROM UNNEST(
      ${itemIds}::int[], ${keys}::text[], ${terms}::text[], ${types}::text[], ${values}::int[], ${booleans}::boolean[]
    )
    ON CONFLICT (session_id, item_id, question_key)
    DO UPDATE SET answer_value = EXCLUDED.answer_value, answer_boolean = EXCLUDED.answer_boolean
  `;
  return { ok: true };
}

/** Used when "모두 증상 없음" is switched off, so the cleared answers don't come back on resume. */
export async function clearProCtcaeAnswers(
  sessionId: string,
  questions: { item_id: number; question_key: string }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 200) return { ok: false, error: "invalid rows" };
  const open = await getOpenSession(sessionId, "pro_ctcae");
  if (open.error) return { ok: false, error: open.error };
  const keys = questions.map((q) => `${Number(q?.item_id)}-${String(q?.question_key)}`);
  await sql`
    DELETE FROM survey_answers
    WHERE session_id = ${sessionId} AND (item_id::text || '-' || question_key) = ANY(${keys}::text[])
  `;
  return { ok: true };
}

export async function submitProCtcae(
  sessionId: string,
  additionalComment: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const open = await getOpenSession(sessionId, "pro_ctcae");
  if (open.error) return { ok: false, error: open.error };
  const [{ n }] = await sql`SELECT count(*)::int AS n FROM survey_answers WHERE session_id = ${sessionId}`;
  if (n < PRO_QUESTIONS.size) return { ok: false, error: "incomplete" };
  const comment = String(additionalComment ?? "").trim().slice(0, 5000) || null;
  await sql`
    UPDATE survey_sessions SET is_complete = TRUE, completed_at = NOW(), additional_comments = ${comment}
    WHERE id = ${sessionId}
  `;
  return { ok: true };
}

// ── QLQ-C30 ──────────────────────────────────────────────────────

export async function submitQlqC30(
  sessionId: string,
  answers: { question_no: number; answer_value: number }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const open = await getOpenSession(sessionId, "qlq_c30");
  if (open.error) return { ok: false, error: open.error };
  if (!Array.isArray(answers) || answers.length !== QLQ_QUESTIONS.length) return { ok: false, error: "incomplete" };

  const nos: number[] = [], vals: number[] = [];
  for (const a of answers) {
    const q = QLQ_QUESTIONS.find((x) => x.no === a?.question_no);
    const max = q?.scale === "seven" ? 7 : 4;
    if (!q || !Number.isInteger(a.answer_value) || a.answer_value < 1 || a.answer_value > max) {
      return { ok: false, error: "invalid value" };
    }
    nos.push(q.no);
    vals.push(a.answer_value);
  }
  await sql`
    INSERT INTO qlq_c30_answers (session_id, question_no, answer_value)
    SELECT ${sessionId}::uuid, * FROM UNNEST(${nos}::int[], ${vals}::int[])
    ON CONFLICT (session_id, question_no) DO UPDATE SET answer_value = EXCLUDED.answer_value
  `;
  await sql`UPDATE survey_sessions SET is_complete = TRUE, completed_at = NOW() WHERE id = ${sessionId}`;
  return { ok: true };
}

// ── W0 ───────────────────────────────────────────────────────────

export async function submitW0(
  sessionId: string,
  answers: { question_key: string; answer_number: number | null; answer_text: string | null }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const open = await getOpenSession(sessionId, "w0");
  if (open.error) return { ok: false, error: open.error };
  if (!Array.isArray(answers) || answers.length === 0 || answers.length > 200) return { ok: false, error: "invalid rows" };

  const keys: string[] = [], nums: (number | null)[] = [], texts: (string | null)[] = [];
  for (const a of answers) {
    const key = String(a?.question_key ?? "");
    if (!/^[A-Za-z0-9_]{1,64}$/.test(key)) return { ok: false, error: "invalid key" };
    const num = a.answer_number === null || a.answer_number === undefined ? null : Number(a.answer_number);
    if (num !== null && !Number.isFinite(num)) return { ok: false, error: "invalid value" };
    keys.push(key);
    nums.push(num);
    texts.push(a.answer_text === null || a.answer_text === undefined ? null : String(a.answer_text).slice(0, 1000));
  }
  await sql`
    INSERT INTO w0_answers (session_id, question_key, answer_number, answer_text)
    SELECT ${sessionId}::uuid, * FROM UNNEST(${keys}::text[], ${nums}::numeric[], ${texts}::text[])
    ON CONFLICT (session_id, question_key)
    DO UPDATE SET answer_number = EXCLUDED.answer_number, answer_text = EXCLUDED.answer_text
  `;
  await sql`UPDATE survey_sessions SET is_complete = TRUE, completed_at = NOW() WHERE id = ${sessionId}`;
  return { ok: true };
}

// ── 환자 문의 ────────────────────────────────────────────────────

export async function sendPatientMessage(
  patientCode: string,
  sessionId: string | null,
  message: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const text = String(message ?? "").trim().slice(0, 2000);
  if (!text) return { ok: false, error: "empty message" };
  if (!(await patientExists(patientCode))) return { ok: false, error: "unknown patient" };
  // A stale or made-up session id is dropped rather than tripping the FK.
  const session = isUuid(sessionId) ? sessionId : null;
  await sql`
    INSERT INTO patient_messages (patient_code, session_id, message)
    VALUES (${patientCode}, (SELECT id FROM survey_sessions WHERE id = ${session}::uuid), ${text})
  `;
  return { ok: true };
}
