"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSessionPatientCode, sendPatientMessage } from "@/lib/actions";

type Status = "idle" | "open" | "submitting" | "sent";

export default function ContactFab() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get("code");
  const sessionParam = searchParams.get("session");

  const [patientCode, setPatientCode] = useState<string | null>(codeParam);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (codeParam) {
      setPatientCode(codeParam);
      return;
    }
    if (!sessionParam) {
      setPatientCode(null);
      return;
    }
    let cancelled = false;
    getSessionPatientCode(sessionParam)
      .then((code) => {
        if (!cancelled) setPatientCode(code);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [codeParam, sessionParam]);

  if (!patientCode) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("submitting");
    try {
      const result = await sendPatientMessage(patientCode!, sessionParam ?? null, message.trim());
      if (!result.ok) throw new Error(result.error);
      setStatus("sent");
      setMessage("");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (err) {
      console.error(err);
      alert("전송 중 오류가 발생했습니다. 다시 시도해 주세요.");
      setStatus("open");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setStatus("open")}
        aria-label="의료진에게 문의하기"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-lg flex items-center justify-center transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8-1.06 0-2.077-.16-3.02-.457L3 21l1.457-4.98A7.94 7.94 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      </button>

      {status !== "idle" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            {status === "sent" ? (
              <div className="text-center space-y-2 py-4">
                <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-800">의료진에게 안전하게 전달되었습니다.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">의료진에게 문의하기</h2>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="text-gray-400 hover:text-gray-600"
                    aria-label="닫기"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  설문과 별개로 궁금한 점이나 전달하고 싶은 내용을 자유롭게 남겨주세요.
                </p>
                <textarea
                  autoFocus
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="예) 오늘부터 손발이 저려서 걷기가 힘들어요."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-y"
                />
                <button
                  type="submit"
                  disabled={status === "submitting" || !message.trim()}
                  className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold rounded-xl transition-colors"
                >
                  {status === "submitting" ? "전송 중..." : "보내기"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
