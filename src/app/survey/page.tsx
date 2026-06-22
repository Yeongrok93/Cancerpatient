"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  SURVEY_ITEMS,
  CATEGORIES,
  getItemsByCategory,
  getTotalQuestionCount,
  SurveyItem,
} from "@/lib/questions";
import QuestionItem from "@/components/QuestionItem";
import ProgressBar from "@/components/ProgressBar";

type AnswerMap = Record<string, number | boolean | null>;

function buildAnswerKey(itemId: number, qKey: string) {
  return `${itemId}-${qKey}`;
}

function SurveyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const totalQuestions = getTotalQuestionCount();
  const answeredCount = Object.values(answers).filter((v) => v !== null && v !== undefined).length;

  const currentCategory = CATEGORIES[categoryIdx];
  const currentItems = getItemsByCategory(currentCategory);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/");
    }
  }, [sessionId, router]);

  function handleAnswer(itemId: number, qKey: string, value: number | boolean) {
    const key = buildAnswerKey(itemId, qKey);
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function isCategoryComplete(items: SurveyItem[]) {
    return items.every((item) =>
      item.questions.every((q) => {
        const key = buildAnswerKey(item.id, q.key);
        return answers[key] !== undefined && answers[key] !== null;
      })
    );
  }

  const saveCurrentCategory = useCallback(async () => {
    if (!sessionId) return;
    setSaving(true);
    try {
      const rows = currentItems.flatMap((item) =>
        item.questions.map((q) => {
          const key = buildAnswerKey(item.id, q.key);
          const val = answers[key];
          return {
            session_id: sessionId,
            item_id: item.id,
            item_term_en: item.termEn,
            question_key: q.key,
            question_type: q.type,
            answer_value: q.type !== "presence" && val !== undefined && val !== null ? (val as number) : null,
            answer_boolean: q.type === "presence" && val !== undefined && val !== null ? (val as boolean) : null,
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
    setSubmitting(true);
    try {
      await saveCurrentCategory();

      // Save all unanswered items as explicit nulls? No — just mark complete.
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
  const canProceed = isCategoryComplete(currentItems);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <ProgressBar current={answeredCount} total={totalQuestions} />
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            카테고리 {categoryIdx + 1} / {CATEGORIES.length}
          </span>
          <span className="font-semibold text-gray-700">{currentCategory}</span>
          {saving && (
            <span className="text-xs text-primary-500 animate-pulse">저장 중…</span>
          )}
        </div>
        {/* Category tabs */}
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((cat, i) => {
            const items = getItemsByCategory(cat);
            const done = isCategoryComplete(items);
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

      {/* Items */}
      <div className="space-y-4">
        {currentItems.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center flex-shrink-0">
                {item.id}
              </span>
              <div>
                <p className="font-semibold text-gray-900">{item.termKo}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.termEn}</p>
              </div>
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
        ))}
      </div>

      {/* Nav buttons */}
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
            disabled={!canProceed}
            className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors"
          >
            {canProceed ? "다음 →" : "모든 문항에 답해주세요"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed || submitting}
            className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors"
          >
            {submitting ? "제출 중..." : "설문 완료 및 제출 ✓"}
          </button>
        )}
      </div>

      {!canProceed && (
        <p className="text-center text-sm text-amber-600">
          이 카테고리의 모든 문항에 답하신 후 다음으로 진행하실 수 있습니다.
        </p>
      )}
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
