"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  SURVEY_ITEMS,
  CATEGORIES,
  getItemsByCategory,
  getTotalQuestionCount,
  SurveyItem,
  QuestionType,
} from "@/lib/questions";
import QuestionItem from "@/components/QuestionItem";
import ProgressBar from "@/components/ProgressBar";

type AnswerMap = Record<string, number | boolean | null>;

function buildAnswerKey(itemId: number, qKey: string) {
  return `${itemId}-${qKey}`;
}

function noSymptomValue(type: QuestionType): number | boolean {
  return type === "presence" ? false : 0;
}

function isUnanswered(val: unknown) {
  return val === undefined || val === null;
}

function SurveyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorItemIds, setErrorItemIds] = useState<Set<number>>(new Set());
  const firstErrorRef = useRef<HTMLDivElement>(null);

  const totalQuestions = getTotalQuestionCount();
  const answeredCount = Object.values(answers).filter((v) => !isUnanswered(v)).length;

  const currentCategory = CATEGORIES[categoryIdx];
  const currentItems = getItemsByCategory(currentCategory);

  useEffect(() => {
    if (!sessionId) router.replace("/");
  }, [sessionId, router]);

  // Reset errors when category changes
  useEffect(() => {
    setErrorItemIds(new Set());
  }, [categoryIdx]);

  // Scroll to first error after state update
  useEffect(() => {
    if (errorItemIds.size > 0 && firstErrorRef.current) {
      firstErrorRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [errorItemIds]);

  function handleAnswer(itemId: number, qKey: string, value: number | boolean) {
    const key = buildAnswerKey(itemId, qKey);
    setAnswers((prev) => ({ ...prev, [key]: value }));
    // Clear error for this item if all its questions are now answered
    setErrorItemIds((prev) => {
      const item = SURVEY_ITEMS.find((i) => i.id === itemId);
      if (!item) return prev;
      const allAnswered = item.questions.every((q) => {
        const k = buildAnswerKey(item.id, q.key);
        return k === key ? true : !isUnanswered(answers[k]);
      });
      if (allAnswered) {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      }
      return prev;
    });
  }

  // "모두 증상 없음" toggle
  const isAllNone = currentItems.every((item) =>
    item.questions.every((q) => {
      const val = answers[buildAnswerKey(item.id, q.key)];
      return val === noSymptomValue(q.type);
    })
  );

  function handleAllNone(checked: boolean) {
    setAnswers((prev) => {
      const next = { ...prev };
      currentItems.forEach((item) => {
        item.questions.forEach((q) => {
          const key = buildAnswerKey(item.id, q.key);
          if (checked) {
            next[key] = noSymptomValue(q.type);
          } else {
            delete next[key];
          }
        });
      });
      return next;
    });
    if (checked) setErrorItemIds(new Set());
  }

  function getUnansweredItems(items: SurveyItem[]) {
    return items.filter((item) =>
      item.questions.some((q) => isUnanswered(answers[buildAnswerKey(item.id, q.key)]))
    );
  }

  const saveCurrentCategory = useCallback(async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const rows = currentItems.flatMap((item) =>
        item.questions.map((q) => {
          const val = answers[buildAnswerKey(item.id, q.key)];
          return {
            session_id: sessionId,
            item_id: item.id,
            item_term_en: item.termEn,
            question_key: q.key,
            question_type: q.type,
            answer_value: q.type !== "presence" && !isUnanswered(val) ? (val as number) : null,
            answer_boolean: q.type === "presence" && !isUnanswered(val) ? (val as boolean) : null,
          };
        })
      ).filter((r) => r.answer_value !== null || r.answer_boolean !== null);

      if (rows.length > 0) {
        await supabase
          .from("survey_answers")
          .upsert(rows, { onConflict: "session_id,item_id,question_key" });
      }
    } finally {
      setSaving(false);
    }
  }, [sessionId, currentItems, answers]);

  async function handleNext() {
    const unanswered = getUnansweredItems(currentItems);
    if (unanswered.length > 0) {
      const ids = new Set(unanswered.map((i) => i.id));
      setErrorItemIds(ids);
      // firstErrorRef scroll is triggered via useEffect
      return;
    }
    setErrorItemIds(new Set());
    await saveCurrentCategory();
    setCategoryIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePrev() {
    await saveCurrentCategory();
    setCategoryIdx((i) => i - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (!sessionId) return;
    const unanswered = getUnansweredItems(currentItems);
    if (unanswered.length > 0) {
      const ids = new Set(unanswered.map((i) => i.id));
      setErrorItemIds(ids);
      return;
    }
    setSubmitting(true);
    try {
      await saveCurrentCategory();
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

  const isLast = categoryIdx === CATEGORIES.length - 1;
  const unansweredCount = getUnansweredItems(currentItems).length;

  let firstErrorSet = false;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <ProgressBar current={answeredCount} total={totalQuestions} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            {categoryIdx + 1} / {CATEGORIES.length} 단계
          </span>
          <span className="font-semibold text-gray-700">{currentCategory}</span>
          {saving && <span className="text-xs text-primary-500 animate-pulse">저장 중…</span>}
        </div>
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat, i) => {
            const items = getItemsByCategory(cat);
            const done = getUnansweredItems(items).length === 0 && items.every((item) =>
              item.questions.some((q) => !isUnanswered(answers[buildAnswerKey(item.id, q.key)]))
            );
            return (
              <span
                key={cat}
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  i === categoryIdx
                    ? "bg-primary-600 text-white"
                    : done
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {cat}
              </span>
            );
          })}
        </div>
      </div>

      {/* 모두 증상 없음 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-600">이 카테고리의 증상이 모두 없으셨나요?</span>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm font-medium text-gray-700">모두 증상 없음</span>
          <div
            onClick={() => handleAllNone(!isAllNone)}
            className={`w-11 h-6 rounded-full transition-colors duration-200 relative flex-shrink-0 ${
              isAllNone ? "bg-primary-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                isAllNone ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </div>
        </label>
      </div>

      {/* 미응답 경고 */}
      {errorItemIds.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-amber-800">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            아래 <strong>{errorItemIds.size}개 항목</strong>에 응답하지 않으셨습니다. 빨간 테두리 항목을 확인해 주세요.
          </span>
        </div>
      )}

      {/* Items */}
      <div className="space-y-4">
        {currentItems.map((item) => {
          const hasError = errorItemIds.has(item.id);
          const isFirstError = hasError && !firstErrorSet;
          if (isFirstError) firstErrorSet = true;

          return (
            <div
              key={item.id}
              id={`item-${item.id}`}
              ref={isFirstError ? firstErrorRef : undefined}
              className={`bg-white rounded-2xl shadow-sm border-2 p-5 space-y-5 transition-colors ${
                hasError ? "border-red-400" : "border-transparent"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 w-7 h-7 rounded-full text-sm font-bold flex items-center justify-center flex-shrink-0 ${
                  hasError ? "bg-red-100 text-red-600" : "bg-primary-100 text-primary-700"
                }`}>
                  {item.id}
                </span>
                <div>
                  <p className="font-semibold text-gray-900">{item.termKo}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.termEn}</p>
                </div>
                {hasError && (
                  <span className="ml-auto text-xs text-red-500 font-medium whitespace-nowrap">응답 필요</span>
                )}
              </div>

              <div className="space-y-6 pl-10">
                {item.questions.map((q) => {
                  const key = buildAnswerKey(item.id, q.key);
                  return (
                    <QuestionItem
                      key={key}
                      itemId={item.id}
                      question={q}
                      value={answers[key] ?? null}
                      onChange={(val) => handleAnswer(item.id, q.key, val)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Nav */}
      <div className="flex gap-3">
        {categoryIdx > 0 && (
          <button
            onClick={handlePrev}
            className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            ← 이전
          </button>
        )}
        {!isLast ? (
          <button
            onClick={handleNext}
            className={`flex-1 py-3 text-white font-semibold rounded-xl transition-colors ${
              unansweredCount > 0
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-primary-600 hover:bg-primary-700"
            }`}
          >
            {unansweredCount > 0 ? `미응답 ${unansweredCount}개 확인 →` : "다음 →"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex-1 py-3 text-white font-semibold rounded-xl transition-colors ${
              unansweredCount > 0
                ? "bg-amber-500 hover:bg-amber-600"
                : "bg-green-600 hover:bg-green-700"
            } disabled:bg-gray-200 disabled:text-gray-400`}
          >
            {submitting ? "제출 중..." : unansweredCount > 0 ? `미응답 ${unansweredCount}개 확인 →` : "설문 완료 및 제출 ✓"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20 text-gray-400">
        설문을 불러오는 중...
      </div>
    }>
      <SurveyContent />
    </Suspense>
  );
}
