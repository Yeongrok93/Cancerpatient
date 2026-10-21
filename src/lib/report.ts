// Clinic hand-out ("진료용 요약"): the symptoms a doctor should look at first —
// Grade 3 now, or Grade higher than at the previous survey — plus a summary of the
// nursing notes. Pure functions: data in, self-contained printable HTML out
// (A4, grayscale, inline SVG), aimed at a single page.

import { SURVEY_ITEMS, CATEGORIES, RESPONSE_OPTIONS, type SurveyItem, type QuestionType } from "./questions";
import { computeItemGrade, GRADE_LABELS } from "./proctcaeGrading";
import { patientLabel } from "./patientLabel";
import type { NotesSummary } from "./notesSummary";

/** Bump when the layout or wording of the document changes. Printed in the footer. */
export const REPORT_TEMPLATE_VERSION = "2";

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
  sessions: ReportSession[]; // completed 증상 설문, oldest first
  answers: ReportAnswer[];
  notes: NotesSummary;
  /** Printed as 작성일. Defaults to now; pass a date to regenerate a document "as of" that day. */
  generatedAt?: Date;
  /** Fingerprint of the printed data (see reportData.ts), shown in the footer. */
  dataId?: string;
  /** Adds a screen-only "print" bar and opens the print dialog on load. */
  autoPrint?: boolean;
};

type ItemSeries = { item: SurveyItem; grades: (number | null)[]; values: Record<string, number>[] };

const TYPE_SHORT: Record<QuestionType, string> = {
  frequency: "빈도",
  severity: "심각도",
  interference: "영향",
  presence: "유무",
};

const MAX_TREND_ROWS = 8;

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const kstDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);

function mmdd(iso: string | null): string {
  if (!iso) return "—";
  const [, m, d] = kstDate(new Date(iso)).split("-");
  return `${m}.${d}`;
}

function weekName(i: number): string {
  return i === 0 ? "Baseline" : `${i}주차`;
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
    const values = input.sessions.map((s) => byItemSession.get(`${item.id}|${s.id}`) ?? {});
    const grades = values.map((v) => (Object.keys(v).length ? computeItemGrade(item, v) : null));
    if (grades.some((g) => g !== null)) out.push({ item, grades, values });
  }
  return out;
}

// ── visuals (inline SVG / CSS, grayscale) ────────────────────────────────

const FILL: Record<number, { bg: string; fg: string }> = {
  0: { bg: "#ffffff", fg: "#666666" },
  1: { bg: "#d9d9d9", fg: "#111111" },
  2: { bg: "#8c8c8c", fg: "#ffffff" },
  3: { bg: "#111111", fg: "#ffffff" },
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
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="등급 추이">${grid}${line}${dots}</svg>`;
}

/** One stacked bar per survey: how many symptoms sat at each grade. */
function distributionChart(series: ItemSeries[], sessions: ReportSession[]): string {
  const first = Math.max(0, sessions.length - MAX_TREND_ROWS);
  const shown = sessions.map((s, i) => ({ s, i })).slice(first);
  const rowH = 19, barH = 12, labelW = 98, barW = 400, totalW = 54;
  const rows = shown.map(({ s, i }) => {
    const counts = [0, 0, 0, 0];
    for (const it of series) {
      const g = it.grades[i];
      if (g !== null) counts[g] += 1;
    }
    return { label: `${weekName(i)} (${mmdd(s.completed_at)})`, counts, total: counts.reduce((a, b) => a + b, 0) };
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
      return `<text x="${labelW - 6}" y="${yTop + 9.5}" text-anchor="end" font-size="9.5" fill="#222">${esc(r.label)}</text>${segs}<text x="${labelW + barW + 6}" y="${yTop + 9.5}" font-size="9.5" fill="#222">${r.total}개</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${labelW + barW + totalW} ${height}" width="100%" role="img" aria-label="Grade별 증상 수">${bars}</svg>`;
}

function legend(): string {
  return [0, 1, 2, 3]
    .map((g) => `<span class="lg"><span class="gb sm" style="background:${FILL[g].bg};color:${FILL[g].fg}">${g}</span>${esc(GRADE_LABELS[g])}</span>`)
    .join("");
}

/** "빈도 자주 · 심각도 심하다 · 영향 상당히" — the current answers, shortened to fit half a page. */
function shortAnswers(it: ItemSeries, sessionIndex: number): string {
  const v = it.values[sessionIndex];
  return it.item.questions
    .map((q) => (v[q.key] === undefined ? null : `${TYPE_SHORT[q.type]} ${RESPONSE_OPTIONS[q.type][v[q.key]].replace(/\s*(있다|이다)$/, "")}`))
    .filter(Boolean)
    .join(" · ");
}

/** One answer sits beside the name; several go on their own line underneath. */
function responseHtml(text: string): string {
  if (!text) return "";
  return text.includes(" · ") ? `<div class="resp">${esc(text)}</div>` : `<span class="resp inl">${esc(text)}</span>`;
}

function notesHtml(notes: NotesSummary): string {
  if (notes.kind === "none") return `<p class="muted">작성된 간호 노트가 없습니다.</p>`;
  if (notes.kind === "unavailable") return `<p class="muted">${esc(notes.reason)}</p>`;
  const lines = notes.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = lines.map((l) => `<li>${esc(l.replace(/^[-•·*]\s*/, ""))}</li>`).join("");
  const meta =
    notes.kind === "sample"
      ? `<p class="sample">샘플 문구입니다 — 이 환자의 실제 노트가 아니며 화면 구성을 보기 위한 예시입니다.</p>`
      : `<p class="metaline">간호 노트를 AI(${esc(notes.model)})로 요약한 내용입니다${notes.source === "manual" ? " (연구자 확인·저장)" : ""} · ${esc(
          kstDate(new Date(notes.createdAt)).replace(/-/g, ".")
        )} · 원문과 다를 수 있습니다.</p>`;
  return `<ul class="notes">${items}</ul>${meta}`;
}

// ── the document ────────────────────────────────────────────────────────

export function renderReportHtml(input: ReportInput): string {
  const { sessions } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const series = buildSeries(input);
  const last = sessions.length - 1;
  const showSpark = sessions.length >= 3;

  const prevLabel = last >= 1 ? `${weekName(last - 1)} (${mmdd(sessions[last - 1].completed_at)})` : null;
  const curLabel = last >= 0 ? `${weekName(last)} (${mmdd(sessions[last].completed_at)})` : "";

  const rows = series.map((it) => {
    const cur = last >= 0 ? it.grades[last] : null;
    const prev = last >= 1 ? it.grades[last - 1] : null;
    return { it, cur, prev, grade3: cur === 3, increased: cur !== null && prev !== null && cur > prev };
  });
  type Row = (typeof rows)[number];
  const grade3Rows = rows.filter((r) => r.grade3);
  const upRows = rows.filter((r) => r.increased && !r.grade3);

  const itemHtml = (r: Row, withResponse: boolean): string => {
    const { main, note } = splitTerm(r.it.item.termKo);
    const same = r.prev !== null && r.cur === r.prev;
    return `<div class="it">
      <div class="gg">${gradeBox(r.prev)}<span class="ar${r.increased ? " up" : ""}">${r.increased ? "▲" : "→"}</span>${gradeBox(r.cur)}</div>
      <div class="tx"><b>${esc(main)}</b>${note ? `<span class="note"> ${esc(note)}</span>` : ""}${same ? `<span class="same"> 유지</span>` : ""}${
        withResponse ? responseHtml(shortAnswers(r.it, last)) : ""
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
        : `<div class="cb"><div class="ch">${esc(category)}</div>${inCat.map((r) => itemHtml(r, withResponse)).join("")}</div>`;
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
            `<span class="chip">${gradeBox(r.prev)}<span class="ar up">▲</span>${gradeBox(r.cur)}<b>${esc(splitTerm(r.it.item.termKo).main)}</b></span>`
        )
        .join("");
      return `<div class="ir"><span class="irc">${esc(category)}</span><span class="chips">${chips}</span></div>`;
    }).join("");

  const body =
    sessions.length === 0
      ? `<p class="muted">완료된 증상 설문이 없습니다.</p>`
      : `
    <section class="summary">
      <div class="stat"><b>${sessions.length}회</b> 완료한 증상 설문</div>
      <div class="stat"><b>${grade3Rows.length}개</b> 현재 Grade 3 (중증)</div>
      <div class="stat"><b>${prevLabel ? `${rows.filter((r) => r.increased).length}개` : "—"}</b> 이전 설문보다 증가</div>
    </section>
    <div class="legend">${legend()}<span class="muted">기준 ${esc(curLabel)}${prevLabel ? ` · 비교 ${esc(prevLabel)}` : " · 이전 설문 없음"} · 칸은 이전 → 현재 · PRO-CTCAE 복합 등급</span></div>

    <h2>1. 현재 Grade 3 (중증) 증상 <span class="cnt">${grade3Rows.length}개</span></h2>
    ${grade3Rows.length === 0 ? `<p class="none">해당하는 증상이 없습니다.</p>` : columnsHtml(grade3Rows, true)}

    <h2>2. 이전 설문보다 Grade가 올라간 증상 <span class="cnt">${upRows.length}개 · Grade 3 제외</span></h2>
    ${!prevLabel ? `<p class="none">이전 설문이 없어 비교할 수 없습니다.</p>` : upRows.length === 0 ? `<p class="none">해당하는 증상이 없습니다.</p>` : chipRowsHtml(upRows)}

    <h2>3. 증상 부담 추이 <span class="cnt">설문별 Grade별 증상 수${sessions.length > MAX_TREND_ROWS ? ` · 최근 ${MAX_TREND_ROWS}회` : ""}</span></h2>
    ${distributionChart(series, sessions)}`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(patientLabel(input.code, input.name))} 진료용 요약</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 9mm 12mm 10mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #111; font: 9pt/1.4 "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; background: #fff; }
  .page { max-width: 184mm; margin: 0 auto; padding: 6mm 0; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; border-bottom: 2px solid #111; padding-bottom: 5px; margin-bottom: 8px; }
  header .ttl { font-size: 14.5pt; font-weight: 700; letter-spacing: -0.2px; line-height: 1.2; }
  header .sub { font-size: 8.5pt; color: #333; margin-top: 1px; }
  header .who { text-align: right; font-size: 9pt; white-space: nowrap; } header .who b { font-size: 11pt; }
  h2 { font-size: 10pt; margin: 9px 0 3px; padding-bottom: 2px; border-bottom: 1px solid #999; }
  h2 .cnt { font-weight: 400; font-size: 8.5pt; color: #555; margin-left: 6px; }
  .muted { color: #555; } p.muted { margin: 2px 0; }
  .summary { display: flex; border: 1px solid #111; }
  .stat { flex: 1; padding: 4px 8px; text-align: center; border-right: 1px solid #111; font-size: 8.5pt; color: #333; }
  .stat:last-child { border-right: 0; } .stat b { font-size: 12pt; color: #111; margin-right: 3px; }
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
  .none { padding: 6px; border: 1px dashed #999; text-align: center; margin: 3px 0; }
  svg text { font-family: inherit; }
  ul.notes { margin: 3px 0 0; padding-left: 16px; } ul.notes li { margin: 2px 0; }
  .metaline { margin: 4px 0 0; font-size: 7.5pt; color: #666; }
  .sample { border: 1px dashed #111; padding: 3px 7px; font-size: 8pt; margin: 4px 0 0; }
  section.notes-block { break-inside: avoid; }
  footer { margin-top: 10px; padding-top: 4px; border-top: 1px solid #999; font-size: 7.5pt; color: #555; display: flex; justify-content: space-between; gap: 12px; }
  .bar { position: sticky; top: 0; background: #111; color: #fff; padding: 8px 14px; font-size: 10pt; display: flex; justify-content: space-between; align-items: center; }
  .bar button { font: inherit; padding: 4px 12px; border: 1px solid #fff; background: #fff; color: #111; cursor: pointer; }
  @media print { .bar { display: none; } .page { padding: 0; max-width: none; } }
</style>
</head>
<body>
${input.autoPrint ? `<div class="bar"><span>인쇄 창에서 대상을 “PDF로 저장”으로 선택하세요.</span><button onclick="window.print()">인쇄 / PDF 저장</button></div>` : ""}
<div class="page">
  <header>
    <div>
      <div class="ttl">진료 참고 자료 · 증상 설문 요약</div>
      <div class="sub">외래기반 항체-약물 접합체(ADC) 치료 환자 증상 부담 연구 (PRO-CTCAE)</div>
    </div>
    <div class="who"><b>${esc(patientLabel(input.code, input.name))}</b><br>작성일 ${esc(kstDate(generatedAt).replace(/-/g, "."))}</div>
  </header>

  ${body}

  <section class="notes-block">
    <h2>${sessions.length === 0 ? "1" : "4"}. 간호 노트 요약</h2>
    ${notesHtml(input.notes)}
  </section>

  <footer>
    <span>환자가 직접 응답한 설문과 연구 간호사의 기록을 정리한 자료이며, 진단이나 치료 지침이 아닙니다.</span>
    <span>자료 ID ${esc(input.dataId ?? "—")} · 양식 v${REPORT_TEMPLATE_VERSION}</span>
  </footer>
</div>
${input.autoPrint ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 400); });</script>` : ""}
</body>
</html>`;
}
