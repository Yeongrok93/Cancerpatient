import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "암증상설문조사",
  description: "NCI PRO-CTCAE™ 한국어 암증상설문조사 — 지난 7일간 치료 관련 증상을 평가합니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-none">NCI PRO-CTCAE™</p>
              <p className="text-sm font-semibold text-gray-800 leading-tight">
                암증상설문조사
              </p>
            </div>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
        <footer className="mt-16 border-t border-gray-200 bg-white">
          <div className="max-w-3xl mx-auto px-4 py-4 text-xs text-gray-400 text-center">
            NCI PRO-CTCAE™ Item Library Version 1.0 — 본 설문은 미국 국립암연구소(NCI)가
            개발한 도구의 한국어 번역판입니다.
          </div>
        </footer>
      </body>
    </html>
  );
}
