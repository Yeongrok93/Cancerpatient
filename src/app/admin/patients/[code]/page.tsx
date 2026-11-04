"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  adminGetNextVisit,
  adminGetPatientDashboard,
  adminListNotes,
  adminListPatients,
  adminSetProAnswer,
  adminSetSessionDate,
  type AdminPatient,
  type DashboardAnswer,
  type DashboardSession,
  type ResearcherNote,
} from "@/lib/adminActions";
import { SURVEY_ITEMS, CATEGORIES, RESPONSE_OPTIONS, itemApplies, type Sex, type SubQuestion, type SurveyItem, type QuestionType } from "@/lib/questions";
import { computeItemGrade, GRADE_COLORS, GRADE_LABELS } from "@/lib/proctcaeGrading";
import { patientLabel } from "@/lib/patientLabel";
import { NOTE_KINDS, isTimelineKind } from "@/lib/noteKinds";
import ResearcherNotes, { sortNotes } from "./ResearcherNotes";
import QlqEditor from "./QlqEditor";
import PatientInfoEditor from "./PatientInfoEditor";

type ViewMode = "composite" | "raw" | "notes" | "qlq" | "info";

const TYPE_LABEL: Record<QuestionType, string> = {
  frequency: "빈도",
  severity: "심각도",
  interference: "일상생활 영향",
  presence: "유무",
};

// Raw 0–4 answers: gray → amber → orange → red as the answer gets worse.
const RAW_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-500",
  1: "bg-amber-100 text-amber-900",
  2: "bg-amber-300 text-amber-950",
  3: "bg-orange-500 text-white",
  4: "bg-red-600 text-white",
};

const RAW_QUESTIONS = SURVEY_ITEMS.flatMap((item) =>
  item.questions.map((q, i) => ({ item, q, first: i === 0 }))
);

/** "낙담 (아무것도 …)" → main "낙담", note "아무것도 …". */
function splitTerm(term: string): { main: string; note: string } {
  const m = term.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { main: m[1], note: m[2] } : { main: term, note: "" };
}

/** Sliding pill switch between the views. */
function ViewToggle({ view, onChange, rawCount }: { view: ViewMode; onChange: (v: ViewMode) => void; rawCount: number }) {
  const options: [ViewMode, string][] = [
    ["composite", "Composite Grade"],
    ["raw", `전체 문항 (${rawCount})`],
    ["qlq", "삶의 질 (QLQ)"],
    ["notes", "Researcher Notes"],
    ["info", "기본정보·수정"],
  ];
  const index = options.findIndex(([mode]) => mode === view);
  return (
    <div
      role="tablist"
      aria-label="보기 방식"
      className="relative inline-grid bg-gray-100 rounded-full p-1 text-sm font-medium select-none"
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-white shadow transition-transform duration-200 ease-out"
        style={{ width: `calc((100% - 8px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map(([mode, label]) => (
        <button
          key={mode}
          role="tab"
          aria-selected={view === mode}
          onClick={() => onChange(mode)}
          className={`relative z-10 px-4 py-1.5 rounded-full text-center whitespace-nowrap transition-colors duration-200 ${
            view === mode ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** The first completed 증상 설문 is the baseline; later ones count weeks from it. */
function weekName(index: number): string {
  return index === 0 ? "Baseline" : `${index}주차`;
}

/** YYYY-MM-DD in Korea time. */
function kstYmd(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

/** The same instant's time of day, on another Korea-time date. */
function withKstDate(iso: string, ymd: string): string {
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(iso));
  return new Date(`${ymd}T${time}+09:00`).toISOString();
}

/**
 * Puts each contact / intervention note under the survey it came before: the first survey whose date
 * is on or after the note date. Notes after the last survey go to `after` (they act on the next one).
 */
function bucketNotes(notes: ResearcherNote[], sessions: DashboardSession[]): { perSession: ResearcherNote[][]; after: ResearcherNote[] } {
  const dates = sessions.map((s) => kstYmd(s.completed_at));
  const perSession: ResearcherNote[][] = sessions.map(() => []);
  const after: ResearcherNote[] = [];
  for (const n of [...notes].reverse()) {
    if (!isTimelineKind(n.kind)) continue;
    const i = dates.findIndex((d) => n.note_date <= d);
    if (i === -1) after.push(n);
    else perSession[i].push(n);
  }
  return { perSession, after };
}

function TimelineCell({ items, onOpen }: { items: ResearcherNote[]; onOpen: () => void }) {
  const groups = NOTE_KINDS.map((k) => ({ k, list: items.filter((n) => n.kind === k.key) })).filter((g) => g.list.length > 0);
  return (
    <div className="flex flex-col items-center gap-1">
      {groups.map(({ k, list }) => (
        <button
          key={k.key}
          type="button"
          onClick={onOpen}
          title={list.map((n) => `${n.note_date.slice(5).replace("-", "/")} ${k.label}${n.body ? `: ${n.body}` : ""}`).join("\n")}
          className={`inline-flex items-center gap-0.5 whitespace-nowrap px-1.5 py-0.5 rounded-full border text-[11px] font-semibold hover:brightness-95 ${k.arrow} ${
            k.key === "intervention" ? "ring-1 ring-rose-400" : ""
          }`}
        >
          <span aria-hidden>↓</span>
          {k.short}
          {list.length > 1 && <span> {list.length}</span>}
        </button>
      ))}
    </div>
  );
}

/** A row under the week headers: arrows for the calls / interventions that came before each survey. */
function TimelineRow({
  lead,
  perSession,
  after,
  onOpen,
}: {
  lead: number;
  perSession: ResearcherNote[][];
  after: ResearcherNote[];
  onOpen: () => void;
}) {
  if (!perSession.some((b) => b.length > 0) && after.length === 0) return null;
  return (
    <tr className="bg-white border-t border-gray-200">
      <td colSpan={lead} className="px-4 py-2 align-top sticky left-0 bg-white z-10 text-xs font-semibold text-gray-700">
        직전 설문 이후 연락·중재
        <span className="block font-normal text-gray-500">↓ 아래 주차 결과에 영향</span>
      </td>
      {perSession.map((items, i) => (
        <td key={i} className="px-1 py-2 align-top">
          <TimelineCell items={items} onOpen={onOpen} />
        </td>
      ))}
      {after.length > 0 && (
        <td className="px-1 py-2 align-top">
          <TimelineCell items={after} onOpen={onOpen} />
        </td>
      )}
    </tr>
  );
}

function formatWeekLabel(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" });
}

function buildTooltip(item: SurveyItem, values: Record<string, number> | undefined) {
  if (!values) return "이번 주 응답 없음";
  return item.questions
    .map((q) => {
      const val = values[q.key];
      if (val === undefined) return null;
      return `${TYPE_LABEL[q.type]}: ${RESPONSE_OPTIONS[q.type][val]}`;
    })
    .filter(Boolean)
    .join(" / ");
}

export default function PatientDashboardPage() {
  const router = useRouter();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? "");

  const [name, setName] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [answers, setAnswers] = useState<DashboardAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [view, setView] = useState<ViewMode>("composite");
  const [nextVisit, setNextVisit] = useState<{ date: string; time: string; past: boolean } | null>(null);
  const [notes, setNotes] = useState<ResearcherNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  // 응답 수정 모드: 전체 문항 보기의 칸이 선택 상자로 바뀌고, 고르는 즉시 저장된다.
  const [editMode, setEditMode] = useState(false);
  const [editMsg, setEditMsg] = useState("");

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    adminGetNextVisit(code)
      .then((v) => {
        if (!cancelled) setNextVisit(v);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setNotesLoading(true);
    adminListNotes(code)
      .then((data) => {
        if (!cancelled) setNotes(sortNotes(data));
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await adminGetPatientDashboard(code).catch((err) => {
        console.error(err);
        return { name: "", sex: null, sessions: [], answers: [] };
      });
      if (cancelled) return;
      setName(data.name);
      setSex(data.sex);
      setSessions(data.sessions);
      setAnswers(data.answers);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    adminListPatients().then(setPatients).catch((err) => console.error(err));
  }, []);

  const currentIndex = patients.findIndex((p) => p.patient_code === code);
  function goTo(patientCode: string) {
    router.push(`/admin/patients/${encodeURIComponent(patientCode)}`);
  }

  // Composite view: one grade per symptom per week.
  const rows = useMemo(() => {
    const byItem = new Map<number, Map<string, Record<string, number>>>();
    for (const a of answers) {
      if (a.answer_value === null) continue;
      if (!byItem.has(a.item_id)) byItem.set(a.item_id, new Map());
      const bySession = byItem.get(a.item_id)!;
      if (!bySession.has(a.session_id)) bySession.set(a.session_id, {});
      bySession.get(a.session_id)![a.question_key] = a.answer_value;
    }

    const result: {
      item: SurveyItem;
      valuesBySession: Map<string, Record<string, number>>;
      gradesBySession: Record<string, number | null>;
      maxGrade: number;
    }[] = [];

    for (const item of SURVEY_ITEMS) {
      if (!itemApplies(item.id, sex)) continue; // 해당없음: not graded, not counted
      const bySession = byItem.get(item.id);
      if (!bySession) continue;
      const gradesBySession: Record<string, number | null> = {};
      let maxGrade = -1;
      for (const session of sessions) {
        const values = bySession.get(session.id);
        const grade = values ? computeItemGrade(item, values) : null;
        gradesBySession[session.id] = grade;
        if (grade !== null && grade > maxGrade) maxGrade = grade;
      }
      result.push({ item, valuesBySession: bySession, gradesBySession, maxGrade });
    }

    result.sort(
      (a, b) =>
        CATEGORIES.indexOf(a.item.category) - CATEGORIES.indexOf(b.item.category) ||
        b.maxGrade - a.maxGrade ||
        a.item.id - b.item.id
    );
    return result;
  }, [answers, sessions, sex]);

  // Raw view: the answer to every single question, by week.
  const rawBySessionQuestion = useMemo(() => {
    const m = new Map<string, DashboardAnswer>();
    for (const a of answers) m.set(`${a.session_id}|${a.item_id}|${a.question_key}`, a);
    return m;
  }, [answers]);

  const timeline = useMemo(() => bucketNotes(notes, sessions), [notes, sessions]);

  async function setProValue(sessionId: string, item: SurveyItem, q: SubQuestion, raw: string) {
    setEditMsg("");
    const value: number | boolean | null = raw === "" ? null : q.type === "presence" ? raw === "1" : Number(raw);
    const res = await adminSetProAnswer(sessionId, item.id, q.key, value).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    if (!res.ok) {
      setEditMsg(res.error);
      return;
    }
    setEditMsg("저장했어요.");
    setAnswers((prev) => {
      const rest = prev.filter((a) => !(a.session_id === sessionId && a.item_id === item.id && a.question_key === q.key));
      if (value === null) return rest;
      return [
        ...rest,
        {
          session_id: sessionId,
          item_id: item.id,
          question_key: q.key,
          question_type: q.type,
          answer_value: typeof value === "number" ? value : null,
          answer_boolean: typeof value === "boolean" ? value : null,
        },
      ];
    });
  }

  async function changeSessionDate(sessionId: string, ymd: string) {
    if (!ymd) return;
    setEditMsg("");
    const res = await adminSetSessionDate(sessionId, ymd).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    if (!res.ok) {
      setEditMsg(res.error);
      return;
    }
    setEditMsg("날짜를 바꿨어요.");
    setSessions((prev) =>
      prev
        .map((x) => (x.id === sessionId && x.completed_at ? { ...x, completed_at: withKstDate(x.completed_at, ymd) } : x))
        .sort((a, b) => String(a.completed_at).localeCompare(String(b.completed_at)))
    );
  }

  const latestSession = sessions[sessions.length - 1];
  const alertRows = latestSession ? rows.filter((r) => r.gradesBySession[latestSession.id] === 3) : [];
  const visibleRows = rows.filter((r) => r.maxGrade >= 1);
  const groupedRows = CATEGORIES.map((category) => ({
    category,
    rows: visibleRows.filter((r) => r.item.category === category),
  })).filter((g) => g.rows.length > 0);
  const alertGroups = CATEGORIES.map((category) => ({
    category,
    items: alertRows.filter((r) => r.item.category === category).map((r) => r.item),
  })).filter((g) => g.items.length > 0);

  function rawLabel(a: DashboardAnswer | undefined, type: QuestionType): string {
    if (!a) return "—";
    if (type === "presence") return a.answer_boolean === true ? "예" : a.answer_boolean === false ? "아니오" : "—";
    return a.answer_value === null ? "—" : String(a.answer_value);
  }

  function rawTitle(a: DashboardAnswer | undefined, type: QuestionType): string {
    if (!a) return "응답 없음";
    if (type === "presence") return rawLabel(a, type);
    return a.answer_value === null ? "응답 없음" : `${a.answer_value} - ${RESPONSE_OPTIONS[type][a.answer_value]}`;
  }

  function download(csv: string, suffix: string) {
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `pro-ctcae-${suffix}-${patientLabel(code, name).replace(/[()\s]+/g, "_")}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  }

  function exportCompositeCSV() {
    const weekHeads = sessions.map((s, i) => `${weekName(i)}(${formatWeekLabel(s.completed_at)})`);
    const header = ["카테고리", "증상(한국어)", "증상(영문)", ...weekHeads];
    const lines = rows.map(({ item, gradesBySession }) => {
      const cells = sessions.map((s) => {
        const g = gradesBySession[s.id];
        return g === null || g === undefined ? "" : String(g);
      });
      return [item.category, item.termKo, item.termEn, ...cells].map((c) => `"${c.replace(/"/g, '""')}"`).join(",");
    });
    download([header.map((c) => `"${c}"`).join(","), ...lines].join("\n"), "composite");
  }

  function exportCSV() {
    if (view === "composite") return exportCompositeCSV();
    const header = ["문항번호", "증상(한국어)", "증상(영문)", "소문항", "유형", ...sessions.map((s, i) => `${weekName(i)}(${formatWeekLabel(s.completed_at)})`)];
    const lines = RAW_QUESTIONS.map(({ item, q }) => {
      const applies = itemApplies(item.id, sex);
      const cells = sessions.map((s) => {
        if (!applies) return "해당없음";
        const a = rawBySessionQuestion.get(`${s.id}|${item.id}|${q.key}`);
        return rawTitle(a, q.type).replace(/"/g, '""');
      });
      return [item.id, item.termKo, item.termEn, q.key, TYPE_LABEL[q.type], ...cells].map((c) => `"${c}"`).join(",");
    });
    download([header.map((c) => `"${c}"`).join(","), ...lines].join("\n"), "all-questions");
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-primary-600 hover:underline font-medium">
          ← 관리자 대시보드로
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900">{patientLabel(code, name)}</h1>
            <a
              href={`/api/admin/report/${encodeURIComponent(code)}?print=1`}
              target="_blank"
              rel="noopener"
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-800"
            >
              진료용 PDF
            </a>
            {nextVisit && (
              <span
                className={`text-xs px-3 py-1.5 rounded-lg font-medium ${
                  nextVisit.past ? "bg-gray-100 text-gray-600" : "bg-amber-50 text-amber-900 border border-amber-200"
                }`}
              >
                {nextVisit.past ? "지난 외래" : "다음 외래"} {nextVisit.date.slice(5).replace("-", "/")}{" "}
                {["일", "월", "화", "수", "목", "금", "토"][new Date(`${nextVisit.date}T00:00:00Z`).getUTCDay()]} {nextVisit.time}
              </span>
            )}
          </div>

          {/* 다른 환자로 이동 */}
          {patients.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => goTo(patients[currentIndex - 1].patient_code)}
                disabled={currentIndex <= 0}
                aria-label="이전 환자"
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              <select
                value={currentIndex >= 0 ? code : ""}
                onChange={(e) => goTo(e.target.value)}
                aria-label="환자 선택"
                className="h-8 px-2 rounded-lg border border-gray-200 text-sm text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
              >
                {currentIndex < 0 && <option value="">환자 선택</option>}
                {patients.map((p) => (
                  <option key={p.patient_code} value={p.patient_code}>
                    {patientLabel(p.patient_code, p.name)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => goTo(patients[currentIndex + 1].patient_code)}
                disabled={currentIndex < 0 || currentIndex >= patients.length - 1}
                aria-label="다음 환자"
                className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {alertGroups.length > 0 && (
          <div className="bg-white border border-gray-900 rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-gray-900">
              이번 주 중증(Grade 3) 증상
              <span className="ml-2 text-sm font-bold text-gray-900">
                {alertRows.length}개
              </span>
            </p>
            <div className="space-y-2.5">
              {alertGroups.map(({ category, items }) => (
                <div key={category} className="flex items-start gap-3">
                  <span className="shrink-0 w-14 pt-1 text-[11px] font-semibold text-gray-900">{category}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {items.map((item) => {
                      const { main, note } = splitTerm(item.termKo);
                      return (
                        <span
                          key={item.id}
                          title={item.termKo}
                          className="inline-flex items-baseline gap-1 rounded-lg bg-white border border-gray-900 px-2.5 py-1 text-sm font-medium text-gray-900"
                        >
                          {main}
                          {note && <span className="text-[11px] font-normal text-gray-600">{note}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
          불러오는 중...
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <ViewToggle view={view} onChange={setView} rawCount={RAW_QUESTIONS.filter(({ item }) => itemApplies(item.id, sex)).length} />
            {(view === "composite" || view === "raw") && sessions.length > 0 && (
              <div className="flex items-center gap-2">
                {view === "raw" && (
                  <button
                    onClick={() => {
                      setEditMode((v) => !v);
                      setEditMsg("");
                    }}
                    aria-pressed={editMode}
                    className={`text-xs px-3 py-1.5 border rounded-lg font-medium ${
                      editMode ? "bg-gray-900 border-gray-900 text-white" : "border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {editMode ? "수정 모드 끄기" : "응답 수정 모드"}
                  </button>
                )}
                <button
                  onClick={exportCSV}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  CSV 내보내기
                </button>
              </div>
            )}
          </div>
          {view === "composite" && sessions.length > 0 && (
            <div className="px-5 py-2.5 border-b border-gray-100">
              <Legend />
            </div>
          )}
          {view === "raw" && sessions.length > 0 && editMode && (
            <div className="px-5 py-2.5 border-b border-gray-100 bg-amber-50 text-xs text-amber-900">
              {editMsg || "수정 모드: 칸의 값을 고르면 바로 저장돼요. 주차 아래 날짜도 바꿀 수 있어요."}
            </div>
          )}

          {view === "notes" ? (
            <ResearcherNotes code={code} notes={notes} setNotes={setNotes} loading={notesLoading} />
          ) : view === "qlq" ? (
            <QlqEditor code={code} />
          ) : view === "info" ? (
            <PatientInfoEditor code={code} />
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">완료된 PRO-CTCAE 설문이 없습니다.</div>
          ) : view === "composite" ? (
            <>
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 w-[112px] min-w-[112px]">
                        카테고리
                      </th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 sticky left-[112px] bg-gray-50 z-10 min-w-[200px]">
                        증상
                      </th>
                      {sessions.map((s, idx) => (
                        <th key={s.id} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap min-w-[72px]">
                          {weekName(idx)}
                          <br />
                          <span className="font-normal text-gray-400">{formatWeekLabel(s.completed_at)}</span>
                        </th>
                      ))}
                      {timeline.after.length > 0 && (
                        <th className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap min-w-[72px]">
                          다음 설문
                          <br />
                          <span className="font-normal text-gray-400">전</span>
                        </th>
                      )}
                    </tr>
                    <TimelineRow lead={2} perSession={timeline.perSession} after={timeline.after} onOpen={() => setView("notes")} />
                  </thead>
                  <tbody>
                    {groupedRows.map(({ category, rows: groupRows }) =>
                      groupRows.map(({ item, valuesBySession, gradesBySession }, i) => (
                        <tr key={item.id} className={`hover:bg-gray-50 border-gray-100 ${i === 0 ? "border-t-2 border-gray-200" : "border-t"}`}>
                          {i === 0 && (
                            <td
                              rowSpan={groupRows.length}
                              className="px-4 py-2 align-top text-sm font-semibold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100 whitespace-nowrap"
                            >
                              {category}
                            </td>
                          )}
                          <td className="px-4 py-2 text-gray-900 font-medium sticky left-[112px] bg-white z-10 whitespace-nowrap">
                            {item.termKo}
                          </td>
                          {sessions.map((s) => {
                            const grade = gradesBySession[s.id];
                            const values = valuesBySession.get(s.id);
                            return (
                              <td key={s.id} className="px-2 py-2 text-center">
                                <span
                                  title={buildTooltip(item, values)}
                                  className={`inline-flex w-9 h-9 items-center justify-center rounded-lg text-sm font-bold cursor-default ${
                                    grade === null ? "bg-gray-50 text-gray-300" : GRADE_COLORS[grade]
                                  }`}
                                >
                                  {grade === null ? "—" : grade}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {visibleRows.length === 0 && (
                <div className="p-8 text-center text-gray-400 text-sm">
                  모든 세션에서 유증상(Grade 1 이상) 항목이 없습니다.
                </div>
              )}
            </>
          ) : (
            <div className="overflow-x-auto">
              <table className="text-sm border-collapse">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[200px]">
                      증상 · 문항
                    </th>
                    {sessions.map((s, idx) => (
                      <th key={s.id} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap min-w-[64px]">
                        {weekName(idx)}
                        <br />
                        {editMode ? (
                          <input
                            type="date"
                            value={kstYmd(s.completed_at)}
                            onChange={(e) => changeSessionDate(s.id, e.target.value)}
                            aria-label="완료 날짜"
                            className="mt-1 h-8 px-1 border border-gray-300 rounded-md text-xs font-normal text-gray-700 bg-white"
                          />
                        ) : (
                          <span className="font-normal text-gray-400">{formatWeekLabel(s.completed_at)}</span>
                        )}
                      </th>
                    ))}
                    {timeline.after.length > 0 && (
                      <th className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap min-w-[64px]">
                        다음 설문
                        <br />
                        <span className="font-normal text-gray-400">전</span>
                      </th>
                    )}
                  </tr>
                  <TimelineRow lead={1} perSession={timeline.perSession} after={timeline.after} onOpen={() => setView("notes")} />
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {SURVEY_ITEMS.map((item) =>
                    !itemApplies(item.id, sex) ? (
                      <tr key={item.id} className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10 min-w-[220px] max-w-[300px] text-sm text-gray-400">
                          {item.id}. {item.termKo}
                        </td>
                        <td colSpan={sessions.length} className="px-3 py-2 text-xs text-gray-500">
                          해당없음 ({sex === "female" ? "여성" : "남성"}에게는 묻지 않는 문항)
                        </td>
                      </tr>
                    ) : (
                    <Fragment key={item.id}>
                      {/* 증상 항목: 한 줄을 통째로 차지 */}
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10 min-w-[220px] max-w-[300px] text-sm font-semibold text-gray-900">
                          {item.id}. {item.termKo}
                        </td>
                        {sessions.map((s) => (
                          <td key={s.id} />
                        ))}
                      </tr>
                      {/* 측정 수준(빈도·심각도·일상생활 영향…): 아래 줄, 들여쓰기 */}
                      {item.questions.map((q) => (
                        <tr key={`${item.id}-${q.key}`} className="hover:bg-gray-50">
                          <td className="pl-8 pr-3 py-1.5 sticky left-0 bg-white z-10 whitespace-nowrap text-sm text-gray-900" title={q.text}>
                            {TYPE_LABEL[q.type]}
                          </td>
                          {sessions.map((s) => {
                            const a = rawBySessionQuestion.get(`${s.id}|${item.id}|${q.key}`);
                            const isPresence = q.type === "presence";
                            const color = !a
                              ? "bg-gray-50 text-gray-300"
                              : isPresence
                                ? a.answer_boolean
                                  ? "bg-amber-200 text-amber-900"
                                  : "bg-gray-100 text-gray-500"
                                : RAW_COLORS[a.answer_value ?? 0];
                            return (
                              <td key={s.id} className="px-2 py-1.5 text-center">
                                {editMode ? (
                                  <select
                                    value={isPresence ? (a?.answer_boolean === true ? "1" : a?.answer_boolean === false ? "0" : "") : String(a?.answer_value ?? "")}
                                    onChange={(e) => setProValue(s.id, item, q, e.target.value)}
                                    aria-label={`${item.termKo} ${TYPE_LABEL[q.type]}`}
                                    title={rawTitle(a, q.type)}
                                    className="h-8 min-w-[4.5rem] px-1 border border-gray-300 rounded-md text-xs font-bold text-gray-900 bg-white"
                                  >
                                    <option value="">—</option>
                                    {isPresence ? (
                                      <>
                                        <option value="1">예</option>
                                        <option value="0">아니오</option>
                                      </>
                                    ) : (
                                      RESPONSE_OPTIONS[q.type].map((label, n) => (
                                        <option key={n} value={n}>
                                          {n} {label}
                                        </option>
                                      ))
                                    )}
                                  </select>
                                ) : (
                                  <span
                                    title={rawTitle(a, q.type)}
                                    className={`inline-flex min-w-9 h-8 px-1.5 items-center justify-center rounded-lg text-xs font-bold cursor-default ${color}`}
                                  >
                                    {rawLabel(a, q.type)}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {[0, 1, 2, 3].map((g) => (
        <span key={g} className="flex items-center gap-1">
          <span className={`w-3.5 h-3.5 rounded ${GRADE_COLORS[g]}`} />
          {g} {GRADE_LABELS[g]}
        </span>
      ))}
    </div>
  );
}
