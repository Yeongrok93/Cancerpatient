"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { submitW0 } from "@/lib/actions";
import {
  DEMOGRAPHICS,
  ECOG_KEY,
  ECOG_LABEL,
  ECOG_OPTIONS,
  IPAQ_ITEMS,
  SITTING_KEYS,
  SITTING_LABEL,
  EMERGENCY_SCREENING,
} from "@/lib/w0";

type AnswerMap = Record<string, number | string>;

function isUnanswered(val: number | string | undefined) {
  return val === undefined || val === "";
}

function parseMulti(val: number | string | undefined): number[] {
  if (val === undefined || val === "") return [];
  return String(val).split(",").map(Number).filter((n) => !isNaN(n));
}

/** A duration is answered when hours or minutes is filled; the blank one counts as 0. */
function durationAnswered(answers: AnswerMap, hoursKey: string, minutesKey: string) {
  return !isUnanswered(answers[hoursKey]) || !isUnanswered(answers[minutesKey]);
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

  function toggleMulti(q: { key: string; exclusiveValue?: number }, value: number) {
    const cur = parseMulti(answers[q.key]);
    let next: number[];
    if (cur.includes(value)) {
      next = cur.filter((v) => v !== value);
    } else if (value === q.exclusiveValue) {
      next = [value];
    } else {
      next = [...cur.filter((v) => v !== q.exclusiveValue), value];
    }
    next.sort((a, b) => a - b);
    setAnswer(q.key, next.join(","));
  }

  function getRequiredKeys(): string[] {
    const keys: string[] = [];
    // Demographics — all required
    DEMOGRAPHICS.forEach((q) => keys.push(q.key));
    // ECOG — required
    keys.push(ECOG_KEY);
    // IPAQ — days always required; duration required only if days > 0
    IPAQ_ITEMS.forEach((item) => {
      keys.push(item.daysKey);
      const days = Number(answers[item.daysKey]);
      if (days > 0 && !durationAnswered(answers, item.hoursKey, item.minutesKey)) {
        keys.push(item.hoursKey);
      }
    });
    // Sitting always required (hours or minutes; the blank one counts as 0)
    if (!durationAnswered(answers, SITTING_KEYS.hours, SITTING_KEYS.minutes)) {
      keys.push(SITTING_KEYS.hours);
    }
    // Emergency screening — all required
    EMERGENCY_SCREENING.forEach((q) => keys.push(q.key));
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
      // Store everything as answer_number when parseable, else answer_text
      const filled: AnswerMap = { ...answers };
      // A blank hours/minutes box next to a filled one means 0.
      const durationPairs: [string, string][] = [
        ...IPAQ_ITEMS.filter((i) => Number(answers[i.daysKey]) > 0).map((i) => [i.hoursKey, i.minutesKey] as [string, string]),
        [SITTING_KEYS.hours, SITTING_KEYS.minutes],
      ];
      for (const [h, m] of durationPairs) {
        if (isUnanswered(filled[h])) filled[h] = 0;
        if (isUnanswered(filled[m])) filled[m] = 0;
      }
      const multiKeys = new Set(DEMOGRAPHICS.filter((q) => q.type === "multi").map((q) => q.key));
      const cleanRows = Object.entries(filled).map(([key, val]) => {
        if (multiKeys.has(key)) return { question_key: key, answer_number: null, answer_text: String(val) };
        const n = Number(val);
        return {
          question_key: key,
          answer_number: !isNaN(n) ? n : null,
          answer_text: isNaN(n) ? String(val) : null,
        };
      });

      const result = await submitW0(sessionId, cleanRows);
      if (!result.ok) throw new Error(result.error);

      router.push(`/survey/complete?session=${sessionId}`);
    } catch (err) {
      console.error(err);
      alert("제출 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  const required = getRequiredKeys();
  const unansweredCount = required.filter((k) => isUnanswered(answers[k])).length;

  // Question numbering: I. Demographics -> II. ECOG -> III. IPAQ -> IV. Emergency screening
  const ecogNumber = DEMOGRAPHICS.length + 1;
  const ipaqBaseNumber = ecogNumber;
  const sittingNumber = ipaqBaseNumber + IPAQ_ITEMS.length * 2 + 1;
  const emergencyBaseNumber = sittingNumber + 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card space-y-2">
        <h2 className="text-xl font-bold text-gray-900">기본정보 설문</h2>
        <p className="text-base text-gray-700">기본정보 및 신체활동(IPAQ)에 관한 설문입니다.</p>
      </div>

      {/* Error banner */}
      {errorKeys.size > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 text-base text-amber-900">
          ⚠ 답하지 않은 문항이 <strong>{errorKeys.size}개</strong> 있어요.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Part I — Demographics */}
        <div className="card space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Part I. 기본 정보</h3>
          {DEMOGRAPHICS.map((q, idx) => (
            <div
              key={q.key}
              id={`field-${q.key}`}
              className={`space-y-2 rounded-xl border-2 p-3 transition-colors ${
                errorKeys.has(q.key) ? "border-red-500" : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-full text-base font-bold flex items-center justify-center flex-shrink-0 ${
                  errorKeys.has(q.key) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                }`}>{idx + 1}</span>
                <p className="text-lg font-medium text-gray-900">{q.label}</p>
              </div>
              {errorKeys.has(q.key) && <p className="text-base font-semibold text-red-700 pl-11">⚠ 이 문항에 답해 주세요</p>}

              {q.type === "number" && (
                <div className="flex items-center gap-2 pl-11">
                  <input
                    type="number"
                    min={q.min}
                    max={q.max}
                    value={answers[q.key] ?? ""}
                    onChange={(e) => setAnswer(q.key, e.target.value)}
                    className="w-28 min-h-[56px] px-3 py-2 border-2 border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    placeholder="숫자 입력"
                  />
                  {q.unit && <span className="text-lg text-gray-700">{q.unit}</span>}
                </div>
              )}

              {q.type === "multi" && (
                <div className="space-y-2 pl-11">
                  {q.hint && <p className="text-base text-gray-600">{q.hint} (중복 선택 가능)</p>}
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => {
                      const selected = parseMulti(answers[q.key]).includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="checkbox"
                          aria-checked={selected}
                          onClick={() => toggleMulti(q, opt.value)}
                          className={`min-h-[56px] px-4 py-2 rounded-lg border-2 text-lg transition-all ${
                            selected
                              ? "bg-emerald-600 border-emerald-700 text-white font-bold"
                              : "bg-white border-gray-300 text-gray-800 hover:border-emerald-400"
                          }`}
                        >
                          <span aria-hidden>{selected ? "☑ " : "☐ "}</span>
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {q.type === "radio" && (
                <div className="flex flex-wrap gap-2 pl-11">
                  {q.options.map((opt) => {
                    const selected = answers[q.key] === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAnswer(q.key, opt.value)}
                        className={`min-h-[56px] px-4 py-2 rounded-lg border-2 text-lg transition-all ${
                          selected
                            ? "bg-emerald-600 border-emerald-700 text-white font-bold"
                            : "bg-white border-gray-300 text-gray-800 hover:border-emerald-400"
                        }`}
                      >
                        {selected && <span aria-hidden>✓ </span>}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Part II — Patient-Reported ECOG */}
        <div
          id={`field-${ECOG_KEY}`}
          className={`bg-white rounded-2xl shadow-sm border-2 p-5 space-y-4 transition-colors ${
            errorKeys.has(ECOG_KEY) ? "border-red-500" : "border-transparent"
          }`}
        >
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Part II. 환자 보고형 ECOG</h3>
          <div className="flex items-start gap-3">
            <span className="w-8 h-8 rounded-full text-base font-bold flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-800 mt-0.5">
              {ecogNumber}
            </span>
            <p className="text-lg text-gray-900">{ECOG_LABEL}</p>
          </div>
          {errorKeys.has(ECOG_KEY) && <p className="text-base font-semibold text-red-700 pl-11">⚠ 이 문항에 답해 주세요</p>}
          <div className="pl-11 space-y-3">
            {ECOG_OPTIONS.map((opt) => {
              const selected = answers[ECOG_KEY] === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAnswer(ECOG_KEY, opt.value)}
                  className={`w-full min-h-[56px] text-left px-4 py-3 rounded-xl border-2 transition-all ${
                    selected
                      ? "bg-emerald-600 border-emerald-700 text-white"
                      : "bg-white border-gray-300 text-gray-800 hover:border-emerald-400"
                  }`}
                >
                  <p className="text-lg font-bold">{selected && <span aria-hidden>✓ </span>}{opt.label}</p>
                  <p className={`text-base mt-0.5 ${selected ? "text-emerald-50" : "text-gray-600"}`}>
                    {opt.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Part III — IPAQ */}
        <div className="card space-y-6">
          <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Part III. 신체활동 (IPAQ)</h3>
          <p className="text-base text-gray-700">
            지난 7일 동안의 신체활동을 평가합니다. 적어도 10분 이상 지속한 활동만 포함하세요.
          </p>

          {IPAQ_ITEMS.map((item, itemIdx) => {
            const days = Number(answers[item.daysKey]);
            const showDuration = days > 0;
            return (
              <div key={item.id} className="space-y-4 border-t pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-start gap-3">
                  <span className="w-8 h-8 rounded-full text-base font-bold flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-800 mt-0.5">
                    {ipaqBaseNumber + itemIdx * 2 + 1}
                  </span>
                  <div>
                    <p className="text-lg font-bold text-gray-900">{item.activityLabel}</p>
                    <p className="text-base text-gray-700 mt-0.5">{item.description}</p>
                  </div>
                </div>

                {/* Days question */}
                <div
                  id={`field-${item.daysKey}`}
                  className={`sm:pl-11 space-y-2 rounded-lg border-2 p-3 transition-colors ${
                    errorKeys.has(item.daysKey) ? "border-red-500" : "border-transparent"
                  }`}
                >
                  <p className="text-lg text-gray-900">{item.daysLabel}</p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: 8 }, (_, i) => i).map((d) => {
                      const selected = answers[item.daysKey] === d;
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setAnswer(item.daysKey, d)}
                          className={`w-12 h-12 rounded-lg border-2 text-lg font-bold transition-all ${
                            selected
                              ? "bg-emerald-600 border-emerald-700 text-white"
                              : "bg-white border-gray-300 text-gray-800 hover:border-emerald-400"
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  {errorKeys.has(item.daysKey) && <p className="text-base font-semibold text-red-700">⚠ 이 문항에 답해 주세요</p>}
                </div>

                {/* Duration (only if days > 0) */}
                {showDuration && (
                  <div
                    id={`field-${item.hoursKey}`}
                    className={`sm:pl-11 space-y-2 rounded-lg border-2 p-3 transition-colors ${
                      errorKeys.has(item.hoursKey)
                        ? "border-red-500"
                        : "border-transparent"
                    }`}
                  >
                    <p className="text-lg text-gray-900">{item.durationLabel}</p>
                    <DurationInput
                      hoursKey={item.hoursKey}
                      minutesKey={item.minutesKey}
                      answers={answers}
                      setAnswer={setAnswer}
                    />
                    {errorKeys.has(item.hoursKey) && (
                      <p className="text-base font-semibold text-red-700">⚠ 시간이나 분 중 하나는 적어 주세요 (없는 쪽은 비워 두거나 0)</p>
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
                errorKeys.has(SITTING_KEYS.hours)
                  ? "border-red-500"
                  : "border-transparent"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full text-base font-bold flex items-center justify-center flex-shrink-0 bg-emerald-100 text-emerald-800">
                  {sittingNumber}
                </span>
                <p className="text-lg text-gray-900">{SITTING_LABEL}</p>
              </div>
              <div className="sm:pl-11">
                <DurationInput
                  hoursKey={SITTING_KEYS.hours}
                  minutesKey={SITTING_KEYS.minutes}
                  answers={answers}
                  setAnswer={setAnswer}
                />
              </div>
              {errorKeys.has(SITTING_KEYS.hours) && (
                <p className="text-base font-semibold text-red-700 sm:pl-11">⚠ 시간이나 분 중 하나는 적어 주세요 (없는 쪽은 비워 두거나 0)</p>
              )}
            </div>
          </div>
        </div>

        {/* Part IV — Emergency screening */}
        <div className="card space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900 border-b pb-2">Part IV. 응급 선별문항</h3>
            <p className="text-base text-gray-700 pt-2">
              최근 상태 중 응급 처치가 필요할 수 있는 증상이 있는지 확인합니다.
            </p>
          </div>

          {EMERGENCY_SCREENING.map((q, qIdx) => (
            <div
              key={q.key}
              id={`field-${q.key}`}
              className={`space-y-2 rounded-xl border-2 p-3 transition-colors ${
                errorKeys.has(q.key) ? "border-red-500" : "border-transparent"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`w-8 h-8 rounded-full text-base font-bold flex items-center justify-center flex-shrink-0 mt-0.5 ${
                  errorKeys.has(q.key) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-800"
                }`}>{emergencyBaseNumber + qIdx}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-600">{q.title}</p>
                  <p className="text-lg font-medium text-gray-900">{q.question}</p>
                </div>
              </div>
              {errorKeys.has(q.key) && <p className="text-base font-semibold text-red-700 pl-11">⚠ 이 문항에 답해 주세요</p>}
              <div className="flex flex-wrap gap-2 pl-11">
                {q.options.map((opt) => {
                  const selected = answers[q.key] === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setAnswer(q.key, opt.value)}
                      className={`min-h-[56px] px-4 py-2 rounded-lg border-2 text-lg transition-all ${
                        selected
                          ? "bg-emerald-600 border-emerald-700 text-white font-bold"
                          : "bg-white border-gray-300 text-gray-800 hover:border-emerald-400"
                      }`}
                    >
                      {selected && <span aria-hidden>✓ </span>}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={`w-full min-h-[64px] text-lg text-white font-bold rounded-xl transition-colors ${
            unansweredCount > 0
              ? "bg-amber-600 hover:bg-amber-700"
              : "bg-green-600 hover:bg-green-700"
          } disabled:bg-gray-200 disabled:text-gray-500`}
        >
          {submitting
            ? "제출 중..."
            : unansweredCount > 0
            ? `답하지 않은 문항이 ${unansweredCount}개 있어요`
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
    <div className="space-y-1">
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={24}
          value={answers[hoursKey] ?? ""}
          onChange={(e) => setAnswer(hoursKey, e.target.value)}
          className="w-20 min-h-[56px] px-2 py-2 border-2 border-gray-300 rounded-lg text-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="0"
        />
        <span className="text-lg text-gray-700">시간</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          value={answers[minutesKey] ?? ""}
          onChange={(e) => setAnswer(minutesKey, e.target.value)}
          className="w-20 min-h-[56px] px-2 py-2 border-2 border-gray-300 rounded-lg text-lg text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
          placeholder="0"
        />
        <span className="text-lg text-gray-700">분</span>
      </div>
    </div>
    <p className="text-base text-gray-600">예) 30분이면 분 칸에만 30, 시간 칸은 비워 두셔도 돼요.</p>
    </div>
  );
}

export default function W0Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-lg text-gray-600">설문을 불러오는 중...</div>}>
      <W0Content />
    </Suspense>
  );
}
