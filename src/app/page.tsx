"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StartPage() {
  const router = useRouter();
  const [patientCode, setPatientCode] = useState("");

  function handleStart(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/select?code=${encodeURIComponent(patientCode.trim())}`);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <form
        onSubmit={handleStart}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm space-y-6"
      >
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-gray-900">암증상설문조사</h1>
          <p className="text-sm text-gray-500">연구참여자번호를 입력하세요.</p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700" htmlFor="patient_code">
            연구참여자번호
          </label>
          <input
            id="patient_code"
            type="text"
            required
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            placeholder="참여자번호를 입력하세요"
            value={patientCode}
            onChange={(e) => setPatientCode(e.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={!patientCode.trim()}
          className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors duration-150"
        >
          다음 →
        </button>
      </form>
    </div>
  );
}
