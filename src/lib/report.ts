// Clinic hand-out ("진료용 요약"): the symptoms a doctor should look at first —
// Grade 3 now, or Grade higher than at the previous survey — plus a summary of the
// nursing notes. Pure functions: data in, self-contained printable HTML out
// (A4, grayscale, inline SVG) so it prints to PDF from any browser.

import { SURVEY_ITEMS, CATEGORIES, RESPONSE_OPTIONS, type SurveyItem, type QuestionType } from "./questions";
import { computeItemGrade, GRADE_LABELS } from "./proctcaeGrading";
import { patientLabel } from "./patientLabel";
import type { NotesSummary } from "./notesSummary";

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
  generatedAt?: Date;
  /** Adds a screen-only "print" bar and opens the print dialog on load. */
  autoPrint?: boolean;
};

type ItemSeries = { item: SurveyItem; grades: (number | null)[]; values: Record<string, number>[] };

const TYPE_LABEL: Record<QuestionType, string> = {
  frequency: "빈도",
  severity: "심각도",
  interference: "일상생활 영향",
  presence: "유무",
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function mmdd(iso: string | null): string {
  if (!iso) return "—";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso)).split("-");
  return `${parts[1]}.${parts[2]}`;
}

function ymd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d).replace(/-/g, ".");
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

// ── visuals (inline SVG, grayscale) ───────────────────────────────────

const FILL: Record<number, { bg: string; fg: string }> = {
  0: { bg: "#ffffff", fg: "#666666" },
  1: { bg: "#d9d9d9", fg: "#111111" },
  2: { bg: "#8c8c8c", fg: "#ffffff" },
  3: { bg: "#111111", fg: "#ffffff" },
};

function gradeBox(g: number | null): string {
  if (g === null) return `<span class="gb gb-na">—</span>`;
  const { bg, fg } = FILL[g];
  return `<span class="gb" style="background:${bg};color:${fg}">${g}</span>`;
}

/** Tiny line chart of one symptom's grade across all surveys. */
function sparkline(grades: (number | null)[]): string {
  const w = 96, h = 30, padX = 8, padY = 5;
  const n = grades.length;
  const x = (i: number) => (n === 1 ? w / 2 : padX + (i * (w - padX * 2)) / (n - 1));
  const y = (g: number) => h - padY - (g * (h - padY * 2)) / 3;
  const pts = grades.map((g, i) => (g === null ? null : { x: x(i), y: y(g), g, i }));
  const defined = pts.filter((p): p is NonNullable<typeof p> => p !== null);
  const grid = [0, 1, 2, 3]
    .map((g) => `<line x1="${padX - 4}" x2="${w - padX + 4}" y1="${y(g)}" y2="${y(g)}" stroke="${g === 3 ? "#bbbbbb" : "#eeeeee"}" stroke-width="0.8"/>`)
    .join("");
  const line = defined.length > 1 ? `<polyline fill="none" stroke="#333333" stroke-width="1.4" points="${defined.map((p) => `${p.x},${p.y}`).join(" ")}"/>` : "";
  const dots = defined
    .map((p, k) => {
      const last = k === defined.length - 1;
      return `<circle cx="${p.x}" cy="${p.y}" r="${last ? 3.4 : 2.4}" fill="${last ? "#111111" : "#ffffff"}" stroke="#111111" stroke-width="1.2"/>`;
    })
    .join("");
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="등급 추이">${grid}${line}${dots}</svg>`;
}

/** One stacked bar per survey: how many symptoms were at each grade. */
function distributionChart(series: ItemSeries[], sessions: ReportSession[]): string {
  const rowH = 26, labelW = 92, barW = 380, totalW = 60;
  const rows = sessions.map((s, i) => {
    const counts = [0, 0, 0, 0];
    for (const it of series) {
      const g = it.grades[i];
      if (g !== null) counts[g] += 1;
    }
    return { label: `${weekName(i)} (${mmdd(s.completed_at)})`, counts, total: counts.reduce((a, b) => a + b, 0) };
  });
  const maxTotal = Math.max(1, ...rows.map((r) => r.total));
  const height = rows.length * rowH + 4;
  const bars = rows
    .map((r, i) => {
      const yTop = i * rowH + 4;
      let xCur = labelW;
      const segs = r.counts
        .map((c, g) => {
          if (c === 0) return "";
          const wSeg = (c / maxTotal) * barW;
          const rect = `<rect x="${xCur}" y="${yTop}" width="${wSeg}" height="16" fill="${FILL[g].bg}" stroke="#111111" stroke-width="0.8"/>`;
          const txt = wSeg > 16 ? `<text x="${xCur + wSeg / 2}" y="${yTop + 12}" text-anchor="middle" font-size="10" fill="${FILL[g].fg}">${c}</text>` : "";
          xCur += wSeg;
          return rect + txt;
        })
        .join("");
      return `<text x="${labelW - 8}" y="${yTop + 12}" text-anchor="end" font-size="10.5" fill="#222222">${esc(r.label)}</text>${segs}<text x="${labelW + barW + 8}" y="${yTop + 12}" font-size="10.5" fill="#222222">${r.total}개 응답</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${labelW + barW + totalW + 20} ${height}" width="100%" role="img" aria-label="Grade별 증상 수">${bars}</svg>`;
}

function legend(): string {
  return [0, 1, 2, 3]
    .map((g) => `<span class="lg"><span class="gb sm" style="background:${FILL[g].bg};color:${FILL[g].fg}">${g}</span>${esc(GRADE_LABELS[g])}</span>`)
    .join("");
}

function answerText(it: ItemSeries, sessionIndex: number): string {
  const v = it.values[sessionIndex];
  return it.item.questions
    .map((q) => (v[q.key] === undefined ? null : `${TYPE_LABEL[q.type]}: ${RESPONSE_OPTIONS[q.type][v[q.key]]}`))
    .filter(Boolean)
    .join(" · ");
}

function notesHtml(notes: NotesSummary): string {
  if (notes.kind === "none") return `<p class="muted">작성된 간호 노트가 없습니다.</p>`;
  if (notes.kind === "unavailable") return `<p class="muted">${esc(notes.reason)}</p>`;
  const lines = notes.text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items = lines.map((l) => `<li>${esc(l.replace(/^[-•·*]\s*/, ""))}</li>`).join("");
  const badge =
    notes.kind === "sample"
      ? `<p class="sample">샘플 문구입니다 — 이 환자의 실제 노트가 아니며 화면 구성을 보기 위한 예시입니다.</p>`
      : `<p class="muted small">간호 노트를 AI가 요약한 내용입니다. 원문과 다를 수 있으니 필요 시 원본 노트를 확인하세요.</p>`;
  return `${badge}<ul class="notes">${items}</ul>`;
}

// ── the document ────────────────────────────────────────────────────────

export function renderReportHtml(input: ReportInput): string {
  const { sessions } = input;
  const generatedAt = input.generatedAt ?? new Date();
  const series = buildSeries(input);
  const last = sessions.length - 1;

  const flagged = series
    .map((it) => {
      const cur = last >= 0 ? it.grades[last] : null;
      const prev = last >= 1 ? it.grades[last - 1] : null;
      const grade3 = cur === 3;
      const increased = cur !== null && prev !== null && cur > prev;
      return { it, cur, prev, grade3, increased };
    })
    .filter((r) => r.grade3 || r.increased)
    .sort(
      (a, b) =>
        (b.cur ?? 0) - (a.cur ?? 0) ||
        (b.cur ?? 0) - (b.prev ?? 0) - ((a.cur ?? 0) - (a.prev ?? 0)) ||
        CATEGORIES.indexOf(a.it.item.category) - CATEGORIES.indexOf(b.it.item.category) ||
        a.it.item.id - b.it.item.id
    );

  const grade3Count = flagged.filter((r) => r.grade3).length;
  const increasedCount = flagged.filter((r) => r.increased).length;
  const prevLabel = last >= 1 ? `${weekName(last - 1)} (${mmdd(sessions[last - 1].completed_at)})` : null;
  const curLabel = last >= 0 ? `${weekName(last)} (${mmdd(sessions[last].completed_at)})` : "";

  type Flagged = (typeof flagged)[number];

  /** One table; same-category rows share a merged first cell. */
  const renderTable = (list: Flagged[], withResponse: boolean): string => {
    const groups = CATEGORIES.map((category) => ({
      category,
      rows: list
        .filter((r) => r.it.item.category === category)
        .sort((x, y) => (y.cur ?? 0) - (y.prev ?? 0) - ((x.cur ?? 0) - (x.prev ?? 0)) || x.it.item.id - y.it.item.id),
    })).filter((g) => g.rows.length > 0);

    const rowsHtml = groups
      .map(({ category, rows }) =>
        rows
          .map((r, i) => {
            const { main, note } = splitTerm(r.it.item.termKo);
            const change =
              r.prev === null
                ? `<span class="muted">비교 없음</span>`
                : r.cur! > r.prev
                  ? `<b>▲ 증가</b> <span class="muted">(${r.prev}→${r.cur})</span>`
                  : r.cur! < r.prev
                    ? `▼ 감소 <span class="muted">(${r.prev}→${r.cur})</span>`
                    : `<span class="muted">유지</span>`;
            return `<tr>
            ${i === 0 ? `<td class="cat" rowspan="${rows.length}">${esc(category)}</td>` : ""}
            <td class="sym"><b>${esc(main)}</b>${note ? `<span class="note">${esc(note)}</span>` : ""}${withResponse ? `<span class="resp">${esc(answerText(r.it, last))}</span>` : ""}</td>
            <td class="c">${r.prev === null ? `<span class="gb gb-na">—</span>` : gradeBox(r.prev)}</td>
            <td class="c">${gradeBox(r.cur)}</td>
            <td class="chg">${change}</td>
            <td class="c">${sparkline(r.it.grades)}</td>
          </tr>`;
          })
          .join("")
      )
      .join("");

    return `<table class="grid">
      <colgroup><col style="width:17mm"><col><col style="width:22mm"><col style="width:16mm"><col style="width:27mm"><col style="width:27mm"></colgroup>
      <thead><tr><th>분류</th><th>증상${withResponse ? " · 현재 응답" : ""}</th><th class="c">${esc(prevLabel ?? "이전").replace(" (", "<br>(")}</th><th class="c">현재</th><th>변화</th><th class="c">등급 추이</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
  };

  const grade3Rows = flagged.filter((r) => r.grade3);
  const upRows = flagged.filter((r) => r.increased && !r.grade3);

  const body =
    sessions.length === 0
      ? `<p class="muted">완료된 증상 설문이 없습니다.</p>`
      : `
    <section class="summary">
      <div class="stat"><div class="n">${sessions.length}</div><div class="l">완료한 증상 설문</div></div>
      <div class="stat"><div class="n">${grade3Count}</div><div class="l">현재 Grade 3 (중증)</div></div>
      <div class="stat"><div class="n">${prevLabel ? increasedCount : "—"}</div><div class="l">이전 설문보다 증가</div></div>
    </section>
    <p class="muted small" style="margin-top:6px">기준 설문: ${esc(curLabel)}${prevLabel ? ` · 비교 설문: ${esc(prevLabel)}` : " · 이전 설문이 없어 증가 여부는 비교하지 않았습니다."}</p>

    <h2>1. 현재 Grade 3 (중증) 증상 <span class="cnt">${grade3Rows.length}개</span></h2>
    ${grade3Rows.length === 0 ? `<p class="none">해당하는 증상이 없습니다.</p>` : renderTable(grade3Rows, true)}

    <h2>2. 이전 설문보다 Grade가 올라간 증상 <span class="cnt">${upRows.length}개</span></h2>
    <p class="muted small">Grade 3이 아닌 항목만 모았습니다 (Grade 3 항목은 위 1번에 포함).</p>
    ${!prevLabel ? `<p class="none">이전 설문이 없어 비교할 수 없습니다.</p>` : upRows.length === 0 ? `<p class="none">해당하는 증상이 없습니다.</p>` : renderTable(upRows, false)}
    <div class="legend">${legend()}<span class="muted small">Grade는 PRO-CTCAE 복합 등급(빈도·심각도·일상생활 영향 조합) 기준입니다.</span></div>

    <h2>3. 전체 증상 부담 추이</h2>
    <p class="muted small">설문마다 Grade별로 해당한 증상의 개수입니다.</p>
    ${distributionChart(series, sessions)}
    <div class="legend">${legend()}</div>`;

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${esc(patientLabel(input.code, input.name))} 진료용 요약</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; color: #111; font: 10.5pt/1.5 "Noto Sans KR", "Malgun Gothic", "Apple SD Gothic Neo", sans-serif; background: #fff; }
  .page { max-width: 180mm; margin: 0 auto; padding: 8mm 0; }
  header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  header .ttl { font-size: 17pt; font-weight: 700; letter-spacing: -0.2px; }
  header .meta { display: flex; justify-content: space-between; gap: 12px; margin-top: 4px; font-size: 10pt; }
  h2 .cnt { font-weight: 400; font-size: 10pt; color: #555; margin-left: 6px; }
  h2 { font-size: 12pt; margin: 20px 0 4px; padding-bottom: 3px; border-bottom: 1px solid #999; }
  .muted { color: #555; } .small { font-size: 9pt; margin: 2px 0 8px; }
  .summary { display: flex; border: 1px solid #111; }
  .stat { flex: 1; padding: 8px 10px; text-align: center; border-right: 1px solid #111; }
  .stat:last-child { border-right: 0; }
  .stat .n { font-size: 20pt; font-weight: 700; line-height: 1.1; } .stat .l { font-size: 9pt; color: #333; }
  table.grid { width: 100%; border-collapse: collapse; margin-top: 4px; table-layout: fixed; }
  .grid th { background: #f0f0f0; font-size: 9pt; text-align: left; padding: 5px 6px; border: 1px solid #999; }
  .grid td { padding: 5px 6px; border: 1px solid #bbb; vertical-align: middle; }
  .grid tr { page-break-inside: avoid; break-inside: avoid; }
  .c { text-align: center; } .cat { font-weight: 700; width: 17mm; background: #fafafa; vertical-align: top; }
  .sym b { font-size: 10.5pt; } .sym .note { display: block; font-size: 8.5pt; color: #555; }
  .sym .resp { display: block; font-size: 8.5pt; color: #333; margin-top: 1px; }
  .chg { font-size: 9.5pt; white-space: nowrap; }
  .gb { display: inline-block; min-width: 22px; height: 22px; line-height: 20px; text-align: center; border: 1px solid #111; font-weight: 700; font-size: 10pt; }
  .gb.sm { min-width: 16px; height: 16px; line-height: 14px; font-size: 8.5pt; margin-right: 4px; }
  .gb-na { border-color: #bbb; color: #999; font-weight: 400; }
  .legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 8px 0 0; font-size: 9pt; }
  .lg { display: inline-flex; align-items: center; }
  .none { padding: 10px; border: 1px dashed #999; text-align: center; }
  .spark { display: block; margin: 0 auto; }
  svg text { font-family: inherit; }
  ul.notes { margin: 4px 0 0; padding-left: 18px; } ul.notes li { margin: 3px 0; }
  .sample { border: 1px dashed #111; padding: 4px 8px; font-size: 9pt; margin: 4px 0 6px; }
  footer { margin-top: 22px; padding-top: 6px; border-top: 1px solid #999; font-size: 8.5pt; color: #555; display: flex; justify-content: space-between; gap: 12px; }
  section.notes-block { page-break-inside: avoid; break-inside: avoid; }
  .bar { position: sticky; top: 0; background: #111; color: #fff; padding: 8px 14px; font-size: 10pt; display: flex; justify-content: space-between; align-items: center; }
  .bar button { font: inherit; padding: 4px 12px; border: 1px solid #fff; background: #fff; color: #111; cursor: pointer; }
  @media print { .bar { display: none; } .page { padding: 0; max-width: none; } }
</style>
</head>
<body>
${input.autoPrint ? `<div class="bar"><span>인쇄 창에서 대상을 “PDF로 저장”으로 선택하세요.</span><button onclick="window.print()">인쇄 / PDF 저장</button></div>` : ""}
<div class="page">
  <header>
    <div class="ttl">진료 참고 자료 · 증상 설문 요약</div>
    <div class="meta">
      <span><b>${esc(patientLabel(input.code, input.name))}</b> · 외래기반 ADC 치료 환자 증상 부담 연구(PRO-CTCAE)</span>
      <span>작성일 ${esc(ymd(generatedAt))}</span>
    </div>
  </header>

  ${body}

  <section class="notes-block">
    <h2>${sessions.length === 0 ? "1" : "4"}. 간호 노트 요약</h2>
    ${notesHtml(input.notes)}
  </section>

  <footer>
    <span>이 자료는 환자가 직접 응답한 설문과 연구 간호사의 기록을 정리한 것으로, 진단이나 치료 지침이 아닙니다.</span>
  </footer>
</div>
${input.autoPrint ? `<script>window.addEventListener("load", function () { setTimeout(function () { window.print(); }, 400); });</script>` : ""}
</body>
</html>`;
}
