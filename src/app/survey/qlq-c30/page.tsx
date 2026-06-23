"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { QLQ_QUESTIONS, FOUR_POINT_LABELS, SEVEN_POINT_LABELS } from "@/lib/qlq-c30";

type AnswerMap = Record<number, number>; // question_no → answer_value (1-indexed for both scales)

function isUnanswered(val: number | undefined) {
  return val === undefined;
}

function QlqContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorNos, setErrorNos] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!sessionId) router.replace("/");
  }, [sessionId, router]);

  const answeredCount = Object.keys(answers).length;
  const totalCount = QLQ_QUESTIONS.length;

  function handleAnswer(no: number, value: number) {
    setAnswers((prev) => ({ ...prev, [no]: value }));
    setErrorNos((prev) => {
      const next = new Set(prev);
      next.delete(no);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;

    const unanswered = QLQ_QUESTIONS.filter((q) => isUnanswered(answers[q.no]));
    if (unanswered.length > 0) {
      const ids = new Set(unanswered.map((q) => q.no));
      setErrorNos(ids);
      const firstId = unanswered[0].no;
      document.getElementById(`q-${firstId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const rows = QLQ_QUESTIONS.map((q) => ({
        session_id: sessionId,
        question_no: q.no,
        answer_value: answers[q.no],
      }));

      const { error: upsertErr } = await supabase
        .from("qlq_c30_answers")
        .upsert(rows, { onConflict: "session_id,question_no" });
      if (upsertErr) throw upsertErr;

      await supabase
        .from("survey_sessions")
        .update({ is_complete: true, completed_at: new Date().toISOString() })
        .eq("id", sessionId);

      router.push(`/survey/complete?session=${sessionId}`);
    } catch (err) {
      console.error(err);
      alert("제출 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  const unansweredCount = QLQ_QUESTIONS.filter((q) => isUnanswered(answers[q.no])).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-900">EORTC QLQ-C30</h2>
          <span className="text-sm text-gray-500">{answeredCount} / {totalCount} 완료</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(answeredCount / totalCount) * 100}%` }}
          />
        </div>
        <p className="text-xs text-gray-500">
          귀하의 건강 상태와 일상 기능에 관한 질문입니다. 해당하는 응답을 선택해 주세요.
        </p>
      </div>

      {/* Error banner */}
      {errorNos.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            <strong>{errorNos.size}개 항목</strong>에 응답하지 않으셨습니다. 빨간 테두리 항목을 확인해 주세요.
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Group 1: Physical (Q1-5) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">신체 기능 (Q1–5)</h3>
          <p className="text-xs text-gray-500">
            다음 질문들은 신체 활동에 관한 것입니다. 해당하는 응답을 선택해 주세요.
          </p>
          {QLQ_QUESTIONS.filter((q) => q.no <= 5).map((q) => (
            <QuestionRow
              key={q.no}
              q={q}
              value={answers[q.no]}
              hasError={errorNos.has(q.no)}
              onChange={(v) => handleAnswer(q.no, v)}
              labels={FOUR_POINT_LABELS}
            />
          ))}
        </div>

        {/* Group 2: Functioning + Symptoms (Q6-28) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">지난 한 주 기준 (Q6–28)</h3>
          <p className="text-xs text-gray-500">
            지난 한 주를 기준으로 응답해 주세요.
          </p>
          {QLQ_QUESTIONS.filter((q) => q.no >= 6 && q.no <= 28).map((q) => (
            <QuestionRow
              key={q.no}
              q={q}
              value={answers[q.no]}
              hasError={errorNos.has(q.no)}
              onChange={(v) => handleAnswer(q.no, v)}
              labels={FOUR_POINT_LABELS}
            />
          ))}
        </div>

        {/* Group 3: Global QoL (Q29-30) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">전반적 건강상태 및 삶의 질 (Q29–30)</h3>
          <p className="text-xs text-gray-500">
            지난 한 주를 기준으로, 1(매우 나쁨)에서 7(아주 좋음) 중 해당하는 숫자를 선택해 주세요.
          </p>
          {QLQ_QUESTIONS.filter((q) => q.no >= 29).map((q) => (
            <QuestionRow
              key={q.no}
              q={q}
              value={answers[q.no]}
              hasError={errorNos.has(q.no)}
              onChange={(v) => handleAnswer(q.no, v)}
              labels={SEVEN_POINT_LABELS}
              sevenPoint
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-3 text-white font-semibold rounded-xl transition-colors ${
            unansweredCount > 0
              ? "bg-amber-500 hover:bg-amber-600"
              : "bg-green-600 hover:bg-green-700"
          } disabled:bg-gray-200 disabled:text-gray-400`}
        >
          {submitting
            ? "제출 중..."
            : unansweredCount > 0
            ? `미응답 ${unansweredCount}개 확인 →`
            : "설문 완료 및 제출 ✓"}
        </button>
      </form>
    </div>
  );
}

function QuestionRow({
  q,
  value,
  hasError,
  onChange,
  labels,
  sevenPoint = false,
}: {
  q: { no: number; text: string };
  value: number | undefined;
  hasError: boolean;
  onChange: (v: number) => void;
  labels: string[];
  sevenPoint?: boolean;
}) {
  return (
    <div
      id={`q-${q.no}`}
      className={`rounded-xl border-2 p-4 space-y-3 transition-colors ${
        hasError ? "border-red-400 bg-red-50" : "border-transparent"
      }`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-0.5 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
          hasError ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"
        }`}>
          {q.no}
        </span>
        <p className="text-sm text-gray-800 leading-snug">{q.text}</p>
        {hasError && <span className="ml-auto text-xs text-red-500 font-medium whitespace-nowrap">응답 필요</span>}
      </div>

      {sevenPoint ? (
        <div className="flex gap-1 flex-wrap justify-between mt-2">
          {labels.map((label, idx) => {
            const v = idx + 1;
            const selected = value === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(v)}
                className={`flex-1 min-w-[36px] flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-xs transition-all ${
                  selected
                    ? "bg-blue-600 border-blue-600 text-white font-bold"
                    : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                <span className="font-semibold">{v}</span>
                {(v === 1 || v === 7) && (
                  <span className="text-[10px] leading-tight text-center whitespace-pre-line opacity-80">
                    {v === 1 ? "매우\n나쁨" : "아주\n좋음"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2 mt-2">
          {labels.map((label, idx) => {
            const v = idx + 1;
            const selected = value === v;
            return (
              <button
                key={v}
                type="button"
                onClick={() => onChange(v)}
                className={`py-2 px-1 rounded-lg border text-xs text-center transition-all ${
                  selected
                    ? "bg-blue-600 border-blue-600 text-white font-bold"
                    : "bg-white border-gray-200 text-gray-600 hover:border-blue-300"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function QlqC30Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400">설문을 불러오는 중...</div>}>
      <QlqContent />
    </Suspense>
  );
}
