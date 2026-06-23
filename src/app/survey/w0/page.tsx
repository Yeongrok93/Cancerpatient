"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { DEMOGRAPHICS, IPAQ_ITEMS, SITTING_KEYS, SITTING_LABEL } from "@/lib/w0";

type AnswerMap = Record<string, number | string>;

function isUnanswered(val: number | string | undefined) {
  return val === undefined || val === "";
}

function W0Content() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorKeys, setErrorKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sessionId) router.replace("/");
  }, [sessionId, router]);

  function setAnswer(key: string, val: number | string) {
    setAnswers((prev) => ({ ...prev, [key]: val }));
    setErrorKeys((prev) => { const next = new Set(prev); next.delete(key); return next; });
  }

  function getRequiredKeys(): string[] {
    const keys: string[] = [];
    // Demographics — all required
    DEMOGRAPHICS.forEach((q) => keys.push(q.key));
    // IPAQ — days always required; duration required only if days > 0
    IPAQ_ITEMS.forEach((item) => {
      keys.push(item.daysKey);
      const days = Number(answers[item.daysKey]);
      if (days > 0) {
        keys.push(item.hoursKey, item.minutesKey);
      }
    });
    // Sitting always required
    keys.push(SITTING_KEYS.hours, SITTING_KEYS.minutes);
    return keys;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId) return;

    const required = getRequiredKeys();
    const missing = required.filter((k) => isUnanswered(answers[k]));
    if (missing.length > 0) {
      const s = new Set(missing);
      setErrorKeys(s);
      document.getElementById(`field-${missing[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    try {
      const rows = Object.entries(answers).map(([key, val]) => {
        const numeric = typeof val === "number" || (typeof val === "string" && !isNaN(Number(val)));
        return {
          session_id: sessionId,
          question_key: key,
          answer_choice: typeof val === "number" ? val : null,
          answer_number: numeric && typeof val === "string" ? Number(val) : null,
          answer_text: typeof val === "string" ? val : null,
        };
      });

      // Simplify: store everything as answer_number when parseable, else answer_text
      const cleanRows = Object.entries(answers).map(([key, val]) => {
        const n = Number(val);
        return {
          session_id: sessionId,
          question_key: key,
          answer_choice: null as number | null,
          answer_number: !isNaN(n) ? n : null,
          answer_text: isNaN(n) ? String(val) : null,
        };
      });
      void rows; // unused

      const { error: upsertErr } = await supabase
        .from("w0_answers")
        .upsert(cleanRows, { onConflict: "session_id,question_key" });
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

  const required = getRequiredKeys();
  const unansweredCount = required.filter((k) => isUnanswered(answers[k])).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-2">
        <h2 className="font-bold text-gray-900">W0 통합설문지</h2>
        <p className="text-xs text-gray-500">기본정보 및 신체활동(IPAQ)에 관한 설문입니다.</p>
      </div>

      {/* Error banner */}
      {errorKeys.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span><strong>{errorKeys.size}개 항목</strong>에 응답하지 않으셨습니다.</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Part I — Demographics */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Part I. 기본 정보</h3>
          {DEMOGRAPHICS.map((q, idx) => (
            <div
              key={q.key}
              id={`field-${q.key}`}
              className={`space-y-2 rounded-xl border-2 p-3 transition-colors ${
                errorKeys.has(q.key) ? "border-red-400 bg-red-50" : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                  errorKeys.has(q.key) ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-700"
                }`}>{idx + 1}</span>
                <p className="text-sm font-medium text-gray-800">{q.label}</p>
                {errorKeys.has(q.key) && <span className="ml-auto text-xs text-red-500 font-medium">응답 필요</span>}
              </div>

              {q.type === "number" && (
                <div className="flex items-center gap-2 pl-8">
                  <input
                    type="number"
                    min={q.min}
                    max={q.max}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswer(q.key, e.target.value)}
                    className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="숫자 입력"
                  />
                  {q.unit && <span className="text-sm text-gray-500">{q.unit}</span>}
                </div>
              )}

              {q.type === "radio" && (
                <div className="flex flex-wrap gap-2 pl-8">
                  {q.options.map((opt) => {
                    const selected = answers[q.key] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAnswer(q.key, opt.value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                          selected
                            ? "bg-emerald-600 border-emerald-600 text-white font-semibold"
                            : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Part II — IPAQ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">Part II. 신체활동 (IPAQ)</h3>
          <p className="text-xs text-gray-500">
            지난 7일 동안의 신체활동을 평가합니다. 적어도 10분 이상 지속한 활동만 포함하세요.
          </p>

          {IPAQ_ITEMS.map((item, itemIdx) => {
            const days = Number(answers[item.daysKey]);
            const showDuration = days > 0;
            return (
              <div key={item.id} className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-start gap-2">
                  <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-700 mt-0.5">
                    {DEMOGRAPHICS.length + itemIdx * 2 + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.activityLabel}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                </div>

                {/* Days question */}
                <div
                  id={`field-${item.daysKey}`}
                  className={`pl-8 space-y-2 rounded-lg border-2 p-3 transition-colors ${
                    errorKeys.has(item.daysKey) ? "border-red-400 bg-red-50" : "border-transparent"
                  }`}
                >
                  <p className="text-sm text-gray-700">{item.daysLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }, (_, i) => i).map((d) => {
                      const selected = answers[item.daysKey] === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setAnswer(item.daysKey, d)}
                          className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-all ${
                            selected
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "bg-white border-gray-200 text-gray-600 hover:border-emerald-300"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  {errorKeys.has(item.daysKey) && <p className="text-xs text-red-500">응답 필요</p>}
                </div>

                {/* Duration (only if days > 0) */}
                {showDuration && (
                  <div
                    id={`field-${item.hoursKey}`}
                    className={`pl-8 space-y-2 rounded-lg border-2 p-3 transition-colors ${
                      errorKeys.has(item.hoursKey) || errorKeys.has(item.minutesKey)
                        ? "border-red-400 bg-red-50"
                        : "border-transparent"
                    }`}
                  >
                    <p className="text-sm text-gray-700">{item.durationLabel}</p>
                    <DurationInput
                      hoursKey={item.hoursKey}
                      minutesKey={item.minutesKey}
                      answers={answers}
                      setAnswer={setAnswer}
                    />
                    {(errorKeys.has(item.hoursKey) || errorKeys.has(item.minutesKey)) && (
                      <p className="text-xs text-red-500">시간 또는 분을 입력해 주세요</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Sitting time */}
          <div className="border-t pt-4 space-y-3">
            <div
              id={`field-${SITTING_KEYS.hours}`}
              className={`space-y-2 rounded-lg border-2 p-3 transition-colors ${
                errorKeys.has(SITTING_KEYS.hours) || errorKeys.has(SITTING_KEYS.minutes)
                  ? "border-red-400 bg-red-50"
                  : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-700">
                  {DEMOGRAPHICS.length + IPAQ_ITEMS.length * 2 + 1}
                </span>
                <p className="text-sm text-gray-700">{SITTING_LABEL}</p>
              </div>
              <div className="pl-8">
                <DurationInput
                  hoursKey={SITTING_KEYS.hours}
                  minutesKey={SITTING_KEYS.minutes}
                  answers={answers}
                  setAnswer={setAnswer}
                />
              </div>
              {(errorKeys.has(SITTING_KEYS.hours) || errorKeys.has(SITTING_KEYS.minutes)) && (
                <p className="text-xs text-red-500 pl-8">시간 또는 분을 입력해 주세요</p>
              )}
            </div>
          </div>
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

function DurationInput({
  hoursKey,
  minutesKey,
  answers,
  setAnswer,
}: {
  hoursKey: string;
  minutesKey: string;
  answers: AnswerMap;
  setAnswer: (key: string, val: number | string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={24}
          value={answers[hoursKey] ?? ""}
          onChange={(e) => setAnswer(hoursKey, e.target.value)}
          className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="0"
        />
        <span className="text-sm text-gray-500">시간</span>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={59}
          value={answers[minutesKey] ?? ""}
          onChange={(e) => setAnswer(minutesKey, e.target.value)}
          className="w-16 px-2 py-2 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="0"
        />
        <span className="text-sm text-gray-500">분</span>
      </div>
    </div>
  );
}

export default function W0Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400">설문을 불러오는 중...</div>}>
      <W0Content />
    </Suspense>
  );
}
