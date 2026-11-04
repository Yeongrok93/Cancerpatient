"use client";

// 삶의 질(QLQ-C30): Composite Grade / 전체 문항 보기와 같은 구성.
//  - 영역 점수: 척도별 0–100점을 색 칩으로 (기능·건강상태는 낮을수록, 증상은 높을수록 나쁨)
//  - 전체 문항: 1~30번 응답 값을 색 칩으로
// 조회 전용.

import { useEffect, useMemo, useState } from "react";
import { adminGetQlq, type QlqDashboard } from "@/lib/adminActions";
import { FOUR_POINT_LABELS, QLQ_QUESTIONS } from "@/lib/qlq-c30";
import { QLQ_SCALES, qlqBadness, qlqScaleScore } from "@/lib/qlqScoring";
import { GRADE_COLORS } from "@/lib/proctcaeGrading";

type SubView = "scores" | "items";

function shortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
}

/** Baseline first, then 12 weeks after each. */
function weekName(i: number): string {
  return i === 0 ? "Baseline" : `${i * 12}주`;
}

/** 0 (good) – 3 (bad) for one raw answer: 1–4 scale (higher = worse), 29·30 on 1–7 (higher = better). */
function itemBadness(no: number, v: number): 0 | 1 | 2 | 3 {
  const q = QLQ_QUESTIONS.find((x) => x.no === no);
  if (q?.scale === "seven") return v >= 6 ? 0 : v === 5 ? 1 : v === 4 ? 2 : 3;
  return Math.min(3, Math.max(0, v - 1)) as 0 | 1 | 2 | 3;
}

export default function QlqEditor({ code }: { code: string }) {
  const [data, setData] = useState<QlqDashboard>({ sessions: [], answers: [] });
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<SubView>("scores");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminGetQlq(code)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const byKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of data.answers) m.set(`${a.session_id}|${a.question_no}`, a.answer_value);
    return m;
  }, [data.answers]);

  const bySession = useMemo(() => {
    const m = new Map<string, Map<number, number>>();
    for (const a of data.answers) {
      if (!m.has(a.session_id)) m.set(a.session_id, new Map());
      m.get(a.session_id)!.set(a.question_no, a.answer_value);
    }
    return m;
  }, [data.answers]);

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>;
  if (data.sessions.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">완료된 QLQ-C30 설문이 없습니다.</div>;

  const weekHeader = (s: QlqDashboard["sessions"][number], i: number) => (
    <th key={s.id} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap min-w-[72px]">
      {weekName(i)}
      <br />
      <span className="font-normal text-gray-400">{shortDate(s.completed_at)}</span>
    </th>
  );

  return (
    <div>
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex bg-gray-100 rounded-full p-1 text-xs font-medium" role="tablist" aria-label="QLQ 보기">
          {([
            ["scores", "영역 점수"],
            ["items", "전체 문항 (30)"],
          ] as [SubView, string][]).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={sub === k}
              onClick={() => setSub(k)}
              className={`px-4 py-1.5 rounded-full ${sub === k ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 py-2.5 border-b border-gray-100 text-xs text-gray-500">
        {sub === "items"
          ? "1~28번은 1(전혀 아니다)~4(매우), 29·30번은 1(매우 나쁨)~7(아주 좋음)이에요. 색은 나쁜 정도예요."
          : "0~100점. 기능척도·전반적 건강상태는 높을수록 좋고, 증상척도는 높을수록 증상이 심해요. 색은 나쁜 정도예요."}
      </div>

      <div className="overflow-x-auto">
        {sub === "scores" ? (
          <table className="text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 w-[132px] min-w-[132px]">구분</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 sticky left-[132px] bg-gray-50 z-10 min-w-[190px]">척도</th>
                {data.sessions.map(weekHeader)}
              </tr>
            </thead>
            <tbody>
              {QLQ_SCALES.map((scale, idx) => {
                const first = idx === 0 || QLQ_SCALES[idx - 1].group !== scale.group;
                const span = QLQ_SCALES.filter((x) => x.group === scale.group).length;
                return (
                  <tr key={scale.key} className={`hover:bg-gray-50 border-gray-100 ${first ? "border-t-2 border-gray-200" : "border-t"}`}>
                    {first && (
                      <td rowSpan={span} className="px-4 py-2 align-top text-sm font-semibold text-gray-900 sticky left-0 bg-white z-10 border-r border-gray-100 whitespace-nowrap">
                        {scale.group}
                      </td>
                    )}
                    <td className="px-4 py-2 text-gray-900 font-medium sticky left-[132px] bg-white z-10 whitespace-nowrap" title={`문항 ${scale.items.join(", ")}`}>
                      {scale.label}
                    </td>
                    {data.sessions.map((s) => {
                      const score = qlqScaleScore(scale, bySession.get(s.id) ?? new Map());
                      return (
                        <td key={s.id} className="px-2 py-2 text-center">
                          <span
                            title={score === null ? "응답이 부족해 계산할 수 없어요" : `${scale.label} ${score}점`}
                            className={`inline-flex min-w-11 h-9 px-1.5 items-center justify-center rounded-lg text-sm font-bold cursor-default ${
                              score === null ? "bg-gray-50 text-gray-300" : GRADE_COLORS[qlqBadness(scale, score)]
                            }`}
                          >
                            {score === null ? "—" : Math.round(score)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <table className="text-sm border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[280px]">문항</th>
                {data.sessions.map(weekHeader)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {QLQ_QUESTIONS.map((q) => {
                const max = q.scale === "seven" ? 7 : 4;
                return (
                  <tr key={q.no} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 sticky left-0 bg-white z-10 text-sm text-gray-900 max-w-[360px]" title={q.text}>
                      <span className="text-gray-500 mr-1.5">{q.no}.</span>
                      <span className="line-clamp-1">{q.text}</span>
                    </td>
                    {data.sessions.map((s) => {
                      const v = byKey.get(`${s.id}|${q.no}`);
                      const label = v === undefined ? "응답 없음" : q.scale === "seven" ? `${v} / 7` : `${v} - ${FOUR_POINT_LABELS[v - 1]}`;
                      return (
                        <td key={s.id} className="px-2 py-1.5 text-center">
                          <span
                            title={label}
                            className={`inline-flex min-w-9 h-8 px-1.5 items-center justify-center rounded-lg text-xs font-bold cursor-default ${
                              v === undefined ? "bg-gray-50 text-gray-300" : GRADE_COLORS[itemBadness(q.no, v)]
                            }`}
                          >
                            {v ?? "—"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
