"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SURVEY_ITEMS, RESPONSE_OPTIONS, SurveyItem } from "@/lib/questions";
import { computeItemGrade, GRADE_COLORS, GRADE_LABELS } from "@/lib/proctcaeGrading";

type SessionRow = {
  id: string;
  completed_at: string | null;
  age: number | null;
  gender: string | null;
};

type AnswerRow = {
  session_id: string;
  item_id: number;
  question_key: string;
  question_type: string;
  answer_value: number | null;
};

const GENDER_LABEL: Record<string, string> = {
  male: "남성",
  female: "여성",
  other: "기타",
  prefer_not: "응답 안 함",
};

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
      const opts = RESPONSE_OPTIONS[q.type];
      const typeLabel = q.type === "frequency" ? "빈도" : q.type === "severity" ? "심각도" : q.type === "interference" ? "일상생활 영향" : "유무";
      return `${typeLabel}: ${opts[val]}`;
    })
    .filter(Boolean)
    .join(" / ");
}

export default function PatientDashboardPage() {
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code ?? "");

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: sessionData } = await supabase
        .from("survey_sessions")
        .select("id, completed_at, age, gender")
        .eq("patient_code", code)
        .eq("survey_type", "pro_ctcae")
        .eq("is_complete", true)
        .order("completed_at", { ascending: true });

      const sessionRows = sessionData ?? [];
      if (cancelled) return;
      setSessions(sessionRows);

      if (sessionRows.length > 0) {
        const { data: answerData } = await supabase
          .from("survey_answers")
          .select("session_id, item_id, question_key, question_type, answer_value")
          .in("session_id", sessionRows.map((s) => s.id));
        if (!cancelled) setAnswers(answerData ?? []);
      } else {
        setAnswers([]);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [code]);

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

  const latestSession = sessions[sessions.length - 1];
  const alertRows = latestSession
    ? rows.filter((r) => r.gradesBySession[latestSession.id] === 3)
    : [];

  const visibleRows = showAll ? rows : rows.filter((r) => r.maxGrade >= 1);
  const latest = sessions[sessions.length - 1];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-xs text-primary-600 hover:underline font-medium">
          ← 관리자 대시보드로
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900 font-mono">{code}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {latest?.age ? `${latest.age}세` : "나이 미상"}
              {latest?.gender ? ` · ${GENDER_LABEL[latest.gender] ?? latest.gender}` : ""}
              {" · "}PRO-CTCAE {sessions.length}주 완료
            </p>
          </div>
        </div>

        {alertRows.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            <strong>이번 주 Grade 3(중증) 증상:</strong>{" "}
            {alertRows.map((r) => r.item.termKo).join(", ")}
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
            <div>
              <h2 className="font-semibold text-gray-800">증상 추이 (Grade 0~3)</h2>
              <p className="text-xs text-gray-400 mt-0.5">셀에 마우스를 올리면 원본 응답을 볼 수 있습니다.</p>
            </div>
            <div className="flex items-center gap-4">
              <Legend />
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showAll}
                  onChange={(e) => setShowAll(e.target.checked)}
                  className="accent-primary-600"
                />
                전체 80개 항목 보기
              </label>
            </div>
          </div>

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
