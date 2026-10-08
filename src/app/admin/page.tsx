"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  adminListSessions,
  adminGetSessionAnswers,
  adminListParticipants,
  adminSetStudyStartDate,
  adminSetEnrolled,
  adminListRecipients,
  adminAddRecipient,
  adminSetRecipientActive,
  adminDeleteRecipient,
  type NotifyRecipient,
  adminAssignPatientCode,
  adminListMessages,
  adminUnreadMessageCount,
  adminSetMessageRead,
  type AdminSession,
  type AdminAnswer,
  type AdminParticipant,
  type AdminMessage,
} from "@/lib/adminActions";
import { SURVEY_ITEMS, RESPONSE_OPTIONS } from "@/lib/questions";

type Session = AdminSession;
type Answer = AdminAnswer;

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

type Participant = AdminParticipant;
type PatientMessage = AdminMessage;

export default function AdminPage() {
  const [tab, setTab] = useState<"surveys" | "participants" | "messages" | "recipients">("surveys");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<Answer[]>([]);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [assignCode, setAssignCode] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<PatientMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [recipients, setRecipients] = useState<NotifyRecipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [newRecName, setNewRecName] = useState("");
  const [newRecPhone, setNewRecPhone] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setSessions(await adminListSessions());
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
    load();
  }, []);

  const patientDashboards = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) {
      if (s.survey_type !== "pro_ctcae" || !s.is_complete || !s.patient_code) continue;
      counts.set(s.patient_code, (counts.get(s.patient_code) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [sessions]);

  useEffect(() => {
    if (tab !== "participants") return;
    setParticipantsLoading(true);
    adminListParticipants()
      .then((data) => {
        setParticipants(data);
        setParticipantsLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setParticipantsLoading(false);
      });
  }, [tab]);

  useEffect(() => {
    adminUnreadMessageCount()
      .then(setUnreadCount)
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (tab !== "messages") return;
    setMessagesLoading(true);
    adminListMessages()
      .then((data) => setMessages(data))
      .catch((err) => console.error(err))
      .finally(() => setMessagesLoading(false));
  }, [tab]);

  useEffect(() => {
    if (tab !== "recipients") return;
    setRecipientsLoading(true);
    adminListRecipients()
      .then(setRecipients)
      .catch((err) => console.error(err))
      .finally(() => setRecipientsLoading(false));
  }, [tab]);

  async function addRecipient() {
    const res = await adminAddRecipient(newRecName, newRecPhone).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    if (!res.ok) {
      alert(res.error);
      return;
    }
    setNewRecName("");
    setNewRecPhone("");
    setRecipients(await adminListRecipients());
  }

  async function toggleRecipient(id: string, active: boolean) {
    setRecipients((prev) => prev.map((r) => (r.id === id ? { ...r, active } : r)));
    await adminSetRecipientActive(id, active);
  }

  async function removeRecipient(id: string) {
    if (!window.confirm("이 수신자를 삭제할까요?")) return;
    setRecipients((prev) => prev.filter((r) => r.id !== id));
    await adminDeleteRecipient(id);
  }

  async function toggleEnrolled(id: string, enrolled: boolean) {
    const res = await adminSetEnrolled(id, enrolled).catch(() => ({ ok: false }));
    if (!res.ok) {
      alert("연구참여 확인 저장에 실패했습니다.");
      return;
    }
    setParticipants((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enrolled, enrolled_at: enrolled ? new Date().toISOString() : null } : p))
    );
  }

  async function toggleMessageRead(id: string, isRead: boolean) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, is_read: isRead } : m)));
    setUnreadCount((prev) => Math.max(0, prev + (isRead ? -1 : 1)));
    await adminSetMessageRead(id, isRead);
  }

  async function assignPatientCode(id: string, code: string) {
    if (!code.trim()) return;
    const res = await adminAssignPatientCode(id, code.trim()).catch(() => ({ ok: false }));
    if (!res.ok) {
      alert("참여자번호 배정에 실패했습니다.");
      return;
    }
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, patient_code: code.trim() } : p)));
    setAssigningId(null);
    setAssignCode("");
  }

  async function saveStartDate(id: string, date: string) {
    const res = await adminSetStudyStartDate(id, date).catch(() => ({ ok: false }));
    if (!res.ok) {
      alert("연구참여시작일 저장에 실패했습니다.");
      return;
    }
    setParticipants((prev) => prev.map((p) => (p.id === id ? { ...p, study_start_date: date || null } : p)));
  }

  async function copyLink(token: string, kind: "w0" | "pro" | "qlq", key: string) {
    const url = `${window.location.origin}/s/${token}/${kind}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("링크를 복사하세요", url);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  }

  async function viewAnswers(sessionId: string) {
    setSelectedId(sessionId);
    setAnswerLoading(true);
    const data = await adminGetSessionAnswers(sessionId).catch((err) => {
      console.error(err);
      return [];
    });
    setSelectedAnswers(data);
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
    if (selectedSession.additional_comments) {
      rows.push(
        `${selectedSession.patient_code ?? ""},,주관식 추가 의견,,,"${selectedSession.additional_comments.replace(/"/g, '""')}"`
      );
    }
    const csv = ["환자코드,문항번호,증상(한국어),소문항,유형,응답", ...rows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pro-ctcae-${selectedSession.patient_code ?? selectedId?.slice(0, 8)}.csv`;
    a.click();
  }

  async function handleLogout() {
    await fetch("/api/admin-logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">관리자 대시보드</h1>
        <button
          onClick={handleLogout}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
        >
          로그아웃
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["surveys", "participants", "messages", "recipients"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "surveys" ? `설문 응답 (${sessions.length})` : t === "participants" ? "참여신청" : t === "recipients" ? "알림 수신자" : "환자 문의"}
            {t === "messages" && unreadCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
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

          {patientDashboards.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
              <h2 className="font-semibold text-gray-800 mb-3">환자별 증상 대시보드</h2>
              <div className="flex flex-wrap gap-2">
                {patientDashboards.map(([code, count]) => (
                  <Link
                    key={code}
                    href={`/admin/patients/${encodeURIComponent(code)}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-primary-400 hover:bg-primary-50 text-sm font-mono text-gray-700 transition-colors"
                  >
                    {code}
                    <span className="text-xs text-gray-400 font-sans">{count}주</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

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

              {selectedSession?.additional_comments && (
                <div className="px-5 py-4 border-t border-gray-100 space-y-1.5">
                  <p className="text-xs font-medium text-gray-500 uppercase">주관식 추가 의견</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                    {selectedSession.additional_comments}
                  </p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생년월일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연구종류</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">신청일</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">문자알림</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">참여자번호</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase" title="체크해야 자동 안내 문자 대상이 됩니다">연구참여 확인</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연구참여시작</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">설문 링크 복사</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {participants.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-gray-600 text-xs">{p.record_or_birth}</td>
                      <td className="px-4 py-3 text-gray-600">{p.contact}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {p.research_types
                          ? p.research_types.split(",").map((t) => (
                              <span key={t} className="inline-flex mr-1 px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{t}</span>
                            ))
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {formatDate(p.applied_at)}
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {p.sms_notified === true ? (
                          <span className="text-green-700">발송됨</span>
                        ) : p.sms_notified === false ? (
                          <span className="text-red-600 font-medium" title={p.sms_error ?? ""}>발송 실패</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
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
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.patient_code ? (
                          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={p.enrolled}
                              onChange={(e) => toggleEnrolled(p.id, e.target.checked)}
                              className="w-4 h-4"
                            />
                            <span className={p.enrolled ? "text-green-700 font-medium" : "text-gray-400"}>
                              {p.enrolled ? "참여 중" : "미확인"}
                            </span>
                          </label>
                        ) : (
                          <span className="text-xs text-gray-400">번호 배정 후</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="date"
                          value={p.study_start_date ?? ""}
                          onChange={(e) => saveStartDate(p.id, e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-xs"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {p.patient_code && p.access_token ? (
                          <div className="flex items-center gap-1.5">
                            {([["w0", "기본정보"], ["pro", "증상"], ["qlq", "삶의질"]] as const).map(([k, label]) => (
                              <button
                                key={k}
                                onClick={() => copyLink(p.access_token!, k, `${p.id}-${k}`)}
                                className="text-xs px-2 py-1 border border-gray-300 rounded hover:bg-gray-50"
                              >
                                {copiedKey === `${p.id}-${k}` ? "복사됨 ✓" : label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">번호 배정 후 생성</span>
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

      {/* === 알림 수신자 탭 === */}
      {tab === "recipients" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">알림 수신자</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              새 참여신청이 들어오면 아래 사용 중인 번호로 문자가 발송됩니다. 이 목록이 비어 있으면 환경변수(SMS_NOTIFY_TO)를 대신 사용합니다.
            </p>
          </div>
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={newRecName}
              onChange={(e) => setNewRecName(e.target.value)}
              placeholder="이름"
              className="w-32 px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
            <input
              type="tel"
              value={newRecPhone}
              onChange={(e) => setNewRecPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addRecipient(); }}
              placeholder="휴대폰 번호"
              className="w-44 px-2 py-1.5 border border-gray-300 rounded text-sm"
            />
            <button onClick={addRecipient} className="text-sm px-3 py-1.5 bg-primary-600 text-white rounded hover:bg-primary-700">
              추가
            </button>
          </div>
          {recipientsLoading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : recipients.length === 0 ? (
            <div className="p-8 text-center text-gray-400">등록된 수신자가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recipients.map((r) => (
                <div key={r.id} className="px-5 py-3 flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={r.active} onChange={(e) => toggleRecipient(r.id, e.target.checked)} />
                    <span className={r.active ? "text-gray-900" : "text-gray-400"}>{r.name || "(이름 없음)"}</span>
                  </label>
                  <span className="font-mono text-xs text-gray-600">{r.phone}</span>
                  <span className="text-xs text-gray-400">{r.active ? "사용 중" : "중지"}</span>
                  <button onClick={() => removeRecipient(r.id)} className="ml-auto text-xs text-red-600 hover:underline">
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* === 환자 문의 탭 === */}
      {tab === "messages" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">환자 문의 수신함</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              환자가 설문 화면의 문의 버튼으로 보낸 메시지입니다.
            </p>
          </div>
          {messagesLoading ? (
            <div className="p-8 text-center text-gray-400">로딩 중...</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-gray-400">아직 문의가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {messages.map((m) => (
                <div key={m.id} className={`px-5 py-4 flex items-start gap-4 ${m.is_read ? "" : "bg-primary-50/40"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {m.patient_code}
                      </span>
                      <span className="text-xs text-gray-400">{formatDate(m.created_at)}</span>
                      {!m.is_read && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                          미확인
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-800 mt-1.5 whitespace-pre-wrap">{m.message}</p>
                  </div>
                  <button
                    onClick={() => toggleMessageRead(m.id, !m.is_read)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium whitespace-nowrap"
                  >
                    {m.is_read ? "미확인으로 표시" : "확인 완료로 표시"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
