"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getTotalQuestionCount } from "@/lib/questions";

const GENDER_OPTIONS = [
  { value: "male", label: "남성" },
  { value: "female", label: "여성" },
  { value: "other", label: "기타" },
  { value: "prefer_not", label: "응답 안 함" },
];

export default function StartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    patient_code: "",
    age: "",
    gender: "",
    cancer_type: "",
    treatment_type: "",
  });

  const totalQuestions = getTotalQuestionCount();

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("survey_sessions")
        .insert({
          patient_code: form.patient_code || null,
          age: form.age ? parseInt(form.age) : null,
          gender: form.gender || null,
          cancer_type: form.cancer_type || null,
          treatment_type: form.treatment_type || null,
        })
        .select("id")
        .single();

      if (error) throw error;
      router.push(`/survey?session=${data.id}`);
    } catch (err) {
      console.error(err);
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">
          PRO-CTCAE™ 증상 설문
        </h1>
        <p className="text-gray-600 leading-relaxed">
          암 치료를 받는 동안 여러 가지 다른 증상을 경험하거나 부작용을 겪을 수
          있습니다. 각 질문을 읽고 <strong>지난 7일 동안</strong>의 경험을 가장
          잘 나타내는 답을 선택해 주십시오.
        </p>
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            80개 증상 항목
          </div>
          <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {totalQuestions}개 문항
          </div>
          <div className="flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full text-sm font-medium">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            개인정보 보호
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleStart} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">기본 정보 입력</h2>
        <p className="text-sm text-gray-500">
          아래 항목은 모두 선택 사항입니다. 입력하지 않아도 설문을 시작할 수 있습니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="patient_code">
              환자 코드 (선택)
            </label>
            <input
              id="patient_code"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="예: P-2024-001"
              value={form.patient_code}
              onChange={(e) => setForm({ ...form, patient_code: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="age">
              나이 (선택)
            </label>
            <input
              id="age"
              type="number"
              min={1}
              max={120}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="예: 55"
              value={form.age}
              onChange={(e) => setForm({ ...form, age: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="gender">
              성별 (선택)
            </label>
            <select
              id="gender"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
            >
              <option value="">선택 안 함</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="cancer_type">
              암 종류 (선택)
            </label>
            <input
              id="cancer_type"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="예: 유방암, 폐암, 대장암"
              value={form.cancer_type}
              onChange={(e) => setForm({ ...form, cancer_type: e.target.value })}
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="text-sm font-medium text-gray-700" htmlFor="treatment_type">
              치료 방법 (선택)
            </label>
            <input
              id="treatment_type"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="예: 항암화학요법, 방사선치료, 표적치료, 면역치료"
              value={form.treatment_type}
              onChange={(e) => setForm({ ...form, treatment_type: e.target.value })}
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-6 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 text-white font-semibold rounded-xl transition-colors duration-150 text-base"
          >
            {loading ? "시작 중..." : "설문 시작하기 →"}
          </button>
        </div>
      </form>

      <p className="text-xs text-center text-gray-400">
        본 설문은 NCI PRO-CTCAE™ Item Library Version 1.0 한국어 번역판입니다.
      </p>
    </div>
  );
}
