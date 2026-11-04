"use client";

// 삶의 질(QLQ-C30) 응답 조회·수정: 문항 × 완료한 설문, 칸마다 값을 고르면 바로 저장돼요.

import { useEffect, useMemo, useState } from "react";
import { adminGetQlq, adminSetQlqAnswer, adminSetSessionDate, type QlqDashboard } from "@/lib/adminActions";
import { QLQ_QUESTIONS } from "@/lib/qlq-c30";

function ymdKst(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export default function QlqEditor({ code }: { code: string }) {
  const [data, setData] = useState<QlqDashboard>({ sessions: [], answers: [] });
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    adminGetQlq(code)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setMsg("불러오지 못했습니다.");
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

  async function setValue(sessionId: string, no: number, value: number) {
    setMsg("");
    const res = await adminSetQlqAnswer(sessionId, no, value).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg("저장했어요.");
    setData((prev) => ({
      ...prev,
      answers: [
        ...prev.answers.filter((a) => !(a.session_id === sessionId && a.question_no === no)),
        { session_id: sessionId, question_no: no, answer_value: value },
      ],
    }));
  }

  async function setDate(sessionId: string, date: string) {
    if (!date) return;
    setMsg("");
    const res = await adminSetSessionDate(sessionId, date).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg("날짜를 바꿨어요.");
    setData((prev) => ({
      ...prev,
      sessions: prev.sessions.map((s) => {
        if (s.id !== sessionId || !s.completed_at) return s;
        const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(s.completed_at));
        return { ...s, completed_at: new Date(`${date}T${time}+09:00`).toISOString() };
      }),
    }));
  }

  if (loading) return <div className="p-8 text-center text-gray-400 text-sm">불러오는 중...</div>;
  if (data.sessions.length === 0) return <div className="p-8 text-center text-gray-400 text-sm">완료된 QLQ-C30 설문이 없습니다.</div>;

  return (
    <div>
      <div className="px-5 py-2.5 border-b border-gray-100 text-xs text-gray-600">
        {msg || "칸의 값을 바꾸면 바로 저장돼요. 1~28번은 1(전혀 아니다)~4(매우), 29·30번은 1(매우 나쁨)~7(아주 좋음)입니다."}
      </div>
      <div className="overflow-x-auto">
        <table className="text-sm border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2.5 text-left text-xs font-medium text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[260px]">문항</th>
              {data.sessions.map((s, i) => (
                <th key={s.id} className="px-2 py-2.5 text-center text-xs font-medium text-gray-500 whitespace-nowrap">
                  {i === 0 ? "Baseline" : `${i}차`}
                  <br />
                  <input
                    type="date"
                    value={ymdKst(s.completed_at)}
                    onChange={(e) => setDate(s.id, e.target.value)}
                    className="mt-1 h-8 px-1 border border-gray-300 rounded-md text-xs font-normal text-gray-700 bg-white"
                    aria-label="완료 날짜"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {QLQ_QUESTIONS.map((q) => {
              const max = q.scale === "seven" ? 7 : 4;
              return (
                <tr key={q.no} className="hover:bg-gray-50">
                  <td className="px-3 py-1.5 sticky left-0 bg-white z-10 text-sm text-gray-900 max-w-[340px]" title={q.text}>
                    <span className="text-gray-500 mr-1.5">{q.no}.</span>
                    <span className="line-clamp-1">{q.text}</span>
                  </td>
                  {data.sessions.map((s) => {
                    const v = byKey.get(`${s.id}|${q.no}`);
                    return (
                      <td key={s.id} className="px-2 py-1 text-center">
                        <select
                          value={v ?? ""}
                          onChange={(e) => setValue(s.id, q.no, Number(e.target.value))}
                          aria-label={`${q.no}번 응답`}
                          className="h-8 w-16 px-1 border border-gray-300 rounded-md text-sm text-gray-900 bg-white"
                        >
                          {v === undefined && <option value="">—</option>}
                          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
