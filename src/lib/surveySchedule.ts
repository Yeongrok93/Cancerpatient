// Pure date logic for when the quarterly QLQ-C30 (삶의 질) survey is open.
// All dates are "YYYY-MM-DD" strings in Korea time (KST); weeks run Mon–Sun.

const DAY_MS = 86_400_000;

/** QLQ-C30 opens every 12 weeks counted from the participant's start date. */
export const QLQ_INTERVAL_WEEKS = 12;

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's date in Korea, regardless of the server's timezone. */
export function kstToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}

/** Monday of the week containing `date`. */
function weekStart(date: string): number {
  const ms = toUtc(date);
  const dow = new Date(ms).getUTCDay(); // 0 = Sunday
  return ms - ((dow + 6) % 7) * DAY_MS;
}

export type QlqWindow = { from: string; to: string };

/** The Mon–Sun week that contains the k-th 12-week mark after `start`. */
export function qlqWindow(start: string, k: number): QlqWindow {
  const mark = fromUtc(toUtc(start) + k * QLQ_INTERVAL_WEEKS * 7 * DAY_MS);
  const from = weekStart(mark);
  return { from: fromUtc(from), to: fromUtc(from + 6 * DAY_MS) };
}

/**
 * Where `today` sits relative to the quarterly windows: inside one (`current`),
 * otherwise only the upcoming one (`next`). The first window is the week
 * containing week 12 — there is no window at the start itself.
 */
export function qlqStatus(start: string, today: string): { current: QlqWindow | null; next: QlqWindow } {
  for (let k = 1; k < 400; k++) {
    const w = qlqWindow(start, k);
    if (today <= w.to) {
      return today >= w.from ? { current: w, next: w } : { current: null, next: w };
    }
  }
  const w = qlqWindow(start, 400);
  return { current: null, next: w };
}

/** "10월 7일" style label for a YYYY-MM-DD string. */
export function formatMonthDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}월 ${d}일`;
}
