"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SURVEY_ITEMS, RESPONSE_OPTIONS } from "@/lib/questions";

type Session = {
  id: string;
  patient_code: string | null;
  survey_type: string | null;
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

function SurveyTypeBadge({ type }: { type: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    pro_ctcae: { label: "PRO-CTCAE", cls: "bg-primary-100 text-primary-700" },
    qlq_c30:   { label: "QLQ-C30",   cls: "bg-blue-100 text-blue-700" },
    w0:        { label: "W0",         cls: "bg-emerald-100 text-emerald-700" },
  };
  const entry = type ? map[type] : null;
  return entry ? (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${entry.cls}`}>{entry.label}</span>
  ) : (
    <span className="text-gray-400 text-xs">—</span>
  );
}

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

type Participant = {
  id: string;
  name: string;
  record_or_birth: string;
  contact: string;
  consent_agreed: boolean;
  applied_at: string;
  patient_code: string | null;
};

export default function AdminPage() {
  const [tab, setTab] = useState<"surveys" | "participants">("surveys");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Answer[]>([]);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignCode, setAssignCode] = useState("");

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

  useEffect(() => {
    if (tab !== "participants") return;
    setParticipantsLoading(true);
    supabase
      .from("participants")
      .select("*")
      .order("applied_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setParticipants(data ?? []);
        setParticipantsLoading(false);
      });
  }, [tab]);

  async function assignPatientCode(id: string, code: string) {
    if (!code.trim()) return;
    await supabase.from("participants").update({ patient_code: code.trim() }).eq("id", id);
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, patient_code: code.trim() } : p)));
    setAssigningId(null);
    setAssignCode("");
  }

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
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["surveys", "participants"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "surveys" ? `설문 응답 (${sessions.length})` : "참여신청"}
          </button>
        ))}
      </div>

      {/* === 설문 응답 탭 === */}
      {tab === "surveys" && (
        <>
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설문 유형</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">나이/성별</th>
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
                        <td className="px-4 py-3">
                          <SurveyTypeBadge type={s.survey_type} />
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {s.age ? `${s.age}세` : "—"}{" "}
                          {s.gender ? `/ ${GENDER_LABEL[s.gender] ?? s.gender}` : ""}
                        </td>
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
        </>
      )}

      {/* === 참여신청 탭 === */}
      {tab === "participants" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">참여신청 목록</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              신청자에게 참여자번호를 배정하면 설문을 시작할 수 있습니다.
            </p>
          </div>
          {participantsLoading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : participants.length === 0 ? (
            <div className="p-8 text-center text-gray-400">아직 신청이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">병록번호/생년월일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">참여자번호</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {participants.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-600 text-xs">{p.record_or_birth}</td>
                      <td className="px-4 py-3 text-gray-600">{p.contact}</td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatDate(p.applied_at)}
                      </td>
                      <td className="px-4 py-3">
                        {assigningId === p.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={assignCode}
                              onChange={(e) => setAssignCode(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") assignPatientCode(p.id, assignCode);
                                if (e.key === "Escape") { setAssigningId(null); setAssignCode(""); }
                              }}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary-400"
                              placeholder="번호 입력"
                            />
                            <button
                              onClick={() => assignPatientCode(p.id, assignCode)}
                              className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                            >
                              저장
                            </button>
                            <button
                              onClick={() => { setAssigningId(null); setAssignCode(""); }}
                              className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              취소
                            </button>
                          </div>
                        ) : p.patient_code ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                              {p.patient_code}
                            </span>
                            <button
                              onClick={() => { setAssigningId(p.id); setAssignCode(p.patient_code ?? ""); }}
                              className="text-xs text-gray-400 hover:text-gray-600"
                            >
                              수정
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setAssigningId(p.id); setAssignCode(""); }}
                            className="text-xs text-primary-600 hover:underline font-medium"
                          >
                            번호 배정
                          </button>
                        )}
                      </td>
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
