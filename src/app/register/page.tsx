"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Step = "form" | "done";

export default function RegisterPage() {
  const [step, setStep] = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);

  const [name, setName]               = useState("");
  const [recordOrBirth, setRecordOrBirth] = useState("");
  const [contact, setContact]         = useState("");
  const [consent, setConsent]         = useState(false);

  const [errors, setErrors] = useState<Partial<Record<"name" | "recordOrBirth" | "contact" | "consent", string>>>({});

  function validate() {
    const e: typeof errors = {};
    if (!name.trim())           e.name           = "이름을 입력해 주세요.";
    if (!recordOrBirth.trim())  e.recordOrBirth  = "생년월일을 입력해 주세요.";
    if (!contact.trim())        e.contact        = "연락처를 입력해 주세요.";
    if (!consent)               e.consent        = "개인정보 제공에 동의해 주세요.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("participants")
        .insert({
          name: name.trim(),
          record_or_birth: recordOrBirth.trim(),
          contact: contact.trim(),
          consent_agreed: true,
        });
      if (error) throw error;
      setStep("done");
    } catch (err) {
      console.error(err);
      alert("오류가 발생했습니다. 다시 시도해 주세요.");
      setSubmitting(false);
    }
  }

  if (step === "done") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm space-y-5 text-center">
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-gray-900">신청이 완료되었습니다</h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              연구팀에서 검토 후 <strong>연구참여자번호</strong>를 개별적으로 안내해 드릴 예정입니다.<br />
              번호를 받으신 후 첫 화면에서 설문을 시작해 주세요.
            </p>
          </div>
          <a
            href="/"
            className="block w-full py-2.5 border border-gray-300 rounded-xl text-sm text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            처음으로 돌아가기
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm space-y-5"
      >
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gray-900">연구 참여신청</h1>
          <p className="text-sm text-gray-500">아래 정보를 입력하시면 연구팀이 확인 후 연락드립니다.</p>
        </div>

        {/* 이름 */}
        <Field label="이름" error={errors.name}>
          <input
            type="text"
            required
            placeholder="홍길동"
            value={name}
            onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
            className={inputCls(!!errors.name)}
          />
        </Field>

        {/* 생년월일 */}
        <Field label="생년월일" error={errors.recordOrBirth} hint="예) 19801231">
          <input
            type="text"
            required
            placeholder="생년월일 8자리 (예: 19801231)"
            value={recordOrBirth}
            onChange={(e) => { setRecordOrBirth(e.target.value); setErrors((p) => ({ ...p, recordOrBirth: undefined })); }}
            className={inputCls(!!errors.recordOrBirth)}
          />
        </Field>

        {/* 연락처 */}
        <Field label="연락처" error={errors.contact} hint="예) 010-1234-5678">
          <input
            type="tel"
            required
            placeholder="010-0000-0000"
            value={contact}
            onChange={(e) => { setContact(e.target.value); setErrors((p) => ({ ...p, contact: undefined })); }}
            className={inputCls(!!errors.contact)}
          />
        </Field>

        {/* 동의 */}
        <div className="space-y-1">
          <label className={`flex items-start gap-2.5 cursor-pointer rounded-xl border-2 p-3 transition-colors ${
            errors.consent ? "border-red-300 bg-red-50" : consent ? "border-primary-300 bg-primary-50" : "border-gray-200"
          }`}>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => { setConsent(e.target.checked); setErrors((p) => ({ ...p, consent: undefined })); }}
              className="mt-0.5 w-4 h-4 accent-primary-600 flex-shrink-0"
            />
            <span className="text-xs text-gray-600 leading-relaxed">
              본인은 연구 목적으로 제공한 개인정보(이름, 생년월일, 연락처)가 수집·이용됨에 동의합니다. 수집된 정보는 연구 외 목적으로 사용되지 않습니다.
            </span>
          </label>
          {errors.consent && <p className="text-xs text-red-500 pl-1">{errors.consent}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors duration-150"
        >
          {submitting ? "신청 중..." : "참여신청 제출"}
        </button>

      </form>
    </div>
  );
}

function Field({
  label, error, hint, children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
    hasError
      ? "border-red-300 focus:ring-red-300"
      : "border-gray-300 focus:ring-primary-500 focus:border-transparent"
  }`;
}
