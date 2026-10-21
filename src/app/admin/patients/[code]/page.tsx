"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { adminGetPatientDashboard, adminListPatients, type AdminPatient, type DashboardAnswer, type DashboardSession } from "@/lib/adminActions";
import { SURVEY_ITEMS, CATEGORIES, RESPONSE_OPTIONS, type SurveyItem, type QuestionType } from "@/lib/questions";
import { computeItemGrade, GRADE_COLORS, GRADE_LABELS } from "@/lib/proctcaeGrading";
import { patientLabel } from "@/lib/patientLabel";

type ViewMode = "composite" | "raw";

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

/** Sliding pill switch between the two views. */
function ViewToggle({ view, onChange, rawCount }: { view: ViewMode; onChange: (v: ViewMode) => void; rawCount: number }) {
  const options: [ViewMode, string][] = [
    ["composite", "Composite grading"],
    ["raw", `전체 문항 (${rawCount})`],
  ];
  return (
    <div role="tablist" aria-label="보기 방식" className="relative inline-grid grid-cols-2 bg-gray-100 rounded-full p-1 text-sm font-medium select-none">
      <span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white shadow transition-transform duration-200 ease-out"
        style={{ transform: `translateX(${view === "composite" ? 0 : 100}%)` }}
      />
      {options.map(([mode, label]) => (
        <button
          key={mode}
          role="tab"
          aria-selected={view === mode}
          onClick={() => onChange(mode)}
          className={`relative z-10 px-5 py-1.5 rounded-full text-center whitespace-nowrap transition-colors duration-200 ${
            view === mode ? "text-gray-900" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
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
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [answers, setAnswers] = useState<DashboardAnswer[]>([]);
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [view, setView] = useState<ViewMode>("composite");

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await adminGetPatientDashboard(code).catch((err) => {
        console.error(err);
        return { name: "", sessions: [], answers: [] };
      });
      if (cancelled) return;
      setName(data.name);
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

    result.sort((a, b) => b.maxGrade - a.maxGrade || a.item.category.localeCompare(b.item.category));
    return result;
  }, [answers, sessions]);

  // Raw view: the answer to every single question, by week.
  const rawBySessionQuestion = useMemo(() => {
    const m = new Map<string, DashboardAnswer>();
    for (const a of answers) m.set(`${a.session_id}|${a.item_id}|${a.question_key}`, a);
    return m;
  }, [answers]);

  const latestSession = sessions[sessions.length - 1];
  const alertRows = latestSession ? rows.filter((r) => r.gradesBySession[latestSession.id] === 3) : [];
  const visibleRows = rows.filter((r) => r.maxGrade >= 1);
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

  function exportCSV() {
    const header = ["문항번호", "증상(한국어)", "증상(영문)", "소문항", "유형", ...sessions.map((s, i) => `${i + 1}주차(${formatWeekLabel(s.completed_at)})`)];
    const lines = RAW_QUESTIONS.map(({ item, q }) => {
      const cells = sessions.map((s) => {
        const a = rawBySessionQuestion.get(`${s.id}|${item.id}|${q.key}`);
        return rawTitle(a, q.type).replace(/"/g, '""');
      });
      return [item.id, item.termKo, item.termEn, q.key, TYPE_LABEL[q.type], ...cells].map((c) => `"${c}"`).join(",");
    });
    const csv = [header.map((c) => `"${c}"`).join(","), ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `pro-ctcae-${patientLabel(code, name).replace(/[()\s]+/g, "_")}.csv`;
    el.click();
    URL.revokeObjectURL(url);
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
          <h1 className="text-xl font-bold text-gray-900">{patientLabel(code, name)}</h1>

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
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-gray-400">
          완료된 PRO-CTCAE 설문이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
            <ViewToggle view={view} onChange={setView} rawCount={RAW_QUESTIONS.length} />

            <div className="flex items-center gap-4 flex-wrap">
              {view === "composite" && <Legend />}
              <button
                onClick={exportCSV}
                className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
              >
                CSV 내보내기
              </button>
            </div>
          </div>

          {view === "composite" ? (
            <>
              <div className="overflow-x-auto">
                <table className="text-sm border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase sticky left-0 bg-gray-50 z-10 min-w-[180px]">
                        증상
                      </th>
                      {sessions.map((s, idx) => (
                        <th key={s.id} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap min-w-[64px]">
                          {idx + 1}주차
                          <br />
                          <span className="font-normal text-gray-400">{formatWeekLabel(s.completed_at)}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {visibleRows.map(({ item, valuesBySession, gradesBySession }) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-800 font-medium sticky left-0 bg-white z-10 whitespace-nowrap">
                          {item.termKo}
                          <span className="block text-[11px] font-normal text-gray-400">{item.category}</span>
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
                    ))}
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
                        {idx + 1}주차
                        <br />
                        <span className="font-normal text-gray-400">{formatWeekLabel(s.completed_at)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {RAW_QUESTIONS.map(({ item, q, first }) => (
                    <tr key={`${item.id}-${q.key}`} className={`hover:bg-gray-50 ${first ? "border-t-2 border-gray-200" : ""}`}>
                      <td className="px-3 py-1.5 sticky left-0 bg-white z-10 whitespace-nowrap" title={q.text}>
                        <span className="text-gray-800 font-medium">
                          {first ? `${item.id}. ${item.termKo}` : ""}
                        </span>
                        <span className={`text-[11px] text-gray-400 ${first ? "ml-2" : "ml-6"}`}>{TYPE_LABEL[q.type]}</span>
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
                            <span
                              title={rawTitle(a, q.type)}
                              className={`inline-flex min-w-9 h-8 px-1.5 items-center justify-center rounded-lg text-xs font-bold cursor-default ${color}`}
                            >
                              {rawLabel(a, q.type)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
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
