"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CompleteContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session");

  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-8">
      <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
        <svg
          className="w-10 h-10 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>

      <div className="text-center space-y-3 max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">설문이 완료되었습니다</h1>
        <p className="text-gray-600 leading-relaxed">
          소중한 시간을 내어 설문에 참여해 주셔서 감사합니다. 귀하의 응답은 암
          치료 중 증상 관리 개선에 도움이 됩니다.
        </p>
        {sessionId && (
          <p className="text-xs text-gray-400 font-mono bg-gray-50 px-3 py-1.5 rounded-lg">
            응답 ID: {sessionId}
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <Link
          href="/"
          className="flex-1 py-3 text-center bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
        >
          새 설문 시작
        </Link>
        <button
          onClick={() => window.print()}
          className="flex-1 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-xl transition-colors"
        >
          결과 인쇄
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 max-w-sm w-full text-sm text-blue-800">
        <p className="font-medium mb-1">안내</p>
        <p>
          이 설문은 의사나 의료진에게 증상을 보고하기 위한 도구입니다. 응급
          상황이 발생한 경우에는 즉시 의료진에게 연락하거나 119에 신고해
          주십시오.
        </p>
      </div>
    </div>
  );
}

export default function CompletePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400">로딩 중...</div>}>
      <CompleteContent />
    </Suspense>
  );
}
