"use client";

// 치료 기록 (연구자 입력, EMR 보고 기재): 항암·방사선·수술·기타.
// 항암 기록의 시작일은 진료용 PDF의 "항암일"로도 쓰여요 (연구자 입력 항암일, 환자 보고 마지막 투여일과 함께).

import { useEffect, useState } from "react";
import {
  adminDeleteTreatment,
  adminListTreatments,
  adminSaveTreatment,
  type Treatment,
  type TreatmentInput,
  type TreatmentKind,
} from "@/lib/adminActions";

const KINDS: { value: TreatmentKind; label: string; chip: string; detailHint: string }[] = [
  { value: "chemo", label: "항암", chip: "bg-violet-50 border-violet-200 text-violet-900", detailHint: "약제·회차 (예: T-DXd 3주기)" },
  { value: "radiation", label: "방사선", chip: "bg-sky-50 border-sky-200 text-sky-900", detailHint: "부위·선량 (예: 유방 50Gy/25fx)" },
  { value: "surgery", label: "수술", chip: "bg-amber-50 border-amber-200 text-amber-900", detailHint: "수술명" },
  { value: "other", label: "기타", chip: "bg-gray-50 border-gray-200 text-gray-800", detailHint: "내용" },
];
const kindOf = (k: string) => KINDS.find((x) => x.value === k) ?? KINDS[3];

const inputCls = "h-9 px-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white";
const EMPTY: TreatmentInput = { kind: "chemo", start_date: "", end_date: "", detail: "", memo: "" };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
function dateLabel(d: string | null): string {
  if (!d) return "";
  const wd = WEEKDAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];
  return `${d.replace(/-/g, ".")} (${wd})`;
}

export default function TreatmentLog({ code }: { code: string }) {
  const [list, setList] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<TreatmentInput>(EMPTY);
  const [editingId, setEditingId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState<TreatmentKind | "all">("all");

  useEffect(() => {
    let cancelled = false;
    adminListTreatments(code)
      .then((l) => {
        if (!cancelled) setList(l);
      })
      .catch(() => {
        if (!cancelled) setMsg("불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  function startEdit(t: Treatment) {
    setEditingId(t.id);
    setDraft({ kind: t.kind, start_date: t.start_date, end_date: t.end_date ?? "", detail: t.detail, memo: t.memo });
    setMsg("");
  }

  function reset() {
    setEditingId("");
    setDraft(EMPTY);
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    const res = await adminSaveTreatment(code, editingId, draft).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setList(res.list);
    setMsg(editingId ? "수정했어요." : "추가했어요.");
    reset();
  }

  async function remove(t: Treatment) {
    if (!window.confirm(`${kindOf(t.kind).label} ${dateLabel(t.start_date)} 기록을 지울까요?`)) return;
    setBusy(true);
    const res = await adminDeleteTreatment(code, t.id).catch(() => ({ ok: false as const, error: "삭제에 실패했습니다." }));
    setBusy(false);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setList(res.list);
    if (editingId === t.id) reset();
  }

  const shown = filter === "all" ? list : list.filter((t) => t.kind === filter);
  const hint = kindOf(draft.kind).detailHint;

  return (
    <div className="p-5 space-y-6">
      <section className="space-y-3 max-w-4xl">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">{editingId ? "치료 기록 수정" : "치료 기록 추가"}</h2>
          <span className="text-xs text-gray-500">EMR 보고 입력 · 항암 기록은 진료용 PDF의 항암일로도 쓰여요</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[8rem_10rem_10rem_1fr] gap-2 items-end">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">종류</span>
            <select className={`${inputCls} w-full`} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">{draft.kind === "chemo" ? "투여일" : "시작일"}</span>
            <input type="date" className={`${inputCls} w-full`} value={draft.start_date} onChange={(e) => setDraft({ ...draft, start_date: e.target.value })} />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">종료일 (선택)</span>
            <input
              type="date"
              className={`${inputCls} w-full`}
              value={draft.end_date}
              min={draft.start_date || undefined}
              onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-gray-600">상세</span>
            <input
              className={`${inputCls} w-full`}
              value={draft.detail}
              maxLength={200}
              placeholder={hint}
              onChange={(e) => setDraft({ ...draft, detail: e.target.value })}
            />
          </label>
          <label className="block space-y-1 sm:col-span-4">
            <span className="text-xs font-medium text-gray-600">메모 (선택)</span>
            <input
              className={`${inputCls} w-full`}
              value={draft.memo}
              maxLength={500}
              placeholder="예: 용량 감량, 연기 사유 등"
              onChange={(e) => setDraft({ ...draft, memo: e.target.value })}
            />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy || !draft.start_date}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            {busy ? "저장 중..." : editingId ? "수정 저장" : "추가"}
          </button>
          {editingId && (
            <button onClick={reset} className="px-3 py-2 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">
              취소
            </button>
          )}
          <span className="text-xs text-gray-600">{msg}</span>
        </div>
      </section>

      <section className="space-y-3 max-w-4xl">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-gray-900">기록 ({list.length})</h2>
          {(["all", ...KINDS.map((k) => k.value)] as const).map((f) => {
            const n = f === "all" ? list.length : list.filter((t) => t.kind === f).length;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-full text-xs border ${
                  filter === f ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                }`}
              >
                {f === "all" ? "전체" : kindOf(f).label} {n}
              </button>
            );
          })}
        </div>
        {loading ? (
          <p className="text-sm text-gray-400">불러오는 중...</p>
        ) : shown.length === 0 ? (
          <p className="text-sm text-gray-400">기록이 없습니다.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">종류</th>
                <th className="px-3 py-2 text-left font-medium">날짜</th>
                <th className="px-3 py-2 text-left font-medium">상세</th>
                <th className="px-3 py-2 text-left font-medium">메모</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((t) => {
                const k = kindOf(t.kind);
                return (
                  <tr key={t.id} className={editingId === t.id ? "bg-amber-50" : "hover:bg-gray-50"}>
                    <td className="px-3 py-2">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg border text-xs font-medium ${k.chip}`}>{k.label}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                      {dateLabel(t.start_date)}
                      {t.end_date && t.end_date !== t.start_date && <span className="text-gray-500"> ~ {dateLabel(t.end_date)}</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-900">{t.detail || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-2 text-gray-600 text-xs">{t.memo}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-right">
                      <button onClick={() => startEdit(t)} disabled={busy} className="text-xs text-gray-500 hover:text-gray-900 mr-3">
                        수정
                      </button>
                      <button onClick={() => remove(t)} disabled={busy} className="text-xs text-red-500 hover:text-red-700">
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
