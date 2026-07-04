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
    <div className="max-w-xl mx-auto space-y-6 py-4">

      {/* 안내문 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">외래기반 항체-약물 접합체(ADC) 치료를 받는 암 환자의 증상 부담 연구</p>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed">
          본 조사는 항체-약물 접합체(ADC) 항암 치료를 받으시는 동안 환자분이 일상생활에서 느끼시는 부작용과 삶의 질 변화를 세밀하게 확인하여, 더 안전하고 정밀한 간호 중재를 제공하고자 시행되는 설문 조사입니다.
        </p>

        <p className="text-sm text-gray-700 leading-relaxed">
          귀하께서 병원 외래에서 서면 동의서를 작성해 주심에 따라 매주 모바일 설문이 발송됩니다. 설문 시작 전 다음 사항을 확인해 주시기 바랍니다.
        </p>

        {/* 꼭 확인해 주세요 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-bold text-amber-800">📌 꼭 확인해 주세요!</p>
          <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside leading-relaxed">
            <li>
              <span className="font-semibold">자발적 참여 및 철회권</span>: 본 설문 참여는 전적으로 환자분의 자발적 의사에 따르며, 언제든지 중간에 중단하실 수 있습니다. 응답 내용이나 참여 중단 여부는 환자분의 진료 및 항암 치료 과정에 어떠한 임상적 영향이나 불이익도 주지 않습니다.
            </li>
            <li>
              <span className="font-semibold">비밀 보장</span>: 환자분이 입력하신 모든 증상 정보는 고유 연구 코드로 대체되어 철저히 익명화되며, 연구 목적 외에는 절대 사용되지 않습니다.
            </li>
            <li>
              <span className="font-semibold">매주 참여 사례비 지급</span>
              <ul className="mt-1 ml-4 space-y-0.5 text-gray-600 list-disc list-inside">
                <li>매주 1회 증상부담 설문 작성 시: <span className="font-medium text-gray-800">10,000원</span> 상당 모바일 쿠폰 발송</li>
                <li>분기별 주차 (증상부담 + 삶의 질 설문 함께 작성 시): <span className="font-medium text-gray-800">20,000원</span> 상당 모바일 쿠폰 발송</li>
              </ul>
              <p className="mt-1 text-xs text-gray-500">※ 해당 주차에 설문 제출을 최종 완료하시면 확인 후 1주 이내에 즉시 휴대폰으로 발송됩니다.</p>
            </li>
            <li>
              <span className="font-semibold">미제출 시 안내</span>: 설문 링크를 받으신 후 72시간(3일) 동안 응답이 제출되지 않는 경우, 단순 누락이나 피로도를 확인하고 도움을 드리기 위해 연구 담당 간호사가 직접 안부 전화를 드릴 수 있습니다.
            </li>
          </ol>
        </div>

        {/* 설문 작성 안내 */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-gray-700">설문 작성 안내</p>
          <p className="text-sm text-gray-600 leading-relaxed">
            질문을 읽고 <span className="font-semibold text-gray-800">"지난 일주일(7일) 동안"</span> 본인이 겪은 경험과 가장 가까운 항목에 체크해 주십시오. 환자 본인이 직접 작성하는 것이 원칙이나, 눈이 흐리거나 기기 조작이 불편하신 경우 등록된 보호자분께서 대리 입력해 주셔도 좋습니다.
          </p>
        </div>

        <p className="text-sm text-gray-500 text-center">
          환자분의 소중한 데이터는 암 환자 간호 발전에 큰 보탬이 됩니다. 감사합니다.
        </p>
      </div>

      {/* 설문 시작 폼 */}
      <form
        onSubmit={handleStart}
        className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4"
      >
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
          설문 시작하기 →
        </button>

        <p className="text-center text-xs text-gray-400">
          처음 방문하셨나요?{" "}
          <a href="/register" className="text-primary-600 hover:underline font-medium">참여신청하기</a>
        </p>
      </form>

    </div>
  );
}
