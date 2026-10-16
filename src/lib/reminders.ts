// Weekly 증상 설문 reminder text. Server-only; called from /api/cron/reminders.
//
// Who gets one: participants a researcher has ticked as 연구참여 확인 (enrolled),
// who have a participant code, a valid mobile number and a survey link token.
// When: 7 days after their most recent completed 증상 설문 (KST date). The cron
// runs once a day, so a missed run is retried on the next two days; after that
// the reminder for that completion is dropped rather than sent late.
// Once per completion: reminder_log has a unique row per (participant, kind, cycle date).

import { sql } from "./db";
import { sendSms } from "./solapi";
import { kstToday } from "./surveySchedule";

export const REMINDER_AFTER_DAYS = 7;
const LATE_GRACE_DAYS = 2;
const REWARD_PER_SURVEY = 10_000; // 원, per completed 증상 설문
const SITE_URL = (process.env.SITE_URL ?? "https://cancerpatient.vercel.app").replace(/\/+$/, "");

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

export function buildReminderText(completedCount: number, link: string): string {
  const amount = (completedCount * REWARD_PER_SURVEY).toLocaleString("ko-KR");
  return [
    "안녕하세요! 한주간 잘 지내셨나요?",
    "이번주 설문 작성 부탁드립니다",
    "문의사항 있으면 언제든 알려주세요",
    "",
    `현재 적립금 : ${amount}원`,
    "",
    link,
  ].join("\n");
}

export type ReminderResult = {
  today: string;
  dryRun: boolean;
  sent: { patient_code: string; amount: number }[];
  would_send: { patient_code: string; amount: number; text: string }[];
  skipped: { patient_code: string; reason: string }[];
  failed: { patient_code: string; error: string }[];
};

export async function runReminders(opts: { dryRun?: boolean; today?: string } = {}): Promise<ReminderResult> {
  const dryRun = !!opts.dryRun;
  const today = opts.today ?? kstToday();
  const result: ReminderResult = { today, dryRun, sent: [], would_send: [], skipped: [], failed: [] };

  const sender = (process.env.SMS_SENDER ?? "").trim();
  if (!sender && !dryRun) throw new Error("SMS_SENDER 환경변수가 설정되지 않았습니다.");

  const rows = await sql`
    SELECT p.id, p.patient_code, p.contact, p.access_token,
      (SELECT (max(s.completed_at) AT TIME ZONE 'Asia/Seoul')::date::text
         FROM survey_sessions s
        WHERE s.patient_code = p.patient_code AND s.survey_type = 'pro_ctcae' AND s.is_complete) AS last_done,
      (SELECT count(*)::int FROM survey_sessions s
        WHERE s.patient_code = p.patient_code AND s.survey_type = 'pro_ctcae' AND s.is_complete) AS done_count
    FROM participants p
    WHERE p.enrolled = TRUE AND p.patient_code IS NOT NULL AND p.access_token IS NOT NULL
      AND p.research_types LIKE '%설문조사%'
  `;

  for (const r of rows) {
    const code = String(r.patient_code);
    const lastDone: string | null = r.last_done;
    if (!lastDone) { result.skipped.push({ patient_code: code, reason: "완료한 증상 설문 없음" }); continue; }

    const due = addDays(lastDone, REMINDER_AFTER_DAYS);
    if (today < due) { result.skipped.push({ patient_code: code, reason: `발송 예정일 ${due}` }); continue; }
    if (today > addDays(due, LATE_GRACE_DAYS)) { result.skipped.push({ patient_code: code, reason: "발송 기한 지남" }); continue; }

    const phone = String(r.contact ?? "").replace(/\D/g, "");
    if (!/^01\d{8,9}$/.test(phone)) { result.skipped.push({ patient_code: code, reason: "연락처 형식 오류" }); continue; }

    const amount = Number(r.done_count) * REWARD_PER_SURVEY;
    const text = buildReminderText(Number(r.done_count), `${SITE_URL}/s/${r.access_token}/pro`);

    if (dryRun) {
      const [sentAlready] = await sql`
        SELECT 1 FROM reminder_log WHERE participant_id = ${r.id} AND kind = 'pro_weekly' AND cycle_date = ${lastDone}::date
      `;
      if (sentAlready) result.skipped.push({ patient_code: code, reason: "이미 발송함" });
      else result.would_send.push({ patient_code: code, amount, text: text.replace(r.access_token, "<token>") });
      continue;
    }

    // Claim the (participant, cycle) first so two overlapping runs can't both send.
    const claimed = await sql`
      INSERT INTO reminder_log (participant_id, kind, cycle_date)
      VALUES (${r.id}, 'pro_weekly', ${lastDone}::date)
      ON CONFLICT DO NOTHING
      RETURNING id
    `;
    if (claimed.length === 0) { result.skipped.push({ patient_code: code, reason: "이미 발송함" }); continue; }

    try {
      await sendSms({ to: phone, from: sender, text });
      result.sent.push({ patient_code: code, amount });
    } catch (err) {
      await sql`DELETE FROM reminder_log WHERE id = ${claimed[0].id}`; // let the next run retry
      const message = err instanceof Error ? err.message.slice(0, 300) : "unknown error";
      console.error(`Reminder SMS failed for ${code}:`, message);
      result.failed.push({ patient_code: code, error: message });
    }
  }
  return result;
}
