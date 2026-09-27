"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

const SURVEYS = [
  {
    type: "pro_ctcae" as const,
    title: "증상 설문",
    subtitle: "암 치료 관련 증상 평가",
    description: "80가지 증상 항목 · 약 15~20분",
    color: "border-primary-200 hover:border-primary-400",
    route: "/survey",
  },
  {
    type: "qlq_c30" as const,
    title: "삶의 질 설문",
    subtitle: "삶의 질 평가",
    description: "30문항 · 약 5~10분",
    color: "border-blue-200 hover:border-blue-400",
    route: "/survey/qlq-c30",
  },
  {
    type: "w0" as const,
    title: "기본정보 설문",
    subtitle: "기본정보 + 신체활동",
    description: "기본정보 7문항 + 신체활동 7문항 · 약 5분",
    color: "border-emerald-200 hover:border-emerald-400",
    route: "/survey/w0",
  },
];

function SelectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";
  const [loadingType, setLoadingType] = useState<string | null>(null);

  async function handleSelect(survey: (typeof SURVEYS)[number]) {
    if (!code) return;
    setLoadingType(survey.type);
    try {
      const { data, error } = await supabase
        .from("survey_sessions")
        .insert({ patient_code: code, survey_type: survey.type })
        .select("id")
        .single();

      if (error) throw error;
      router.push(`${survey.route}?session=${data.id}`);
    } catch (err) {
      console.error(err);
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
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
        <p className="text-lg text-gray-700">아래 설문지 중 하나를 선택하세요.</p>
      </div>

      <div className="space-y-4">
        {SURVEYS.map((survey) => (
          <button
            key={survey.type}
            onClick={() => handleSelect(survey)}
            disabled={loadingType !== null}
            className={`w-full text-left bg-white rounded-2xl border-2 p-5 transition-all duration-150 shadow-sm hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed ${survey.color}`}
          >
            <div className="flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-gray-900">{survey.title}</p>
                  {loadingType === survey.type && (
                    <span className="text-sm text-primary-700 animate-pulse">로딩 중...</span>
                  )}
                </div>
                <p className="text-base text-gray-700 mt-0.5">{survey.subtitle}</p>
                <p className="text-base text-gray-600 mt-1">{survey.description}</p>
              </div>
              <svg className="w-6 h-6 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
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
