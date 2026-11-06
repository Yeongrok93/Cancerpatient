"use client";

// 다음 외래 달력: 환자들이 증상 설문에서 입력한 다음 외래 일정을 월 달력으로 보여준다.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminListVisits, type AdminPatient, type AdminVisit } from "@/lib/adminActions";
import { patientLabel } from "@/lib/patientLabel";
import { kstToday } from "@/lib/surveySchedule";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function dday(today: string, date: string): string {
  const d = dayDiff(today, date);
  return d === 0 ? "오늘" : d > 0 ? `D-${d}` : `${-d}일 전`;
}

export default function VisitCalendar() {
  const today = kstToday();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [month, setMonth] = useState(Number(today.slice(5, 7))); // 1–12
  const [visits, setVisits] = useState<AdminVisit[]>([]);
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    adminListVisits()
      .then((d) => {
        if (cancelled) return;
        setVisits(d.visits);
        setPatients(d.patients);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const byDate = useMemo(() => {
    const m = new Map<string, AdminVisit[]>();
    for (const v of visits) {
      if (!m.has(v.date)) m.set(v.date, []);
      m.get(v.date)!.push(v);
    }
    return m;
  }, [visits]);

  const upcoming = visits.filter((v) => !v.past);
  const withUpcoming = new Set(upcoming.map((v) => v.patient_code));
  const without = patients.filter((p) => !withUpcoming.has(p.patient_code));

  // Month grid: leading blanks up to the first weekday, then each day.
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function shift(delta: number) {
    const idx = year * 12 + (month - 1) + delta;
    setYear(Math.floor(idx / 12));
    setMonth((idx % 12) + 1);
  }

  if (loading) return <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">불러오는 중...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <button onClick={() => shift(-1)} aria-label="이전 달" className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              ‹
            </button>
            <h2 className="text-base font-bold text-gray-900 min-w-[7rem] text-center">
              {year}년 {month}월
            </h2>
            <button onClick={() => shift(1)} aria-label="다음 달" className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
              ›
            </button>
            <button
              onClick={() => {
                setYear(Number(today.slice(0, 4)));
                setMonth(Number(today.slice(5, 7)));
              }}
              className="ml-1 text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              오늘
            </button>
          </div>
          <p className="text-xs text-gray-500">환자가 증상 설문에서 입력한 다음 외래예요. 이름을 누르면 해당 환자로 이동해요.</p>
        </div>

        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`py-2 text-center text-xs font-medium ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-500"}`}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((d, i) => {
            const date = d ? ymd(year, month, d) : "";
            const list = d ? (byDate.get(date) ?? []) : [];
            const isToday = date === today;
            return (
              <div key={i} className={`min-h-[84px] border-b border-r border-gray-100 p-1.5 ${d ? "bg-white" : "bg-gray-50/60"}`}>
                {d && (
                  <>
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                        isToday ? "bg-gray-900 text-white font-bold" : i % 7 === 0 ? "text-red-500" : i % 7 === 6 ? "text-blue-500" : "text-gray-700"
                      }`}
                    >
                      {d}
                    </span>
                    <div className="mt-1 space-y-1">
                      {list.map((v) => (
                        <Link
                          key={`${v.patient_code}-${v.time}`}
                          href={`/admin/patients/${encodeURIComponent(v.patient_code)}`}
                          title={`${patientLabel(v.patient_code, v.name)} ${v.time}`}
                          className={`block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight ${
                            v.past ? "bg-gray-100 text-gray-500" : "bg-amber-100 text-amber-900 hover:bg-amber-200"
                          }`}
                        >
                          {v.time} {v.name || patientLabel(v.patient_code)}
                        </Link>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-3">다가오는 외래</h3>
          {upcoming.length === 0 ? (
            <p className="text-sm text-gray-400">입력된 다음 외래가 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {upcoming.map((v) => (
                <li key={`${v.patient_code}-${v.date}-${v.time}`} className="flex items-center justify-between gap-3 text-sm">
                  <Link href={`/admin/patients/${encodeURIComponent(v.patient_code)}`} className="font-medium text-gray-900 hover:underline">
                    {patientLabel(v.patient_code, v.name)}
                  </Link>
                  <span className="text-gray-600 whitespace-nowrap">
                    {v.date.slice(5).replace("-", "/")} ({WEEKDAYS[new Date(`${v.date}T00:00:00Z`).getUTCDay()]}) {v.time}
                    <span className="ml-2 text-xs font-semibold text-amber-800">{dday(today, v.date)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">다음 외래 미입력</h3>
          <p className="text-xs text-gray-500 mb-3">입력된 외래가 없거나 이미 지난 환자예요. 다음 증상 설문에서 다시 물어봐요.</p>
          {without.length === 0 ? (
            <p className="text-sm text-gray-400">모든 환자의 다음 외래가 입력돼 있어요.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {without.map((p) => (
                <Link
                  key={p.patient_code}
                  href={`/admin/patients/${encodeURIComponent(p.patient_code)}`}
                  className="text-xs px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {patientLabel(p.patient_code, p.name)}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
