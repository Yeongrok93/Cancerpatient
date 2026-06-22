"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SURVEY_ITEMS, RESPONSE_OPTIONS } from "@/lib/questions";

type Session = {
  id: string;
  patient_code: string | null;
  age: number | null;
  gender: string | null;
  cancer_type: string | null;
  treatment_type: string | null;
  started_at: string;
  completed_at: string | null;
  is_complete: boolean;
};

type Answer = {
  item_id: number;
  question_key: string;
  question_type: string;
  answer_value: number | null;
  answer_boolean: boolean | null;
};

const GENDER_LABEL: Record<string, string> = {
  male: "남성",
  female: "여성",
  other: "기타",
  prefer_not: "응답 안 함",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Answer[]>([]);
  const [answerLoading, setAnswerLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("survey_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(200);
      setSessions(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function viewAnswers(sessionId: string) {
    setSelectedId(sessionId);
    setAnswerLoading(true);
    const { data } = await supabase
      .from("survey_answers")
      .select("item_id, question_key, question_type, answer_value, answer_boolean")
      .eq("session_id", sessionId)
      .order("item_id");
    setSelectedAnswers(data ?? []);
    setAnswerLoading(false);
  }

  function getAnswerLabel(answer: Answer): string {
    if (answer.question_type === "presence") {
      return answer.answer_boolean === true ? "예" : answer.answer_boolean === false ? "아니오" : "-";
    }
    const type = answer.question_type as keyof typeof RESPONSE_OPTIONS;
    const opts = RESPONSE_OPTIONS[type];
    return answer.answer_value !== null && answer.answer_value !== undefined
      ? `${answer.answer_value} - ${opts[answer.answer_value]}`
      : "-";
  }

  const selectedSession = sessions.find((s) => s.id === selectedId);

  function exportCSV() {
    if (!selectedAnswers.length || !selectedSession) return;
    const rows = selectedAnswers.map((a) => {
      const item = SURVEY_ITEMS.find((i) => i.id === a.item_id);
      return [
        selectedSession.patient_code ?? "",
        a.item_id,
        item?.termKo ?? "",
        a.question_key,
        a.question_type,
        getAnswerLabel(a),
      ].join(",");
    });
    const csv = ["환자코드,문항번호,증상(한국어),소문항,유형,응답", ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pro-ctcae-${selectedSession.patient_code ?? selectedId?.slice(0, 8)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">관리자 대시보드</h1>
        <span className="text-sm text-gray-500">{sessions.length}개 응답</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-1">
          <p className="text-2xl font-bold text-primary-600">{sessions.length}</p>
          <p className="text-sm text-gray-500">총 설문 세션</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-1">
          <p className="text-2xl font-bold text-green-600">
            {sessions.filter((s) => s.is_complete).length}
          </p>
          <p className="text-sm text-gray-500">완료된 설문</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">응답 목록</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">아직 응답이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">환자 코드</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">나이/성별</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">암 종류</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">시작일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      selectedId === s.id ? "bg-primary-50" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{s.patient_code ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.age ? `${s.age}세` : "—"}{" "}
                      {s.gender ? `/ ${GENDER_LABEL[s.gender] ?? s.gender}` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.cancer_type ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(s.started_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          s.is_complete
                            ? "bg-green-100 text-green-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {s.is_complete ? "완료" : "진행 중"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => viewAnswers(s.id)}
                        className="text-xs text-primary-600 hover:underline font-medium"
                      >
                        응답 보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Answer detail panel */}
      {selectedId && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">응답 상세</h2>
              {selectedSession && (
                <p className="text-xs text-gray-400 mt-0.5">
                  환자: {selectedSession.patient_code ?? "익명"} ·{" "}
                  {selectedSession.completed_at
                    ? `완료: ${formatDate(selectedSession.completed_at)}`
                    : "미완료"}
                </p>
              )}
            </div>
            <button
              onClick={exportCSV}
              className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              CSV 내보내기
            </button>
          </div>

          {answerLoading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : selectedAnswers.length === 0 ? (
            <div className="p-8 text-center text-gray-400">응답 데이터가 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">증상 (한국어)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">영문</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">소문항</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">유형</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">응답</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedAnswers.map((a, idx) => {
                    const item = SURVEY_ITEMS.find((i) => i.id === a.item_id);
                    return (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-400">{a.item_id}</td>
                        <td className="px-4 py-2.5 text-gray-800">{item?.termKo ?? "—"}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{item?.termEn ?? "—"}</td>
                        <td className="px-4 py-2.5 font-mono text-gray-500">{a.question_key}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{a.question_type}</td>
                        <td className="px-4 py-2.5 font-medium text-gray-900">{getAnswerLabel(a)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
