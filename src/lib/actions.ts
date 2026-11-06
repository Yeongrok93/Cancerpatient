"use server";

// Patient-facing server actions. With Supabase, pages talked to the DB
// directly from the browser and access was limited by RLS; on Neon every
// query runs here instead, so each action validates its own input. A session
// id (random UUID in the URL) is what authorizes writes to that session —
// the same trust model the Supabase version had.

import { sql, isUuid } from "./db";
import { SURVEY_ITEMS, SEX_SPECIFIC_ITEM_IDS, itemApplies, parseSex, type Sex } from "./questions";
import { QLQ_QUESTIONS } from "./qlq-c30";
import { sendSms } from "./solapi";
import { headers } from "next/headers";
import { clientIp, rateLimit } from "./rateLimit";
import { formatMonthDay, kstToday, qlqStatus, qlqWindow } from "./surveySchedule";
import { rewardTotal } from "./rewards";

/** 증상 설문 reopens this many days after the previous one was completed. */
const PRO_REOPEN_AFTER_DAYS = 6;

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

type SurveyType = "pro_ctcae" | "qlq_c30" | "w0";

// Phone numbers live in env vars, not in the repo or the admin UI:
// SMS_SENDER = Solapi-registered sender, SMS_NOTIFY_TO = comma-separated recipients.
// SMS_NOTIFY_EXTRA_TO = more recipients of the same registration alert (e.g. the supervising professor).
async function smsConfig(): Promise<{ sender: string; recipients: string[] }> {
  const sender = (process.env.SMS_SENDER ?? "").trim();
  const recipients = [
    ...new Set(
      `${process.env.SMS_NOTIFY_TO ?? ""},${process.env.SMS_NOTIFY_EXTRA_TO ?? ""}`
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)
    ),
  ];
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

// Skips invalid numbers, and a number that already applied in the last 24 hours, so the
// public form can't be used to text arbitrary people repeatedly.
async function sendApplicantConfirmation(participantId: string, name: string, contact: string) {
  const phone = contact.replace(/\D/g, "");
  if (!/^01\d{8,9}$/.test(phone)) return;
  const sender = (process.env.SMS_SENDER ?? "").trim();
  if (!sender) return;
  const [recent] = await sql`
    SELECT 1 FROM participants
    WHERE regexp_replace(contact, '\\D', '', 'g') = ${phone}
      AND id <> ${participantId} AND applied_at > NOW() - INTERVAL '24 hours'
    LIMIT 1
  `;
  if (recent) return;
  // The applicant's only automatic text: sent 5 minutes after applying, from the researcher, asking for the
  // next hospital visit date. Scheduled with Solapi (예약발송), so nothing here has to wait.
  await sendSms({
    to: phone,
    from: sender,
    text: "안녕하세요, 연구담당자 정영록입니다. 연구 참여를 신청해주셔서 감사합니다. 연구과정 설명과 동의서 작성이 필요한데요, 혹시 다음 병원 방문일이 언제이신가요?",
    scheduledAt: new Date(Date.now() + 5 * 60_000),
  });
}

export async function registerParticipant(input: {
  name: string;
  recordOrBirth: string;
  contact: string;
  researchTypes: string[];
  gender: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = String(input?.name ?? "").trim().slice(0, 100);
  const recordOrBirth = String(input?.recordOrBirth ?? "").trim().slice(0, 50);
  const contact = String(input?.contact ?? "").trim().slice(0, 50);
  const researchTypes = (Array.isArray(input?.researchTypes) ? input.researchTypes : [])
    .filter((t) => t === "설문조사" || t === "면담");
  const gender = parseSex(input?.gender);
  if (!name || !recordOrBirth || !contact || researchTypes.length === 0) {
    return { ok: false, error: "필수 항목이 비어 있습니다." };
  }
  if (!gender) return { ok: false, error: "성별을 선택해 주세요." };
  if (!rateLimit(`register:${await callerIp()}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "신청 횟수가 너무 많습니다. 잠시 후 다시 시도해 주세요." };
  }

  const [row] = await sql`
    INSERT INTO participants (name, record_or_birth, contact, research_types, consent_agreed, gender)
    VALUES (${name}, ${recordOrBirth}, ${contact}, ${researchTypes.join(",")}, TRUE, ${gender})
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
    const { sender, recipients } = await smsConfig();
    await sendSms({ to: recipients, from: sender, text });
    await sql`UPDATE participants SET sms_notified = TRUE, sms_error = NULL WHERE id = ${row.id}`;
  } catch (err) {
    console.error("Failed to send registration SMS:", err);
    const message = err instanceof Error ? err.message.slice(0, 500) : "unknown error";
    await sql`UPDATE participants SET sms_notified = FALSE, sms_error = ${message} WHERE id = ${row.id}`;
  }

  // Tell the applicant the request arrived. Best effort: it never fails the registration.
  try {
    await sendApplicantConfirmation(row.id, name, contact);
  } catch (err) {
    console.error("Failed to send applicant confirmation SMS:", err);
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
 *  - qlq_c30 (삶의 질): once at the start (Baseline), then only in the Mon–Sun week
 *    containing each 12-week mark after the participant's start date, once per window.
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
  const today = kstToday();

  // Baseline: before the first 12-week window the survey is open until it has been filled once.
  if (!start || today < qlqWindow(start, 1).from) {
    const [baselineDone] = await sql`
      SELECT 1 FROM survey_sessions
      WHERE patient_code = ${code} AND survey_type = 'qlq_c30' AND is_complete = TRUE LIMIT 1
    `;
    if (!baselineDone) {
      result.qlq_c30 = { open: true, note: "처음 한 번 작성하는 기본(Baseline) 삶의 질 설문이에요." };
    } else {
      const first = qlqWindow(start ?? today, 1);
      result.qlq_c30 = {
        open: false,
        label: "완료",
        note: `기본(Baseline) 삶의 질 설문을 완료하셨어요. 다음: ${formatMonthDay(first.from)} ~ ${formatMonthDay(first.to)}`,
      };
    }
    return result;
  }

  const { current, next } = qlqStatus(start, today);
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

/** The participant's sex for this session (from participants.gender); null if not recorded. */
async function sexForSession(sessionId: string): Promise<Sex | null> {
  const rows = await sql`
    SELECT (SELECT p.gender FROM participants p
            WHERE p.patient_code = s.patient_code AND p.gender IS NOT NULL
            ORDER BY p.applied_at LIMIT 1) AS gender
    FROM survey_sessions s WHERE s.id = ${sessionId}
  `;
  return parseSex(rows[0]?.gender);
}

/**
 * 적립금 earned from surveys already completed (the one being filled in is not complete yet, so it
 * is not counted). The Baseline 삶의 질 설문 is unpaid. Same rule as the weekly reminder text.
 */
async function rewardSoFar(code: string | null): Promise<number> {
  if (!code) return 0;
  const [r] = await sql`
    SELECT
      (SELECT count(*)::int FROM survey_sessions s
        WHERE s.patient_code = ${code} AND s.survey_type = 'pro_ctcae' AND s.is_complete) AS pro_count,
      (SELECT count(*)::int FROM survey_sessions s
        WHERE s.patient_code = ${code} AND s.survey_type = 'qlq_c30' AND s.is_complete) AS qlq_count,
      (SELECT (min(s.completed_at) AT TIME ZONE 'Asia/Seoul')::date::text FROM survey_sessions s
        WHERE s.patient_code = ${code} AND s.survey_type = 'qlq_c30' AND s.is_complete) AS first_qlq,
      (SELECT p.study_start_date::text FROM participants p WHERE p.patient_code = ${code} ORDER BY p.applied_at LIMIT 1) AS start_date
  `;
  const hasBaseline = r.first_qlq && (!r.start_date || r.first_qlq < qlqWindow(r.start_date, 1).from);
  return rewardTotal(Number(r.pro_count), Number(r.qlq_count) - (hasBaseline ? 1 : 0));
}

// ── 다음 외래 일정 ───────────────────────────────────────────────

export type NextVisitInput = { date: string; time: string } | { unknown: true };

/**
 * True when no upcoming 외래 is on file for this patient — i.e. the question should be asked.
 * Once a visit is recorded it stays "answered" until that date/time has passed.
 */
async function nextVisitDue(code: string | null): Promise<boolean> {
  if (!code) return false;
  const [upcoming] = await sql`
    SELECT 1 FROM clinic_visits
    WHERE patient_code = ${code}
      AND ((visit_date + visit_time) AT TIME ZONE 'Asia/Seoul') > NOW()
    LIMIT 1
  `;
  return !upcoming;
}

async function sessionVisitUnknown(sessionId: string): Promise<boolean> {
  const [r] = await sql`SELECT next_visit_unknown FROM survey_sessions WHERE id = ${sessionId}`;
  return !!r?.next_visit_unknown;
}

async function upsertVisit(code: string, sessionId: string, visit: { date: string; time: string }) {
  await sql`
    INSERT INTO clinic_visits (patient_code, session_id, visit_date, visit_time)
    VALUES (${code}, ${sessionId}, ${visit.date}::date, ${visit.time}::time)
    ON CONFLICT (session_id) DO UPDATE SET visit_date = EXCLUDED.visit_date, visit_time = EXCLUDED.visit_time
  `;
}

/**
 * Saves the 다음 외래 answer while the 증상 설문 is still being filled in (not only at submit), so a
 * reload or a closed page keeps it. null clears an earlier "아직 일정이 안 잡혔어요".
 */
export async function saveNextVisit(
  sessionId: string,
  nextVisit: NextVisitInput | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const open = await getOpenSession(sessionId, "pro_ctcae");
  if (open.error) return { ok: false, error: open.error };
  const code = await getSessionPatientCode(sessionId);
  if (!code) return { ok: false, error: "not_found" };
  if (nextVisit === null) {
    await sql`UPDATE survey_sessions SET next_visit_unknown = FALSE WHERE id = ${sessionId}`;
    return { ok: true };
  }
  const visit = parseNextVisit(nextVisit);
  if (!visit) return { ok: false, error: "invalid" };
  if (visit === "unknown") {
    await sql`UPDATE survey_sessions SET next_visit_unknown = TRUE WHERE id = ${sessionId}`;
  } else {
    await upsertVisit(code, sessionId, visit);
    await sql`UPDATE survey_sessions SET next_visit_unknown = FALSE WHERE id = ${sessionId}`;
  }
  return { ok: true };
}

/** A valid future visit, "unknown", or null when the input is unusable. */
function parseNextVisit(v: unknown): { date: string; time: string } | "unknown" | null {
  if (!v || typeof v !== "object") return null;
  if ((v as { unknown?: unknown }).unknown === true) return "unknown";
  const { date, time } = v as { date?: unknown; time?: unknown };
  if (typeof date !== "string" || typeof time !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const [y, m, d] = date.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  if (new Date(`${date}T${time}:00+09:00`).getTime() <= Date.now()) return null; // already past
  if (date > addDays(kstToday(), 366)) return null;
  return { date, time };
}

export type ProCtcaeAnswer = { item_id: number; question_key: string; value: number | boolean };

const PRO_QUESTIONS = new Map(
  SURVEY_ITEMS.flatMap((item) => item.questions.map((q) => [`${item.id}-${q.key}`, { item, q }] as const))
);

export async function loadProCtcaeSession(
  sessionId: string
): Promise<
  | { status: "ok"; answers: ProCtcaeAnswer[]; sex: Sex | null; askNextVisit: boolean; rewardSoFar: number }
  | { status: "complete" | "not_found" }
> {
  const open = await getOpenSession(sessionId, "pro_ctcae");
  if (open.error) return { status: open.error };
  const rows = await sql`
    SELECT item_id, question_key, question_type, answer_value, answer_boolean
    FROM survey_answers WHERE session_id = ${sessionId}
  `;
  const code = await getSessionPatientCode(sessionId);
  return {
    status: "ok",
    sex: await sexForSession(sessionId),
    askNextVisit: (await nextVisitDue(code)) && !(await sessionVisitUnknown(sessionId)),
    rewardSoFar: await rewardSoFar(code),
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

  const sex = await sexForSession(sessionId);
  const itemIds: number[] = [], keys: string[] = [], terms: string[] = [], types: string[] = [];
  const values: (number | null)[] = [], booleans: (boolean | null)[] = [];
  for (const a of answers) {
    const entry = PRO_QUESTIONS.get(`${a?.item_id}-${a?.question_key}`);
    if (!entry) return { ok: false, error: "unknown question" };
    if (!itemApplies(entry.item.id, sex)) continue; // e.g. erection items for a woman
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
  additionalComment: string,
  nextVisit?: NextVisitInput | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const open = await getOpenSession(sessionId, "pro_ctcae");
  if (open.error) return { ok: false, error: open.error };
  const sex = await sexForSession(sessionId);
  const required = [...PRO_QUESTIONS.values()].filter(({ item }) => itemApplies(item.id, sex)).length;
  const excludedItemIds = Object.keys(SEX_SPECIFIC_ITEM_IDS).map(Number).filter((id) => !itemApplies(id, sex));
  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM survey_answers
    WHERE session_id = ${sessionId} AND item_id <> ALL(${excludedItemIds}::int[])
  `;
  if (n < required) return { ok: false, error: "incomplete" };

  // 다음 외래: asked only while no upcoming visit is on file.
  const code = await getSessionPatientCode(sessionId);
  if (await nextVisitDue(code)) {
    const visit = parseNextVisit(nextVisit);
    // "아직 일정이 안 잡혔어요" may already have been saved earlier in this session.
    const unknownSaved = !visit && (await sessionVisitUnknown(sessionId));
    if (!visit && !unknownSaved) return { ok: false, error: "next_visit_required" };
    if (visit && visit !== "unknown") await upsertVisit(code!, sessionId, visit);
  }
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

// ── QLQ-C30 임시 저장 (제출 전에 닫아도 이어서 작성) ─────────────────────────

export async function loadQlqC30Draft(
  sessionId: string
): Promise<{ status: "ok"; answers: Record<number, number> } | { status: "complete" | "not_found" }> {
  const open = await getOpenSession(sessionId, "qlq_c30");
  if (open.error) return { status: open.error };
  const rows = await sql`SELECT question_no, answer_value FROM qlq_c30_answers WHERE session_id = ${sessionId}`;
  const answers: Record<number, number> = {};
  for (const r of rows) answers[Number(r.question_no)] = Number(r.answer_value);
  return { status: "ok", answers };
}

export async function saveQlqC30Draft(
  sessionId: string,
  answers: { question_no: number; answer_value: number }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const open = await getOpenSession(sessionId, "qlq_c30");
  if (open.error) return { ok: false, error: open.error };
  if (!Array.isArray(answers) || answers.length > QLQ_QUESTIONS.length) return { ok: false, error: "invalid rows" };
  if (answers.length === 0) return { ok: true };
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
  return { ok: true };
}

// ── W0 ───────────────────────────────────────────────────────────

/** Saved so far, keyed by question; numbers come back as numbers, multi-choice as "2,3" text. */
export async function loadW0Draft(
  sessionId: string
): Promise<{ status: "ok"; answers: Record<string, number | string> } | { status: "complete" | "not_found" }> {
  const open = await getOpenSession(sessionId, "w0");
  if (open.error) return { status: open.error };
  const rows = await sql`SELECT question_key, answer_number, answer_text FROM w0_answers WHERE session_id = ${sessionId}`;
  const answers: Record<string, number | string> = {};
  for (const r of rows) {
    if (r.answer_number !== null && r.answer_number !== undefined) answers[String(r.question_key)] = Number(r.answer_number);
    else if (r.answer_text !== null && r.answer_text !== undefined) answers[String(r.question_key)] = String(r.answer_text);
  }
  return { status: "ok", answers };
}

export async function saveW0Draft(
  sessionId: string,
  answers: { question_key: string; answer_number: number | null; answer_text: string | null }[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  const open = await getOpenSession(sessionId, "w0");
  if (open.error) return { ok: false, error: open.error };
  if (!Array.isArray(answers) || answers.length > 200) return { ok: false, error: "invalid rows" };
  if (answers.length === 0) return { ok: true };
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
  return { ok: true };
}

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
