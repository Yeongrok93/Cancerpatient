"use client";

import { useEffect, useState } from "react";
import {
  adminListNotes,
  adminAddNote,
  adminUpdateNote,
  adminDeleteNote,
  type NursingNote,
} from "@/lib/adminActions";
import { kstToday } from "@/lib/surveySchedule";

function sortNotes(notes: NursingNote[]): NursingNote[] {
  return [...notes].sort((a, b) => b.note_date.localeCompare(a.note_date) || b.created_at.localeCompare(a.created_at));
}

function formatNoteDate(date: string): string {
  const weekday = new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  return `${date.replace(/-/g, ".")} (${weekday})`;
}

function wasEdited(n: NursingNote): boolean {
  return new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 2000;
}

export default function NursingNotes({ code }: { code: string }) {
  const [notes, setNotes] = useState<NursingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [draftDate, setDraftDate] = useState(kstToday());
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editBody, setEditBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEditingId(null);
    adminListNotes(code)
      .then((data) => {
        if (!cancelled) setNotes(sortNotes(data));
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("노트를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function add() {
    if (!draftBody.trim() || saving) return;
    setSaving(true);
    setError("");
    const res = await adminAddNote(code, draftDate, draftBody).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotes((prev) => sortNotes([res.note, ...prev]));
    setDraftBody("");
    setDraftDate(kstToday());
  }

  function startEdit(n: NursingNote) {
    setEditingId(n.id);
    setEditDate(n.note_date);
    setEditBody(n.body);
    setError("");
  }

  async function saveEdit(id: string) {
    if (!editBody.trim() || busyId) return;
    setBusyId(id);
    setError("");
    const res = await adminUpdateNote(id, editDate, editBody).catch(() => ({ ok: false as const, error: "수정에 실패했습니다." }));
    setBusyId(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotes((prev) => sortNotes(prev.map((n) => (n.id === id ? res.note : n))));
    setEditingId(null);
  }

  async function remove(id: string) {
    if (!window.confirm("이 노트를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setBusyId(id);
    const res = await adminDeleteNote(id).catch(() => ({ ok: false }));
    setBusyId(null);
    if (!res.ok) {
      setError("삭제에 실패했습니다.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <div className="p-5 space-y-5">
      {/* 새 노트 */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-sm font-medium text-gray-900" htmlFor="note-date">
            날짜
          </label>
          <input
            id="note-date"
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
            className="h-9 px-2 border border-gray-300 rounded-lg text-sm text-gray-900"
          />
        </div>
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") add();
          }}
          rows={4}
          placeholder="노트를 자유롭게 작성하세요. (Ctrl+Enter로 저장)"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary-400"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-gray-500">{error}</p>
          <button
            onClick={add}
            disabled={!draftBody.trim() || !draftDate || saving}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
          >
            {saving ? "저장 중..." : "노트 저장"}
          </button>
        </div>
      </div>

      {/* 노트 목록: 최신순, 스크롤 */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-6">불러오는 중...</p>
      ) : notes.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">아직 작성된 노트가 없습니다.</p>
      ) : (
        <div className="max-h-[65vh] overflow-y-auto space-y-3 pr-1">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
              {editingId === n.id ? (
                <>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="h-9 px-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                  />
                  <textarea
                    autoFocus
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") saveEdit(n.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => saveEdit(n.id)}
                      disabled={!editBody.trim() || !editDate || busyId === n.id}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {busyId === n.id ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900">
                      {formatNoteDate(n.note_date)}
                      {wasEdited(n) && <span className="ml-2 text-xs font-normal text-gray-500">(수정됨)</span>}
                    </p>
                    <div className="flex items-center gap-3 text-xs">
                      <button onClick={() => startEdit(n)} className="text-gray-700 hover:text-black font-medium">
                        수정
                      </button>
                      <button
                        onClick={() => remove(n.id)}
                        disabled={busyId === n.id}
                        className="text-gray-500 hover:text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap break-words">{n.body}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
