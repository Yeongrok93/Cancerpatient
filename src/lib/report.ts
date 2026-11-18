// Clinic hand-out ("진료용 요약"): the symptoms a doctor should look at first —
// Grade 3 now, or Grade higher than at the previous survey — plus a short, data-derived
// summary of the key PRO-CTCAE findings (no researcher notes are printed). Pure functions: data in, self-contained printable HTML out
// (A4, inline SVG; only the Grade boxes are coloured), aimed at a single page.

import { SURVEY_ITEMS, CATEGORIES, RESPONSE_OPTIONS, itemApplies, type Sex, type SurveyItem, type QuestionType } from "./questions";
import { computeItemGrade, GRADE_LABELS } from "./proctcaeGrading";
import { formatPatientCode } from "./patientLabel";
import type { NotesSummary } from "./notesSummary";

/** Bump when the layout or wording of the document changes. Printed in the footer. */
export const REPORT_TEMPLATE_VERSION = "13";

/** `week`: position among all of the patient's completed surveys (0 = Baseline), kept when only a window is printed. */
export type ReportSession = { id: string; completed_at: string | null; week?: number };

/**
 * Which surveys the hand-out covers.
 *  - "first": no 항암일 on file before the print date → Baseline … the print date
 *  - "cycle": from 1 week before the latest 항암일 (`chemo`) to the print date
 *  - "all":   every survey
 * Comparisons ("Grade가 올라간 증상") are made against the window's first survey, except in "all" mode
 * (previous survey).
 */
export type ReportPeriod = {
  mode: "first" | "cycle" | "all";
  chemo: string | null; // YYYY-MM-DD
  chemoDates: string[]; // all 항암일 on file, oldest first
  asOf: string; // YYYY-MM-DD (KST)
};
export type ReportAnswer = {
  session_id: string;
  item_id: number;
  question_key: string;
  question_type: string;
  answer_value: number | null;
};

export type ReportInput = {
  code: string;
  name: string;
  /** Items that do not apply to this sex (e.g. erection items for a woman) are left out entirely. */
  sex?: Sex | null;
  sessions: ReportSession[]; // completed 증상 설문, oldest first
  answers: ReportAnswer[];
  notes: NotesSummary;
  /** Text of the researcher notes. It is never printed: symptoms it names are put first in the summary lines and starred. */
  notesText?: string | null;
  /** Language of the whole document (default Korean). */
  lang?: ReportLang;
  /** Printed as 작성일. Defaults to now; pass a date to regenerate a document "as of" that day. */
  generatedAt?: Date;
  /** Fingerprint of the printed data (see reportData.ts), shown in the footer. */
  dataId?: string;
  /** Adds a screen-only "print" bar and opens the print dialog on load. */
  autoPrint?: boolean;
  /** Researcher-written line printed under the title, bold + underlined (e.g. a survey week skipped because of symptom burden). */
  comment?: string | null;
  /** Survey window (see ReportPeriod). Without it the document behaves as "all". */
  period?: ReportPeriod;
};

type ItemSeries = { item: SurveyItem; grades: (number | null)[]; values: Record<string, number>[] };

export type ReportLang = "ko" | "en";

/** NCI PRO-CTCAE English response wording. */
const EN_OPTIONS: Record<QuestionType, string[]> = {
  frequency: ["Never", "Rarely", "Occasionally", "Frequently", "Almost constantly"],
  severity: ["None", "Mild", "Moderate", "Severe", "Very severe"],
  interference: ["Not at all", "A little bit", "Somewhat", "Quite a bit", "Very much"],
  presence: ["No", "Yes"],
};

const EN_CATEGORY: Record<string, string> = {
  구강: "Oral",
  소화기계: "Gastrointestinal",
  호흡기: "Respiratory",
  심혈관계: "Cardiovascular",
  "피부, 모발 및 손발톱": "Skin, Hair & Nails",
  "신경계 및 감각기계": "Neurologic & Sensory",
  통증: "Pain",
  "수면, 피로 및 정서": "Sleep, Fatigue & Mood",
  생식기계: "Reproductive",
  비뇨기계: "Urinary",
  성기능: "Sexual Function",
  "기타 전신 증상": "Other Systemic",
};

type Copy = {
  htmlLang: string;
  fontStack: string;
  title: string;
  pageTitle: (name: string) => string;
  issued: string;
  s1: string;
  s2: (ref: string) => string;
  refPrev: string;
  refBaseline: string;
  refPreChemo: string;
  refFirst: string;
  refShort: { prev: string; baseline: string; preChemo: string; first: string };
  chemoMark: (d: string) => string;
  missedRow: (d: string) => string;
  missedBar: string;
  s3: string;
  s3sub: string;
  sTraj: string;
  sTrajSub: string;
  s3recent: (n: number) => string;
  s4: string;
  noSessions: string;
  noneG3: string;
  noPrev: string;
  same: string;
  noNotes: string;
  sample: string;
  unit: (n: number) => string;
  week: (i: number) => string;
  printBar: string;
  printButton: string;
  footerTitle: string;
  footerPi: string;
  chartAria: string;
  grade: Record<number, string>;
  type: Record<QuestionType, string>;
  option: (type: QuestionType, value: number) => string;
};

const COPY: Record<ReportLang, Copy> = {
  ko: {
    htmlLang: "ko",
    fontStack: '"Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif',
    title: "PRO-CTCAE 증상 설문 요약",
    pageTitle: (n) => `${n} PRO-CTCAE 증상 설문 요약`,
    issued: "작성일",
    s1: "1. 현재 Grade 3 (중증) 증상",
    s2: (ref) => `2. ${ref}보다 Grade가 올라간 증상`,
    refPrev: "이전 설문",
    refBaseline: "Baseline",
    refPreChemo: "항암 전 설문",
    refFirst: "기간 첫 설문",
    refShort: { prev: "이전", baseline: "Baseline", preChemo: "항암 전", first: "기간 첫 설문" },
    chemoMark: (d) => `항암 ${d}`,
    missedRow: (d) => `미작성 (${d})`,
    missedBar: "N/A · 설문 미작성으로 증상부담 측정 안 됨",
    s3: "3. 증상 부담 추이",
    s3sub: "설문별 Grade별 증상 수",
    sTraj: "4. 증상별 변화",
    sTrajSub: "현재 Grade 3이 아닌 증상 중 Grade 2 이상이었던 것",
    s3recent: (n) => ` · 최근 ${n}회`,
    s4: "PRO-CTCAE 증상부담 요약",
    noSessions: "완료된 증상 설문이 없습니다.",
    noneG3: "해당하는 증상이 없습니다.",
    noPrev: "이전 설문이 없어 비교할 수 없습니다.",
    same: " 유지",
    noNotes: "작성된 연구자 노트가 없습니다.",
    sample: "샘플 문구입니다 — 이 환자의 실제 노트가 아니며 화면 구성을 보기 위한 예시입니다.",
    unit: (n) => `${n}개`,
    week: (i) => (i === 0 ? "Baseline" : `${i}주차`),
    printBar: "인쇄 창에서 대상을 “PDF로 저장”으로 선택하세요.",
    printButton: "인쇄 / PDF 저장",
    footerTitle: "외래기반 항체-약물 접합체(ADC) 치료를 받는 암 환자의 증상 부담 연구",
    footerPi: "연구책임자 서울대병원 김혜진 수간호사",
    chartAria: "Grade별 증상 수",
    grade: GRADE_LABELS,
    type: { frequency: "빈도", severity: "심각도", interference: "영향", presence: "유무" },
    option: (type, v) => RESPONSE_OPTIONS[type][v].replace(/\s*(있다|이다)$/, ""),
  },
  en: {
    htmlLang: "en",
    fontStack: '"Segoe UI", "Helvetica Neue", Arial, "Noto Sans KR", "Malgun Gothic", sans-serif',
    title: "PRO-CTCAE Symptom Summary",
    pageTitle: (n) => `${n} – PRO-CTCAE Symptom Summary`,
    issued: "Date",
    s1: "1. Current Grade 3 (Severe) Symptoms",
    s2: (ref) => `2. Symptoms with a Higher Grade than the ${ref}`,
    refPrev: "Previous Survey",
    refBaseline: "Baseline",
    refPreChemo: "Pre-treatment Survey",
    refFirst: "First Survey of the Period",
    refShort: { prev: "previous", baseline: "baseline", preChemo: "pre-treatment", first: "first of period" },
    chemoMark: (d) => `Treatment ${d}`,
    missedRow: (d) => `Not done (${d})`,
    missedBar: "N/A · survey not done, symptom burden not measured",
    s3: "3. Symptom Burden Trend",
    s3sub: "Number of symptoms at each grade, by survey",
    sTraj: "4. Symptom Trajectories",
    sTrajSub: "Symptoms not at Grade 3 now that reached Grade 2+",
    s3recent: (n) => ` · last ${n} surveys`,
    s4: "PRO-CTCAE Symptom Burden Summary",
    noSessions: "No completed symptom survey.",
    noneG3: "None.",
    noPrev: "No previous survey to compare with.",
    same: " unchanged",
    noNotes: "No researcher notes recorded.",
    sample: "Sample text — not this patient's actual notes; shown only to preview the layout.",
    unit: (n) => `${n} items`,
    week: (i) => (i === 0 ? "Baseline" : `Week ${i}`),
    printBar: 'In the print dialog, choose "Save as PDF" as the destination.',
    printButton: "Print / Save as PDF",
    footerTitle: "Symptom Burden in Cancer Patients Receiving Outpatient Antibody-Drug Conjugate (ADC) Therapy",
    footerPi: "Principal Investigator: Hyejin Kim, Head Nurse, Seoul National University Hospital",
    chartAria: "Number of symptoms by grade",
    grade: { 0: "None", 1: "Mild", 2: "Moderate", 3: "Severe" },
    type: { frequency: "Frequency", severity: "Severity", interference: "Interference", presence: "Presence" },
    option: (type, v) => EN_OPTIONS[type][v],
  },
};

/** Symptom name shown in the report: Korean name (+ its parenthetical note) or the NCI English term. */
function termParts(item: SurveyItem, lang: ReportLang): { main: string; note: string } {
  return lang === "en" ? { main: item.termEn, note: "" } : splitTerm(item.termKo);
}

const categoryLabel = (category: string, lang: ReportLang) => (lang === "en" ? EN_CATEGORY[category] ?? category : category);

const MAX_TREND_ROWS = 8;

/** Basch E, et al. Clin Trials 2021;18(1):104-114 (PMID 33258687). */
const GRADING_CITATION = "PRO-CTCAE Composite Grading Algorithm (Basch et al., 2021)";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const kstDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);

function mmdd(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = kstDate(new Date(iso)).split("-");
  return `${m}.${d}`;
}

/** Week label of the survey at position `i` of the printed list (its week among all the patient's surveys). */
function weekName(sessions: ReportSession[], i: number, c: Copy): string {
  return c.week(sessions[i]?.week ?? i);
}

const sessionDay = (s: ReportSession) => (s.completed_at ? kstDate(new Date(s.completed_at)) : "");

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * 86_400_000).toISOString().slice(0, 10);
}

const dayGap = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** Something that happened between two printed surveys: a 항암일, or a weekly survey that was never done. */
export type TimelineEvent = { kind: "chemo" | "missed"; date: string };

/**
 * Events placed between the printed surveys. `before[i]` = events after survey i-1 and before survey i, oldest first;
 * `tail` = after the last survey (up to the print date).
 *  - 항암일: a survey on the 항암일 itself counts as before treatment; 항암일 on/after the print date or on/before the
 *    first printed survey are left out.
 *  - Missed weeks: surveys are weekly, so a gap of about 2 weeks between two surveys (or from the last survey to the
 *    print date) means one survey week was skipped — shown as N/A rather than silently left out.
 */
function timelineEvents(sessions: ReportSession[], chemoDates: string[], asOf: string): { before: TimelineEvent[][]; tail: TimelineEvent[] } {
  const days = sessions.map(sessionDay);
  const before: TimelineEvent[][] = sessions.map(() => []);
  const tail: TimelineEvent[] = [];
  if (days.length === 0) return { before, tail };
  for (const d of chemoDates) {
    if (d >= asOf || d <= days[0]) continue;
    const i = days.findIndex((day) => day > d);
    (i === -1 ? tail : before[i]).push({ kind: "chemo", date: d });
  }
  const missed = (from: string, to: string, into: TimelineEvent[]) => {
    if (!from || !to) return;
    const n = Math.round(dayGap(from, to) / 7) - 1;
    for (let k = 1; k <= n; k++) into.push({ kind: "missed", date: addDays(from, 7 * k) });
  };
  for (let i = 1; i < days.length; i++) missed(days[i - 1], days[i], before[i]);
  missed(days[days.length - 1], asOf, tail);
  const byDate = (a: TimelineEvent, b: TimelineEvent) => a.date.localeCompare(b.date) || (a.kind === "chemo" ? -1 : 1);
  before.forEach((list) => list.sort(byDate));
  tail.sort(byDate);
  return { before, tail };
}

const dot = (ymd: string) => `${ymd.slice(5, 7)}.${ymd.slice(8, 10)}`;

export function splitTerm(term: string): { main: string; note: string } {
  const m = term.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { main: m[1], note: m[2] } : { main: term, note: "" };
}

function buildSeries(input: ReportInput): ItemSeries[] {
  const byItemSession = new Map<string, Record<string, number>>();
  for (const a of input.answers) {
    if (a.answer_value === null) continue;
    const key = `${a.item_id}|${a.session_id}`;
    const cur = byItemSession.get(key) ?? {};
    cur[a.question_key] = a.answer_value;
    byItemSession.set(key, cur);
  }
  const out: ItemSeries[] = [];
  for (const item of SURVEY_ITEMS) {
    if (!itemApplies(item.id, input.sex)) continue;
    const values = input.sessions.map((s) => byItemSession.get(`${item.id}|${s.id}`) ?? {});
    const grades = values.map((v) => (Object.keys(v).length ? computeItemGrade(item, v) : null));
    if (grades.some((g) => g !== null)) out.push({ item, grades, values });
  }
  return out;
}

// ── visuals (inline SVG / CSS, grayscale) ────────────────────────────────

// Same grade colours as the admin dashboard (muted amber → orange → red); the number stays in the box,
// so the grade is still readable on a black-and-white print.
const FILL: Record<number, { bg: string; fg: string }> = {
  0: { bg: "#ffffff", fg: "#666666" },
  1: { bg: "#fde68a", fg: "#78350f" },
  2: { bg: "#fb923c", fg: "#111111" },
  3: { bg: "#dc2626", fg: "#ffffff" },
};

const missedBox = () => `<span class="gb gb-miss">N/A</span>`;

function gradeBox(g: number | null): string {
  if (g === null) return `<span class="gb gb-na">–</span>`;
  const { bg, fg } = FILL[g];
  return `<span class="gb" style="background:${bg};color:${fg}">${g}</span>`;
}

/** Small line chart of one symptom's grade across surveys (only drawn from 3 surveys on). */
function sparkline(grades: (number | null)[]): string {
  const w = 64, h = 20, padX = 5, padY = 3;
  const n = grades.length;
  const x = (i: number) => padX + (i * (w - padX * 2)) / (n - 1);
  const y = (g: number) => h - padY - (g * (h - padY * 2)) / 3;
  const defined = grades
    .map((g, i) => (g === null ? null : { x: x(i), y: y(g) }))
    .filter((p): p is { x: number; y: number } => p !== null);
  const grid = [0, 3]
    .map((g) => `<line x1="2" x2="${w - 2}" y1="${y(g)}" y2="${y(g)}" stroke="#dddddd" stroke-width="0.7"/>`)
    .join("");
  const line = defined.length > 1 ? `<polyline fill="none" stroke="#333" stroke-width="1.2" points="${defined.map((p) => `${p.x},${p.y}`).join(" ")}"/>` : "";
  const dots = defined
    .map((p, k) => `<circle cx="${p.x}" cy="${p.y}" r="${k === defined.length - 1 ? 2.8 : 2}" fill="${k === defined.length - 1 ? "#111" : "#fff"}" stroke="#111" stroke-width="1"/>`)
    .join("");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="grade trend">${grid}${line}${dots}</svg>`;
}

/** One stacked bar per survey: how many symptoms sat at each grade. */
function distributionChart(
  series: ItemSeries[],
  sessions: ReportSession[],
  c: Copy,
  markers: { before: TimelineEvent[][]; tail: TimelineEvent[] }
): string {
  const first = Math.max(0, sessions.length - MAX_TREND_ROWS);
  const shown = sessions.map((s, i) => ({ s, i })).slice(first);
  const rowH = 19, barH = 12, labelW = 98, barW = 390, totalW = 64, markH = 13;
  const rows = shown.map(({ s, i }) => {
    const counts = [0, 0, 0, 0];
    for (const it of series) {
      const g = it.grades[i];
      if (g !== null) counts[g] += 1;
    }
    return { label: `${weekName(sessions, i, c)} (${mmdd(s.completed_at)})`, counts, total: counts.reduce((a, b) => a + b, 0), marks: markers.before[i] };
  });
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  // Layout: each 항암일 is a dashed line above the first survey after it; a skipped week is its own N/A row.
  let y = 2;
  const markLine = (d: string, yy: number) =>
    `<line x1="${labelW - 2}" x2="${labelW + barW}" y1="${yy + 6}" y2="${yy + 6}" stroke="#6d28d9" stroke-width="1" stroke-dasharray="3 2"/>` +
    `<text x="${labelW - 6}" y="${yy + 9}" text-anchor="end" font-size="9" font-weight="700" fill="#6d28d9">▼ ${esc(c.chemoMark(dot(d)))}</text>`;
  const missedRow = (d: string, yy: number) =>
    `<text x="${labelW - 6}" y="${yy + 9.5}" text-anchor="end" font-size="9.5" fill="#555">${esc(c.missedRow(dot(d)))}</text>` +
    `<rect x="${labelW}" y="${yy}" width="${barW}" height="${barH}" fill="#f3f4f6" stroke="#9ca3af" stroke-width="0.8" stroke-dasharray="3 2"/>` +
    `<text x="${labelW + barW / 2}" y="${yy + 9.5}" text-anchor="middle" font-size="9" font-weight="700" fill="#4b5563">${esc(c.missedBar)}</text>`;
  const parts: string[] = [];
  const event = (e: TimelineEvent) => {
    if (e.kind === "chemo") {
      parts.push(markLine(e.date, y));
      y += markH;
    } else {
      parts.push(missedRow(e.date, y));
      y += rowH;
    }
  };
  const tops = rows.map((r) => {
    r.marks.forEach(event);
    const top = y;
    y += rowH;
    return top;
  });
  markers.tail.forEach(event);
  const height = y;
  const bars = rows
    .map((r, i) => {
      const yTop = tops[i];
      let xCur = labelW;
      const segs = r.counts
        .map((c, g) => {
          if (c === 0) return "";
          const wSeg = (c / maxTotal) * barW;
          const rect = `<rect x="${xCur}" y="${yTop}" width="${wSeg}" height="${barH}" fill="${FILL[g].bg}" stroke="#111" stroke-width="0.7"/>`;
          const txt = wSeg > 14 ? `<text x="${xCur + wSeg / 2}" y="${yTop + 9.5}" text-anchor="middle" font-size="9" fill="${FILL[g].fg}">${c}</text>` : "";
          xCur += wSeg;
          return rect + txt;
        })
        .join("");
      return `<text x="${labelW - 6}" y="${yTop + 9.5}" text-anchor="end" font-size="9.5" fill="#222">${esc(r.label)}</text>${segs}<text x="${labelW + barW + 6}" y="${yTop + 9.5}" font-size="9.5" fill="#222">${c.unit(r.total)}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${labelW + barW + totalW} ${height}" width="100%" role="img" aria-label="${esc(c.chartAria)}">${parts.join("")}${bars}</svg>`;
}

function legend(c: Copy): string {
  return [0, 1, 2, 3]
    .map((g) => `<span class="lg"><span class="gb sm" style="background:${FILL[g].bg};color:${FILL[g].fg}">${g}</span>${esc(c.grade[g])}</span>`)
    .join("");
}

/** "빈도 자주 · 심각도 심하다 · 영향 상당히" — the current answers, shortened to fit half a page. */
function shortAnswers(it: ItemSeries, sessionIndex: number, c: Copy): string {
  const v = it.values[sessionIndex];
  return it.item.questions
    .map((q) => (v[q.key] === undefined ? null : `${c.type[q.type]} ${c.option(q.type, v[q.key])}`))
    .filter(Boolean)
    .join(" · ");
}

/** One answer sits beside the name; several go on their own line underneath. */
function responseHtml(text: string): string {
  if (!text) return "";
  return text.includes(" · ") ? `<div class="resp">${esc(text)}</div>` : `<span class="resp inl">${esc(text)}</span>`;
}

function notesHtml(notes: NotesSummary, c: Copy): string {
  if (notes.kind === "none") return `<p class="muted">${esc(c.noNotes)}</p>`;
  if (notes.kind === "unavailable") return `<p class="muted">${esc(notes.reason)}</p>`;
  const lines = notes.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = lines.map((l) => `<li>${esc(l.replace(/^[-•·*]\s*/, ""))}</li>`).join("");
  const meta =
    notes.kind === "sample"
      ? `<p class="sample">${esc(c.sample)}</p>`
      : "";
  return `<ul class="notes">${items}</ul>${meta}`;
}

// ── key findings (computed only from the PRO-CTCAE answers) ─────────────

type KeyRow = { it: ItemSeries; cur: number | null; prev: number | null };

/** Grade-3 items per category, e.g. "통증 4 · 수면, 피로 및 정서 3". */
function categoryCounts(rows: KeyRow[], lang: ReportLang): string {
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.it.item.category, (counts.get(r.it.item.category) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([cat, n]) => `${categoryLabel(cat, lang)} ${n}${lang === "ko" ? "개" : ""}`)
    .join(", ");
}

/** Words in the researcher notes that mean a PRO-CTCAE symptom although the item has a different name. */
const NOTE_ALIASES: Record<string, string[]> = {
  불안감: ["불안"],
  어지럼증: ["어지러"],
  피로감: ["피로"],
  슬픔: ["우울"],
  Anxiety: ["anxiety", "anxious"],
  Dizziness: ["dizz"],
};

/** Symptoms the researcher notes single out: the symptom's name (or an alias) appears in the notes. */
function noteEmphasisIds(rows: KeyRow[], lang: ReportLang, notesText: string | null | undefined): Set<number> {
  const text = (notesText ?? "").toLowerCase();
  const ids = new Set<number>();
  if (!text) return ids;
  for (const r of rows) {
    const main = termParts(r.it.item, lang).main;
    const words = [main, ...(NOTE_ALIASES[main] ?? [])].map((w) => w.toLowerCase());
    if (words.some((w) => w.length >= 2 && text.includes(w))) ids.add(r.it.item.id);
  }
  return ids;
}

/** A few terse lines for a doctor who reads only this box. Symptoms the notes single out come first in each list, marked ★. */
function keyFindings(rows: KeyRow[], last: number, hasRef: boolean, refWord: string, lang: ReportLang, emph: Set<number>): string[] {
  if (last < 0) return [];
  const ko = lang === "ko";
  const name = (r: KeyRow) => `${emph.has(r.it.item.id) ? "★ " : ""}${termParts(r.it.item, lang).main}`;
  const join = (rs: KeyRow[], max = 5) => {
    const ordered = [...rs].sort((x, y) => Number(emph.has(y.it.item.id)) - Number(emph.has(x.it.item.id)));
    const shown = ordered.slice(0, max).map(name).join(", ");
    return ordered.length > max ? shown + (ko ? ` 외 ${ordered.length - max}개` : ` +${ordered.length - max} more`) : shown;
  };
  const hasPrev = hasRef;
  const graded = rows.filter((r) => r.cur !== null);
  const g3 = graded.filter((r) => r.cur === 3);
  const out: string[] = [];

  // 1. Grade 3 count (with the reference survey's count) and where they cluster
  const g3Prev = hasPrev ? rows.filter((r) => r.prev === 3).length : null;
  const where = g3.length >= 2 ? `: ${categoryCounts(g3, lang)}` : "";
  if (g3.length === 0) out.push(ko ? "Grade 3 증상 없음" : "No Grade 3 symptoms");
  else
    out.push(
      ko
        ? `Grade 3 증상 ${g3.length}개${g3Prev !== null ? ` (${refWord} ${g3Prev}개)` : ""}${where}`
        : `Grade 3 symptoms: ${g3.length}${g3Prev !== null ? ` (${refWord} ${g3Prev})` : ""}${where}`
    );

  // 2. newly Grade 3
  if (hasPrev) {
    const newG3 = g3.filter((r) => r.prev !== null && r.prev < 3);
    if (newG3.length > 0) out.push(ko ? `새로 Grade 3 (${newG3.length}개): ${join(newG3)}` : `New Grade 3 (${newG3.length}): ${join(newG3)}`);
  }

  // 3. daily-life interference reported as "quite a bit" or more
  const heavy = graded.filter((r) => {
    const q = r.it.item.questions.find((x) => x.type === "interference");
    const v = q ? r.it.values[last][q.key] : undefined;
    return v !== undefined && v >= 3;
  });
  if (heavy.length > 0)
    out.push(ko ? `일상 방해 “상당히” 이상 (${heavy.length}개): ${join(heavy)}` : `Interferes “quite a bit” or more (${heavy.length}): ${join(heavy)}`);

  // 4. improvement
  if (hasPrev) {
    const better = graded.filter((r) => r.prev !== null && r.prev >= 2 && r.cur! < r.prev);
    if (better.length > 0) out.push(ko ? `호전 (${better.length}개): ${join(better)}` : `Improved (${better.length}): ${join(better)}`);
  }
  return out;
}

function keyFindingsHtml(lines: string[]): string {
  return `<ul class="notes">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
}

// ── the document ────────────────────────────────────────────────────────

export function renderReportHtml(input: ReportInput): string {
  const { sessions } = input;
  const lang: ReportLang = input.lang ?? "ko";
  const c = COPY[lang];
  const generatedAt = input.generatedAt ?? new Date();
  const displayName = input.name.trim() || formatPatientCode(input.code);
  const series = buildSeries(input);
  const last = sessions.length - 1;
  const showSpark = sessions.length >= 3;

  // Reference survey for "올라간 증상": the window's first survey (pre-treatment / Baseline), or the previous one in "all" mode.
  const period = input.period;
  const mode = period?.mode ?? "all";
  const ref = last < 1 ? -1 : mode === "all" ? last - 1 : 0;
  const preChemo = mode === "cycle" && period?.chemo && ref === 0 && sessionDay(sessions[0]) <= period.chemo;
  const refKey: keyof Copy["refShort"] =
    mode === "all" ? "prev" : mode === "first" && sessions[0]?.week === 0 ? "baseline" : preChemo ? "preChemo" : mode === "cycle" ? "first" : "prev";
  const refName = { prev: c.refPrev, baseline: c.refBaseline, preChemo: c.refPreChemo, first: c.refFirst }[refKey];
  const prevLabel = ref >= 0 ? `${weekName(sessions, ref, c)} (${mmdd(sessions[ref].completed_at)})` : null;
  const markers = timelineEvents(sessions, period?.chemoDates ?? [], period?.asOf ?? kstDate(generatedAt));


  const rows = series.map((it) => {
    const cur = last >= 0 ? it.grades[last] : null;
    const prev = ref >= 0 ? it.grades[ref] : null;
    return { it, cur, prev, grade3: cur === 3, increased: cur !== null && prev !== null && cur > prev };
  });
  type Row = (typeof rows)[number];
  const grade3Rows = rows.filter((r) => r.grade3);
  const upRows = rows.filter((r) => r.increased && !r.grade3);

  const emph = noteEmphasisIds(rows, lang, input.notesText);
  const itemHtml = (r: Row, withResponse: boolean): string => {
    const { main, note } = termParts(r.it.item, lang);
    const same = r.prev !== null && r.cur === r.prev;
    return `<div class="it">
      <div class="gg">${gradeBox(r.prev)}<span class="ar${r.increased ? " up" : ""}">${r.increased ? "▲" : "→"}</span>${gradeBox(r.cur)}</div>
      <div class="tx"><b>${esc(main)}</b>${emph.has(r.it.item.id) ? `<span class="star">★</span>` : ""}${note ? `<span class="note"> ${esc(note)}</span>` : ""}${same ? `<span class="same">${esc(c.same)}</span>` : ""}${
        withResponse ? responseHtml(shortAnswers(r.it, last, c)) : ""
      }</div>
      ${showSpark ? sparkline(r.it.grades) : ""}
    </div>`;
  };

  const columnsHtml = (list: Row[], withResponse: boolean): string => {
    const blocks = CATEGORIES.map((category) => {
      const inCat = list
        .filter((r) => r.it.item.category === category)
        .sort((x, y) => (y.cur ?? 0) - (y.prev ?? 0) - ((x.cur ?? 0) - (x.prev ?? 0)) || x.it.item.id - y.it.item.id);
      return inCat.length === 0
        ? ""
        : `<div class="cb"><div class="ch">${esc(categoryLabel(category, lang))}</div>${inCat.map((r) => itemHtml(r, withResponse)).join("")}</div>`;
    }).join("");
    return `<div class="cols">${blocks}</div>`;
  };

  /** Compact list for the secondary section: category label, then chips "[0▲1] 구토". */
  const chipRowsHtml = (list: Row[]): string =>
    CATEGORIES.map((category) => {
      const inCat = list
        .filter((r) => r.it.item.category === category)
        .sort((x, y) => (y.cur ?? 0) - (y.prev ?? 0) - ((x.cur ?? 0) - (x.prev ?? 0)) || x.it.item.id - y.it.item.id);
      if (inCat.length === 0) return "";
      const chips = inCat
        .map(
          (r) =>
            `<span class="chip">${gradeBox(r.prev)}<span class="ar up">▲</span>${gradeBox(r.cur)}<b>${esc(termParts(r.it.item, lang).main)}</b></span>`
        )
        .join("");
      return `<div class="ir"><span class="irc">${esc(categoryLabel(category, lang))}</span><span class="chips">${chips}</span></div>`;
    }).join("");

  /** Item-level course across all surveys, e.g. [2]→[2]→[1] 입마름. Shown from 3 surveys on. */
  const trajHtml = (): string => {
    if (sessions.length < 3) return "";
    // Symptoms at Grade 3 now already carry their own trend line in section 1.
    const list = series
      .filter((it) => {
        if (it.grades[last] === 3) return false;
        const g = it.grades.filter((x): x is number => x !== null);
        return g.length > 0 && Math.max(...g) >= 2;
      })
      .map((it) => ({ it, lastG: it.grades[last] ?? 0, maxG: Math.max(...it.grades.map((x) => x ?? 0)) }))
      .sort((x, y) => y.lastG - x.lastG || y.maxG - x.maxG || x.it.item.id - y.it.item.id);
    if (list.length === 0) return "";
    const chip = (r: (typeof list)[number]) => {
      const boxes = r.it.grades
        .flatMap((g, i) => [...markers.before[i].filter((e) => e.kind === "missed").map(missedBox), gradeBox(g)])
        .concat(markers.tail.filter((e) => e.kind === "missed").map(missedBox))
        .join(`<span class="ar">→</span>`);
      const dir = r.lastG > (r.it.grades[0] ?? 0) ? "▲" : r.lastG < (r.it.grades[0] ?? 0) ? "▼" : "";
      return `<div class="tj"><div class="gg">${boxes}</div><b>${esc(termParts(r.it.item, lang).main)}</b>${emph.has(r.it.item.id) ? `<span class="star">★</span>` : ""}${dir ? `<span class="dir">${dir}</span>` : ""}</div>`;
    };
    const blocks = CATEGORIES.map((category) => {
      const inCat = list.filter((r) => r.it.item.category === category);
      return inCat.length === 0 ? "" : `<div class="cb"><div class="ch">${esc(categoryLabel(category, lang))}</div>${inCat.map(chip).join("")}</div>`;
    }).join("");
    const ev = (e: TimelineEvent) => (e.kind === "chemo" ? `▼${c.chemoMark(dot(e.date))}` : `N/A ${c.missedRow(dot(e.date))}`);
    const heads = sessions
      .map((x, i) => [...markers.before[i].map(ev), `${weekName(sessions, i, c)} ${mmdd(x.completed_at)}`].join(" → "))
      .concat(markers.tail.map(ev))
      .join(" → ");
    return `<h2>${esc(c.sTraj)} <span class="cnt">${esc(c.sTrajSub)}</span></h2><p class="muted" style="margin:2px 0 4px;font-size:8pt">${esc(heads)}</p><div class="cols cols3">${blocks}</div>`;
  };
  const trajSection = trajHtml();

  const body =
    sessions.length === 0
      ? `<p class="muted">${esc(c.noSessions)}</p>`
      : `
    <div class="legend">${legend(c)}<span class="muted">${GRADING_CITATION}</span></div>

    <h2>${esc(c.s1)}</h2>
    ${grade3Rows.length === 0 ? `<p class="none">${esc(c.noneG3)}</p>` : columnsHtml(grade3Rows, true)}

    <h2>${esc(c.s2(refName))}${prevLabel ? ` <span class="cnt">${esc(prevLabel)}</span>` : ""}</h2>
    ${!prevLabel ? `<p class="none">${esc(c.noPrev)}</p>` : upRows.length === 0 ? `<p class="none">${esc(c.noneG3)}</p>` : chipRowsHtml(upRows)}

    <h2>${esc(c.s3)} <span class="cnt">${esc(c.s3sub)}${sessions.length > MAX_TREND_ROWS ? esc(c.s3recent(MAX_TREND_ROWS)) : ""}</span></h2>
    ${distributionChart(series, sessions, c, markers)}

    ${trajSection}`;

  return `<!doctype html>
<html lang="${c.htmlLang}">
<head>
<meta charset="utf-8">
<title>${esc(c.pageTitle(displayName))}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="report-data-id" content="${esc(input.dataId ?? "")}">
<meta name="report-template" content="v${REPORT_TEMPLATE_VERSION}">
<style>
  @page { size: A4; margin: 7mm 12mm 7mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #111; font: 9pt/1.4 ${c.fontStack}; background: #fff; }
  .page { max-width: 184mm; margin: 0 auto; padding: 6mm 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 5px; margin-bottom: 8px; }
  header .ttl { font-size: 14.5pt; font-weight: 700; letter-spacing: -0.2px; line-height: 1.2; }
  header .who { text-align: right; font-size: 9pt; white-space: nowrap; } header .who b { font-size: 11pt; }
  h2 { font-size: 10pt; margin: 6px 0 3px; padding-bottom: 2px; border-bottom: 1px solid #999; }
  h2 .cnt { font-weight: 400; font-size: 8.5pt; color: #555; margin-left: 6px; }
  .muted { color: #555; } p.muted { margin: 2px 0; }
  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 12px; margin: 5px 0 0; font-size: 8pt; }
  .lg { display: inline-flex; align-items: center; }
  .cols { column-count: 2; column-gap: 7mm; column-rule: 1px solid #e3e3e3; }
  .cb { break-inside: avoid; margin-bottom: 3px; }
  .ch { font-size: 8.5pt; font-weight: 700; padding: 1px 0 2px; border-bottom: 1px solid #111; margin-bottom: 1px; }
  .it { display: flex; align-items: center; gap: 6px; padding: 2px 0; border-bottom: 1px solid #ececec; break-inside: avoid; }
  .gg { display: flex; align-items: center; gap: 2px; flex: none; }
  .ar { font-size: 7.5pt; color: #666; width: 10px; text-align: center; } .ar.up { color: #111; font-weight: 700; }
  .tx { flex: 1; min-width: 0; line-height: 1.3; } .tx b { font-size: 9.2pt; }
  .note { font-size: 7.5pt; color: #555; } .same { font-size: 7.5pt; color: #777; }
  .resp { font-size: 7.5pt; color: #333; } .resp.inl { margin-left: 5px; }
  .ir { display: flex; gap: 8px; align-items: flex-start; padding: 3px 0; border-bottom: 1px solid #ececec; }
  .irc { flex: none; width: 24mm; font-size: 8.5pt; font-weight: 700; padding-top: 1px; }
  .chips { display: flex; flex-wrap: wrap; gap: 3px 14px; }
  .chip { display: inline-flex; align-items: center; gap: 2px; white-space: nowrap; } .chip b { margin-left: 4px; font-size: 9pt; }
  .gb { display: inline-block; min-width: 17px; height: 17px; line-height: 15px; text-align: center; border: 1px solid #111; font-weight: 700; font-size: 8.5pt; }
  .gb.sm { min-width: 14px; height: 14px; line-height: 12px; font-size: 7.5pt; margin-right: 3px; }
  .gb-na { border-color: #bbb; color: #999; font-weight: 400; }
  .gb-miss { border: 1px dashed #6b7280; background: #f3f4f6; color: #374151; font-size: 6.5pt; min-width: 22px; }
  .cmt { margin: 0 0 5px; font-size: 10pt; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
  .spark { flex: none; }
  .cols3 { column-count: 3; column-gap: 5mm; }
  .cols3 .ch { font-size: 8pt; }
  .cols3 .tj { padding: 1px 0; gap: 4px; } .cols3 .tj b { font-size: 8.6pt; }
  .cols3 .gb { min-width: 15px; height: 15px; line-height: 13px; font-size: 8pt; }
  .tj { display: flex; align-items: center; gap: 6px; padding: 2px 0; border-bottom: 1px solid #ececec; break-inside: avoid; }
  .tj b { font-size: 9.2pt; } .dir { font-size: 7.5pt; margin-left: 4px; }
  .none { padding: 6px; border: 1px dashed #999; text-align: center; margin: 3px 0; }
  svg text { font-family: inherit; }
  ul.notes { margin: 3px 0 0; padding-left: 16px; } ul.notes li { margin: 2px 0; }
  .sample { border: 1px dashed #111; padding: 3px 7px; font-size: 8pt; margin: 4px 0 0; }
  section.notes-block { break-inside: avoid; }
  .star { margin-left: 4px; font-size: 8.5pt; }
  footer { margin-top: 5px; padding-top: 4px; border-top: 1px solid #999; font-size: 8pt; color: #333; display: flex; justify-content: space-between; gap: 12px; }
  .bar { position: sticky; top: 0; background: #111; color: #fff; padding: 8px 14px; font-size: 10pt; display: flex; justify-content: space-between; align-items: center; }
  .bar button { font: inherit; padding: 4px 12px; border: 1px solid #fff; background: #fff; color: #111; cursor: pointer; }
  @media print { .bar { display: none; } .page { padding: 0; max-width: none; } }
</style>
</head>
<body>
${input.autoPrint ? `<div class="bar"><span>${esc(c.printBar)}</span><button onclick="window.print()">${esc(c.printButton)}</button></div>` : ""}
<div class="page">
  <header>
    <div class="ttl">${esc(c.title)}</div>
    <div class="who"><b>${esc(displayName)}</b><br>${esc(c.issued)} ${esc(kstDate(generatedAt).replace(/-/g, "."))}</div>
  </header>
  ${input.comment?.trim() ? `<p class="cmt">※ ${esc(input.comment.trim())}</p>` : ""}

  ${body}

  ${
    sessions.length === 0
      ? ""
      : `<section class="notes-block">
    <h2>${trajSection ? 5 : 4}. ${esc(c.s4)}</h2>
    ${keyFindingsHtml(keyFindings(rows, last, ref >= 0, c.refShort[refKey], lang, emph))}
  </section>`
  }

  <footer>
    <span>${esc(c.footerTitle)}</span>
    <span>${esc(c.footerPi)}</span>
  </footer>
</div>
<script>
// Keep the hand-out on one A4 page: if the content is taller than the printable area, zoom it down.
(function () {
  var AVAIL = (297 - 14) * 96 / 25.4 * 0.96; // A4 height minus the @page margins, in CSS px (4% slack for print rounding)
  function fit() {
    var p = document.querySelector(".page");
    if (!p) return;
    p.style.zoom = "";
    var cs = getComputedStyle(p);
    var h = p.scrollHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (h > AVAIL) p.style.zoom = String(Math.max(0.55, AVAIL / h));
  }
  fit();
  window.addEventListener("load", fit);
  window.addEventListener("beforeprint", fit);
})();
</script>
${input.autoPrint ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 400); });</script>` : ""}
</body>
</html>`;
}
