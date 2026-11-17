"use client";

// 항암일 (연구자 입력). The 진료용 PDF uses the latest 항암일 before the print date to show only that cycle.

import { useEffect, useState } from "react";
import { adminListChemoDates, adminSetChemoDate } from "@/lib/adminActions";
import { kstToday } from "@/lib/surveySchedule";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function label(d: string): string {
  const wd = WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${d.slice(2).replace(/-/g, ".")} (${wd})`;
}

export default function ChemoDates({ code }: { code: string }) {
  const [dates, setDates] = useState<string[]>([]);
  const [draft, setDraft] = useState(kstToday());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminListChemoDates(code)
      .then((d) => {
        if (!cancelled) setDates(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function change(date: string, present: boolean) {
    if (!present && !window.confirm(`${label(date)} 항암일을 지울까요?`)) return;
    setBusy(true);
    setError("");
    const res = await adminSetChemoDate(code, date, present).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    setBusy(false);
    if (res.ok) setDates(res.dates);
    else setError(res.error);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="font-semibold text-gray-700" title="진료용 PDF는 여기 입력한 날짜와 환자가 설문에서 답한 마지막 투여일을 함께 써요.">
        항암일 (연구자 입력)
      </span>
      {dates.length === 0 && <span className="text-gray-400">입력 없음</span>}
      {dates.map((d) => (
        <span key={d} className="inline-flex items-center gap-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-900 px-2 py-1">
          {label(d)}
          <button
            onClick={() => change(d, false)}
            disabled={busy}
            aria-label={`${d} 삭제`}
            className="text-violet-400 hover:text-violet-700 leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="date"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1 text-xs"
      />
      <button
        onClick={() => draft && change(draft, true)}
        disabled={busy || !draft || dates.includes(draft)}
        className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-800 disabled:opacity-40"
      >
        추가
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
