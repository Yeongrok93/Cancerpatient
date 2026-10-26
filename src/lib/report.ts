// Clinic hand-out ("진료용 요약"): the symptoms a doctor should look at first —
// Grade 3 now, or Grade higher than at the previous survey — plus a short, data-derived
// summary of the key PRO-CTCAE findings (no researcher notes are printed). Pure functions: data in, self-contained printable HTML out
// (A4, inline SVG; only the Grade boxes are coloured), aimed at a single page.

import { SURVEY_ITEMS, CATEGORIES, RESPONSE_OPTIONS, itemApplies, type Sex, type SurveyItem, type QuestionType } from "./questions";
import { computeItemGrade, GRADE_LABELS } from "./proctcaeGrading";
import { formatPatientCode } from "./patientLabel";
import type { NotesSummary } from "./notesSummary";

/** Bump when the layout or wording of the document changes. Printed in the footer. */
export const REPORT_TEMPLATE_VERSION = "8";

export type ReportSession = { id: string; completed_at: string | null };
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
  s2: string;
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
    s2: "2. 이전 설문보다 Grade가 올라간 증상",
    s3: "3. 증상 부담 추이",
    s3sub: "설문별 Grade별 증상 수",
    sTraj: "4. 증상별 변화",
    sTrajSub: "Grade 2 이상이었거나 변화가 있었던 증상 (설문 순서대로)",
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
    s2: "2. Symptoms with a Higher Grade than the Previous Survey",
    s3: "3. Symptom Burden Trend",
    s3sub: "Number of symptoms at each grade, by survey",
    sTraj: "4. Symptom Trajectories",
    sTrajSub: "Symptoms that reached Grade 2+ or changed (in survey order)",
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

function weekName(i: number, c: Copy): string {
  return c.week(i);
}

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
function distributionChart(series: ItemSeries[], sessions: ReportSession[], c: Copy): string {
  const first = Math.max(0, sessions.length - MAX_TREND_ROWS);
  const shown = sessions.map((s, i) => ({ s, i })).slice(first);
  const rowH = 19, barH = 12, labelW = 98, barW = 390, totalW = 64;
  const rows = shown.map(({ s, i }) => {
    const counts = [0, 0, 0, 0];
    for (const it of series) {
      const g = it.grades[i];
      if (g !== null) counts[g] += 1;
    }
    return { label: `${weekName(i, c)} (${mmdd(s.completed_at)})`, counts, total: counts.reduce((a, b) => a + b, 0) };
  });
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const height = rows.length * rowH + 2;
  const bars = rows
    .map((r, i) => {
      const yTop = i * rowH + 2;
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
  return `<svg viewBox="0 0 ${labelW + barW + totalW} ${height}" width="100%" role="img" aria-label="${esc(c.chartAria)}">${bars}</svg>`;
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
function keyFindings(rows: KeyRow[], sessions: ReportSession[], last: number, lang: ReportLang, emph: Set<number>): string[] {
  if (last < 0) return [];
  const ko = lang === "ko";
  const name = (r: KeyRow) => `${emph.has(r.it.item.id) ? "★ " : ""}${termParts(r.it.item, lang).main}`;
  const join = (rs: KeyRow[], max = 5) => {
    const ordered = [...rs].sort((x, y) => Number(emph.has(y.it.item.id)) - Number(emph.has(x.it.item.id)));
    const shown = ordered.slice(0, max).map(name).join(", ");
    return ordered.length > max ? shown + (ko ? ` 외 ${ordered.length - max}개` : ` +${ordered.length - max} more`) : shown;
  };
  const hasPrev = last >= 1;
  const graded = rows.filter((r) => r.cur !== null);
  const g3 = graded.filter((r) => r.cur === 3);
  const out: string[] = [];

  // 1. Grade 3 count (with the previous count) and where they cluster
  const g3Prev = hasPrev ? rows.filter((r) => r.prev === 3).length : null;
  const where = g3.length >= 2 ? `: ${categoryCounts(g3, lang)}` : "";
  if (g3.length === 0) out.push(ko ? "Grade 3 증상 없음" : "No Grade 3 symptoms");
  else
    out.push(
      ko
        ? `Grade 3 증상 ${g3.length}개${g3Prev !== null ? ` (이전 ${g3Prev}개)` : ""}${where}`
        : `Grade 3 symptoms: ${g3.length}${g3Prev !== null ? ` (previous ${g3Prev})` : ""}${where}`
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

  const prevLabel = last >= 1 ? `${weekName(last - 1, c)} (${mmdd(sessions[last - 1].completed_at)})` : null;

  const rows = series.map((it) => {
    const cur = last >= 0 ? it.grades[last] : null;
    const prev = last >= 1 ? it.grades[last - 1] : null;
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
    const list = series
      .filter((it) => {
        const g = it.grades.filter((x): x is number => x !== null);
        return g.length > 0 && (Math.max(...g) >= 2 || new Set(it.grades.map((x) => x ?? -1)).size > 1);
      })
      .map((it) => ({ it, lastG: it.grades[last] ?? 0, maxG: Math.max(...it.grades.map((x) => x ?? 0)) }))
      .sort((x, y) => y.lastG - x.lastG || y.maxG - x.maxG || x.it.item.id - y.it.item.id);
    if (list.length === 0) return "";
    const chip = (r: (typeof list)[number]) => {
      const boxes = r.it.grades.map((g) => gradeBox(g)).join(`<span class="ar">→</span>`);
      const dir = r.lastG > (r.it.grades[0] ?? 0) ? "▲" : r.lastG < (r.it.grades[0] ?? 0) ? "▼" : "";
      return `<div class="tj"><div class="gg">${boxes}</div><b>${esc(termParts(r.it.item, lang).main)}</b>${emph.has(r.it.item.id) ? `<span class="star">★</span>` : ""}${dir ? `<span class="dir">${dir}</span>` : ""}</div>`;
    };
    const blocks = CATEGORIES.map((category) => {
      const inCat = list.filter((r) => r.it.item.category === category);
      return inCat.length === 0 ? "" : `<div class="cb"><div class="ch">${esc(categoryLabel(category, lang))}</div>${inCat.map(chip).join("")}</div>`;
    }).join("");
    const heads = sessions.map((x, i) => `${weekName(i, c)} ${mmdd(x.completed_at)}`).join(" → ");
    return `<h2>${esc(c.sTraj)} <span class="cnt">${esc(c.sTrajSub)}</span></h2><p class="muted" style="margin:2px 0 4px;font-size:8pt">${esc(heads)}</p><div class="cols">${blocks}</div>`;
  };
  const trajSection = trajHtml();

  const body =
    sessions.length === 0
      ? `<p class="muted">${esc(c.noSessions)}</p>`
      : `
    <div class="legend">${legend(c)}<span class="muted">${GRADING_CITATION}</span></div>

    <h2>${esc(c.s1)}</h2>
    ${grade3Rows.length === 0 ? `<p class="none">${esc(c.noneG3)}</p>` : columnsHtml(grade3Rows, true)}

    <h2>${esc(c.s2)}</h2>
    ${!prevLabel ? `<p class="none">${esc(c.noPrev)}</p>` : upRows.length === 0 ? `<p class="none">${esc(c.noneG3)}</p>` : chipRowsHtml(upRows)}

    <h2>${esc(c.s3)} <span class="cnt">${esc(c.s3sub)}${sessions.length > MAX_TREND_ROWS ? esc(c.s3recent(MAX_TREND_ROWS)) : ""}</span></h2>
    ${distributionChart(series, sessions, c)}

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
  @page { size: A4; margin: 9mm 12mm 10mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #111; font: 9pt/1.4 ${c.fontStack}; background: #fff; }
  .page { max-width: 184mm; margin: 0 auto; padding: 6mm 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 5px; margin-bottom: 8px; }
  header .ttl { font-size: 14.5pt; font-weight: 700; letter-spacing: -0.2px; line-height: 1.2; }
  header .who { text-align: right; font-size: 9pt; white-space: nowrap; } header .who b { font-size: 11pt; }
  h2 { font-size: 10pt; margin: 9px 0 3px; padding-bottom: 2px; border-bottom: 1px solid #999; }
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
  .spark { flex: none; }
  .tj { display: flex; align-items: center; gap: 6px; padding: 2px 0; border-bottom: 1px solid #ececec; break-inside: avoid; }
  .tj b { font-size: 9.2pt; } .dir { font-size: 7.5pt; margin-left: 4px; }
  .none { padding: 6px; border: 1px dashed #999; text-align: center; margin: 3px 0; }
  svg text { font-family: inherit; }
  ul.notes { margin: 3px 0 0; padding-left: 16px; } ul.notes li { margin: 2px 0; }
  .sample { border: 1px dashed #111; padding: 3px 7px; font-size: 8pt; margin: 4px 0 0; }
  section.notes-block { break-inside: avoid; }
  .star { margin-left: 4px; font-size: 8.5pt; }
  footer { margin-top: 12px; padding-top: 5px; border-top: 1px solid #999; font-size: 8pt; color: #333; display: flex; justify-content: space-between; gap: 12px; }
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

  ${body}

  ${
    sessions.length === 0
      ? ""
      : `<section class="notes-block">
    <h2>${trajSection ? 5 : 4}. ${esc(c.s4)}</h2>
    ${keyFindingsHtml(keyFindings(rows, sessions, last, lang, emph))}
  </section>`
  }

  <footer>
    <span>${esc(c.footerTitle)}</span>
    <span>${esc(c.footerPi)}</span>
  </footer>
</div>
${input.autoPrint ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 400); });</script>` : ""}
</body>
</html>`;
}
