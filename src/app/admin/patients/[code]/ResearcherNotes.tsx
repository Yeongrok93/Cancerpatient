"use client";

import { useState } from "react";
import { adminAddNote, adminUpdateNote, adminDeleteNote, type ResearcherNote } from "@/lib/adminActions";
import { NOTE_KINDS, NOTE_KIND_BY_KEY, type NoteKind } from "@/lib/noteKinds";
import { kstToday } from "@/lib/surveySchedule";

export function sortNotes(notes: ResearcherNote[]): ResearcherNote[] {
  return [...notes].sort((a, b) => b.note_date.localeCompare(a.note_date) || b.created_at.localeCompare(a.created_at));
}

function formatNoteDate(date: string): string {
  const weekday = new Date(`${date}T00:00:00+09:00`).toLocaleDateString("ko-KR", {
    weekday: "short",
    timeZone: "Asia/Seoul",
  });
  return `${date.replace(/-/g, ".")} (${weekday})`;
}

function wasEdited(n: ResearcherNote): boolean {
  return new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 2000;
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const QUICK_KINDS: NoteKind[] = ["call", "missed", "sms"];

function KindBadge({ kind }: { kind: NoteKind }) {
  const info = NOTE_KIND_BY_KEY[kind];
  return <span className={`inline-block px-2 py-0.5 rounded-full border text-xs font-semibold ${info.chip}`}>{info.label}</span>;
}

/** 통화 · 부재중 · 문자 counts and how long ago the last contact was. */
function ContactSummary({ notes }: { notes: ResearcherNote[] }) {
  const contacts = notes.filter((n) => NOTE_KIND_BY_KEY[n.kind].contact);
  if (contacts.length === 0) return null;
  const count = (k: NoteKind) => notes.filter((n) => n.kind === k).length;
  const last = contacts.map((n) => n.note_date).sort().at(-1)!;
  const ago = daysBetween(last, kstToday());
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-800">
      <span className="font-semibold">연락 기록</span>
      <span>통화 {count("call")}회</span>
      <span>부재중 {count("missed")}회</span>
      <span>문자 {count("sms")}회</span>
      <span className="text-gray-600">
        마지막 연락 {formatNoteDate(last)} · {ago <= 0 ? "오늘" : `${ago}일 전`}
      </span>
    </div>
  );
}

export default function ResearcherNotes({
  code,
  notes,
  setNotes,
  loading,
}: {
  code: string;
  notes: ResearcherNote[];
  setNotes: (updater: (prev: ResearcherNote[]) => ResearcherNote[]) => void;
  loading: boolean;
}) {
  const [error, setError] = useState("");

  const [draftDate, setDraftDate] = useState(kstToday());
  const [draftKind, setDraftKind] = useState<NoteKind>("note");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editKind, setEditKind] = useState<NoteKind>("note");
  const [editBody, setEditBody] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const draftInfo = NOTE_KIND_BY_KEY[draftKind];
  const canSave = !!draftDate && (draftInfo.contact || !!draftBody.trim());

  async function add(kind: NoteKind, date: string, body: string) {
    if (saving) return;
    setSaving(true);
    setError("");
    const res = await adminAddNote(code, date, body, kind).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setNotes((prev) => sortNotes([res.note, ...prev]));
    setDraftBody("");
    setDraftDate(kstToday());
  }

  function startEdit(n: ResearcherNote) {
    setEditingId(n.id);
    setEditDate(n.note_date);
    setEditKind(n.kind);
    setEditBody(n.body);
    setError("");
  }

  async function saveEdit(id: string) {
    if (busyId) return;
    setBusyId(id);
    setError("");
    const res = await adminUpdateNote(id, editDate, editBody, editKind).catch(() => ({ ok: false as const, error: "수정에 실패했습니다." }));
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
      <ContactSummary notes={notes} />

      {/* 새 기록 */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        {/* 한 번에 기록: 오늘 날짜로 바로 저장 (아래 입력란에 내용이 있으면 함께 저장) */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 mr-1">빠른 기록 (오늘)</span>
          {QUICK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              disabled={saving}
              onClick={() => add(k, kstToday(), draftBody)}
              className={`px-3 py-1.5 rounded-lg border text-sm font-semibold hover:brightness-95 disabled:opacity-50 ${NOTE_KIND_BY_KEY[k].chip}`}
            >
              + {NOTE_KIND_BY_KEY[k].label}
            </button>
          ))}
          <span className="text-xs text-gray-500">누르면 바로 저장돼요. 내용을 적어 두었으면 함께 저장돼요.</span>
        </div>

        <div className="border-t border-gray-100 pt-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap" role="radiogroup" aria-label="기록 종류">
            {NOTE_KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                role="radio"
                aria-checked={draftKind === k.key}
                onClick={() => setDraftKind(k.key)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-semibold ${k.chip} ${
                  draftKind === k.key ? "ring-2 ring-gray-900" : "opacity-70 hover:opacity-100"
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
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
              if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && canSave) add(draftKind, draftDate, draftBody);
            }}
            rows={4}
            placeholder={`${draftInfo.hint} (Ctrl+Enter로 저장)`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary-400"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">{error}</p>
            <button
              onClick={() => add(draftKind, draftDate, draftBody)}
              disabled={!canSave || saving}
              className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
            >
              {saving ? "저장 중..." : "기록 저장"}
            </button>
          </div>
        </div>
      </div>

      {/* 노트 목록: 최신순, 스크롤 */}
      {loading ? (
        <p className="text-center text-gray-400 text-sm py-6">불러오는 중...</p>
      ) : notes.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-6">아직 작성된 기록이 없습니다.</p>
      ) : (
        <div className="max-h-[65vh] overflow-y-auto space-y-3 pr-1">
          {notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-gray-200 p-4 space-y-2">
              {editingId === n.id ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="h-9 px-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                    />
                    <select
                      value={editKind}
                      onChange={(e) => setEditKind(e.target.value as NoteKind)}
                      aria-label="기록 종류"
                      className="h-9 px-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white"
                    >
                      {NOTE_KINDS.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                  </div>
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
                      disabled={!editDate || (!NOTE_KIND_BY_KEY[editKind].contact && !editBody.trim()) || busyId === n.id}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black disabled:bg-gray-200 disabled:text-gray-400"
                    >
                      {busyId === n.id ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      {formatNoteDate(n.note_date)}
                      <KindBadge kind={n.kind} />
                      {wasEdited(n) && <span className="text-xs font-normal text-gray-500">(수정됨)</span>}
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
                  {n.body && <p className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap break-words">{n.body}</p>}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
