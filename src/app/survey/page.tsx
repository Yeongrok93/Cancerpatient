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

type SaveRow = { item_id: number; question_key: string; value: number | boolean };

async function postAnswers(sessionId: string, rows: SaveRow[]) {
  if (rows.length === 0) return;
  const res = await fetch("/api/survey/answers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, rows }),
  });
  if (!res.ok) throw new Error(`save failed (${res.status})`);
}

function SurveyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get("session");

  const [answers, setAnswers] = useState<AnswerMap>({});
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [resumed, setResumed] = useState(false);
  const [categoryIdx, setCategoryIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorItemIds, setErrorItemIds] = useState<Set<number>>(new Set());
  const [additionalComment, setAdditionalComment] = useState("");
  const firstErrorRef = useRef<HTMLDivElement>(null);

  const totalQuestions = getTotalQuestionCount();
  const answeredCount = Object.values(answers).filter((v) => !isUnanswered(v)).length;

  const currentCategory = CATEGORIES[categoryIdx];
  const currentItems = getItemsByCategory(currentCategory);

  // Load whatever was already saved for this session so a patient who left
  // mid-survey picks up where they stopped.
  useEffect(() => {
    if (!sessionId) {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      const [sessionRes, answersRes] = await Promise.all([
        supabase.from("survey_sessions").select("is_complete").eq("id", sessionId).maybeSingle(),
        supabase
          .from("survey_answers")
          .select("item_id, question_key, question_type, answer_value, answer_boolean")
          .eq("session_id", sessionId),
      ]).catch((err) => {
        console.error(err);
        return [null, null] as const;
      });
      if (cancelled) return;
      if (!sessionRes || !answersRes || sessionRes.error || answersRes.error) {
        setLoadFailed(true);
        return;
      }
      const session = sessionRes.data;
      const rows = answersRes.data;
      if (session?.is_complete) {
        router.replace(`/survey/complete?session=${sessionId}`);
        return;
      }
      const map: AnswerMap = {};
      (rows ?? []).forEach((r) => {
        map[buildAnswerKey(r.item_id, r.question_key)] =
          r.question_type === "presence" ? r.answer_boolean : r.answer_value;
      });
      const firstOpen = CATEGORIES.findIndex((cat) =>
        getItemsByCategory(cat).some((item) =>
          item.questions.some((q) => isUnanswered(map[buildAnswerKey(item.id, q.key)]))
        )
      );
      setAnswers(map);
      setCategoryIdx(firstOpen === -1 ? CATEGORIES.length - 1 : firstOpen);
      setResumed(Object.keys(map).length > 0);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
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

  // Every tap is saved right away (not just on "다음"), so leaving the page
  // at any point loses nothing. A failure only shows a notice here — the
  // category save on "다음"/"제출" retries and blocks if it still fails.
  function saveInBackground(rows: SaveRow[]) {
    if (!sessionId) return;
    postAnswers(sessionId, rows)
      .then(() => setSaveFailed(false))
      .catch((err) => {
        console.error(err);
        setSaveFailed(true);
      });
  }

  function handleAnswer(itemId: number, qKey: string, value: number | boolean) {
    const key = buildAnswerKey(itemId, qKey);
    setAnswers((prev) => ({ ...prev, [key]: value }));
    saveInBackground([{ item_id: itemId, question_key: qKey, value }]);
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
    if (checked) {
      setErrorItemIds(new Set());
      saveInBackground(
        currentItems.flatMap((item) =>
          item.questions.map((q) => ({ item_id: item.id, question_key: q.key, value: noSymptomValue(q.type) }))
        )
      );
    }
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
      const rows: SaveRow[] = currentItems.flatMap((item) =>
        item.questions.flatMap((q) => {
          const val = answers[buildAnswerKey(item.id, q.key)];
          return isUnanswered(val) ? [] : [{ item_id: item.id, question_key: q.key, value: val as number | boolean }];
        })
      );
      await postAnswers(sessionId, rows);
      setSaveFailed(false);
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
    try {
      await saveCurrentCategory();
    } catch (err) {
      console.error(err);
      setSaveFailed(true);
      alert("답변 저장에 실패했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.");
      return;
    }
    setCategoryIdx((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePrev() {
    // Going back shouldn't be blocked by a save error; every answer was
    // already sent individually, and "다음" will retry this category.
    await saveCurrentCategory().catch(() => setSaveFailed(true));
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
    const firstOpen = CATEGORIES.findIndex((cat) => getUnansweredItems(getItemsByCategory(cat)).length > 0);
    if (firstOpen !== -1) {
      alert(`'${CATEGORIES[firstOpen]}' 영역에 답하지 않은 문항이 있어요. 해당 영역으로 이동합니다.`);
      setCategoryIdx(firstOpen);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      await saveCurrentCategory();
      const { error } = await supabase
        .from("survey_sessions")
        .update({
          is_complete: true,
          completed_at: new Date().toISOString(),
          additional_comments: additionalComment.trim() || null,
        })
        .eq("id", sessionId);
      if (error) throw error;
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

  if (!sessionId) return null;
  if (loadFailed) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-lg text-gray-800">설문을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>
        <button
          onClick={() => window.location.reload()}
          className="min-h-[56px] px-6 rounded-xl bg-primary-600 text-white text-lg font-bold"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (!loaded) {
    return <p className="text-center text-lg text-gray-600 py-20">설문을 불러오는 중...</p>;
  }

  return (
    <div className="space-y-6">
      {resumed && (
        <div className="bg-primary-50 border-2 border-primary-200 rounded-xl px-4 py-3 text-base text-primary-900">
          이전에 답하신 내용을 불러왔어요. 이어서 진행해 주세요.
        </div>
      )}

      {saveFailed && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl px-4 py-3 text-base text-red-800">
          ⚠ 답변이 저장되지 않았어요. 인터넷 연결을 확인해 주세요.
        </div>
      )}

      {/* Progress */}
      <div className="card space-y-3">
        <ProgressBar current={answeredCount} total={totalQuestions} />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-base text-gray-700">
              전체 {CATEGORIES.length}개 영역 중 {categoryIdx + 1}번째
            </p>
            <p className="text-xl font-bold text-gray-900">{currentCategory}</p>
          </div>
          {saving && <span className="text-sm text-primary-700 animate-pulse">저장 중…</span>}
        </div>
        <p className="text-base text-gray-700">
          답변은 누르실 때마다 자동 저장됩니다. 중간에 나가셔도 다시 들어오시면 이어서 하실 수 있어요.
        </p>
        <div className="hidden sm:flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat, i) => {
            const items = getItemsByCategory(cat);
            const done = items.every((item) =>
              item.questions.every((q) => !isUnanswered(answers[buildAnswerKey(item.id, q.key)]))
            );
            return (
              <span
                key={cat}
                className={`px-2.5 py-1 rounded-full text-sm font-medium ${
                  i === categoryIdx
                    ? "bg-primary-600 text-white"
                    : done
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {cat}
              </span>
            );
          })}
        </div>
      </div>

      {/* 모두 증상 없음 */}
      <div className="card space-y-3">
        <p className="text-lg text-gray-800">이 영역의 증상이 모두 없으셨나요?</p>
        <button
          type="button"
          onClick={() => handleAllNone(!isAllNone)}
          aria-pressed={isAllNone}
          className={`w-full min-h-[56px] px-4 py-3 rounded-xl border-2 text-lg font-bold transition-colors ${
            isAllNone
              ? "bg-primary-600 border-primary-700 text-white"
              : "bg-white border-primary-600 text-primary-700 hover:bg-primary-50"
          }`}
        >
          {isAllNone ? "✓ 모두 '없음'으로 선택됨 (다시 누르면 취소)" : "이 영역 증상이 모두 없었어요"}
        </button>
      </div>

      {/* 미응답 경고 */}
      {errorItemIds.size > 0 && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl px-4 py-3 text-base text-amber-900">
          ⚠ 답하지 않은 문항이 <strong>{errorItemIds.size}개</strong> 있어요. 빨간 테두리 문항에 답해 주세요.
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
              className={`bg-white rounded-2xl shadow-sm border-2 p-4 sm:p-5 space-y-5 transition-colors ${
                hasError ? "border-red-500" : "border-transparent"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 w-8 h-8 rounded-full text-base font-bold flex items-center justify-center flex-shrink-0 ${
                  hasError ? "bg-red-100 text-red-700" : "bg-primary-100 text-primary-800"
                }`}>
                  {item.id}
                </span>
                <p className="text-xl font-bold text-gray-900 break-keep">{item.termKo}</p>
              </div>

              {hasError && (
                <p className="text-base font-semibold text-red-700">⚠ 이 문항에 답해 주세요</p>
              )}

              <div className="space-y-7 sm:pl-11">
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

      {/* 추가 의견 (선택) */}
      {isLast && (
        <div className="card space-y-3">
          <div>
            <p className="text-lg font-semibold text-gray-900 leading-relaxed break-keep">
              지난 일주일 동안 위에 답변하신 증상(부작용) 외에, 일상생활이나 재택 자가 관리 과정에서 의료진에게 추가로 알리고 싶거나 환자분이 느끼신 구체적인 어려움(신체적 고통, 정서적 스트레스, 생활의 제약 등)이 있다면 자유롭게 적어주십시오.
            </p>
            <p className="text-base text-gray-700 mt-1">선택 사항입니다. 해당 사항이 없으면 비워두셔도 됩니다.</p>
          </div>
          <textarea
            value={additionalComment}
            onChange={(e) => setAdditionalComment(e.target.value)}
            rows={5}
            placeholder="자유롭게 적어주세요 (선택 사항)"
            className="w-full px-3 py-3 border-2 border-gray-300 rounded-xl text-lg focus:outline-none focus:ring-2 focus:ring-primary-400 resize-y"
          />
        </div>
      )}

      {/* Nav */}
      <div className="flex gap-3">
        {categoryIdx > 0 && (
          <button
            onClick={handlePrev}
            className="flex-1 min-h-[64px] border-2 border-gray-400 rounded-xl text-lg text-gray-800 font-semibold hover:bg-gray-50 transition-colors"
          >
            ← 이전
          </button>
        )}
        {!isLast ? (
          <button
            onClick={handleNext}
            className={`flex-[2] min-h-[64px] px-2 text-lg text-white font-bold rounded-xl transition-colors ${
              unansweredCount > 0
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-primary-600 hover:bg-primary-700"
            }`}
          >
            {unansweredCount > 0 ? `답하지 않은 문항이 ${unansweredCount}개 있어요` : "다음 →"}
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className={`flex-[2] min-h-[64px] px-2 text-lg text-white font-bold rounded-xl transition-colors ${
              unansweredCount > 0
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-green-600 hover:bg-green-700"
            } disabled:bg-gray-200 disabled:text-gray-500`}
          >
            {submitting ? "제출 중..." : unansweredCount > 0 ? `답하지 않은 문항이 ${unansweredCount}개 있어요` : "설문 완료 및 제출 ✓"}
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
