"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getResumableProCtcaeSession, getSurveyAvailability, startSurveySession, type SurveyAvailability } from "@/lib/actions";

const SURVEYS = [
  {
    type: "w0" as const,
    step: 1,
    title: "기본정보 설문",
    subtitle: "기본정보 + 신체활동",
    description: "기본정보 7문항 + 신체활동 7문항 · 약 5분 · 처음 한 번만",
    color: "border-emerald-200 hover:border-emerald-400",
    route: "/survey/w0",
  },
  {
    type: "pro_ctcae" as const,
    step: 2,
    title: "증상 설문",
    subtitle: "암 치료 관련 증상 평가",
    description: "80가지 증상 항목 · 약 15~20분",
    color: "border-primary-200 hover:border-primary-400",
    route: "/survey",
  },
  {
    type: "qlq_c30" as const,
    step: 3,
    title: "삶의 질 설문",
    subtitle: "삶의 질 평가",
    description: "30문항 · 약 5~10분 · 12주마다",
    color: "border-blue-200 hover:border-blue-400",
    route: "/survey/qlq-c30",
  },
];

function SelectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";
  const [loadingType, setLoadingType] = useState<string | null>(null);
  // Most recent unfinished PRO-CTCAE session for this patient, if any —
  // re-entering the survey continues it instead of starting a blank one.
  const [resumeSessionId, setResumeSessionId] = useState<string | null>(null);
  // Which surveys are open right now (기본정보는 1회, 삶의 질은 12주마다).
  const [availability, setAvailability] = useState<Record<string, SurveyAvailability> | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    getSurveyAvailability(code)
      .then((a) => {
        if (!cancelled) setAvailability(a);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    getResumableProCtcaeSession(code)
      .then((id) => {
        if (!cancelled) setResumeSessionId(id);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleSelect(survey: (typeof SURVEYS)[number]) {
    if (!code || availability?.[survey.type]?.open === false) return;
    setLoadingType(survey.type);
    try {
      // For PRO-CTCAE this returns the unfinished session if there is one.
      const result = await startSurveySession(code, survey.type);
      if (!result.ok) throw new Error(result.error);
      router.push(`${survey.route}?session=${result.sessionId}`);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error && err.message ? err.message : "오류가 발생했습니다. 다시 시도해 주세요.");
      setLoadingType(null);
    }
  }

  if (!code) {
    router.replace("/");
    return null;
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center space-y-1 pt-4">
        <p className="text-sm text-gray-600 font-mono">참여자번호: {code}</p>
        <h1 className="text-2xl font-bold text-gray-900">설문지 선택</h1>
        <p className="text-lg text-gray-700">1번부터 순서대로 작성해 주세요.</p>
      </div>

      <div className="space-y-4">
        {SURVEYS.map((survey) => {
          const state = availability?.[survey.type];
          const locked = state?.open === false;
          return (
          <button
            key={survey.type}
            onClick={() => handleSelect(survey)}
            disabled={loadingType !== null || locked}
            className={`w-full text-left bg-white rounded-2xl border-2 p-5 transition-all duration-150 shadow-sm hover:shadow-md disabled:cursor-not-allowed ${
              locked ? "opacity-60 bg-gray-50 border-gray-200 hover:shadow-sm" : "disabled:opacity-60"
            } ${locked ? "" : survey.color}`}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-gray-900">{survey.step}. {survey.title}</p>
                  {locked && state?.label && (
                    <span className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-sm font-semibold">{state.label}</span>
                  )}
                  {loadingType === survey.type && (
                    <span className="text-sm text-primary-700 animate-pulse">로딩 중...</span>
                  )}
                </div>
                {survey.type === "pro_ctcae" && resumeSessionId && (
                  <p className="mt-1 inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-base font-semibold">
                    작성 중인 설문이 있어요 · 이어서 하기
                  </p>
                )}
                <p className="text-base text-gray-700 mt-0.5">{survey.subtitle}</p>
                <p className="text-base text-gray-600 mt-1">{survey.description}</p>
                {state?.note && (
                  <p className={`text-base mt-1 font-medium ${locked ? "text-gray-700" : "text-blue-800"}`}>{state.note}</p>
                )}
              </div>
              <svg className="w-6 h-6 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
          );
        })}
      </div>

      <p className="text-center text-base text-gray-600">
        각 설문은 독립적으로 저장됩니다. 필요한 설문을 모두 완료해 주세요.
      </p>
    </div>
  );
}

export default function SelectPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-400">불러오는 중...</div>}>
      <SelectContent />
    </Suspense>
  );
}
