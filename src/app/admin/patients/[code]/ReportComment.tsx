"use client";

// 진료용 PDF 코멘트 (연구자 입력): one short line printed at the end of the PDF summary.

import { useEffect, useState } from "react";
import { adminGetReportComment, adminSaveReportComment } from "@/lib/adminActions";

export default function ReportComment({ code }: { code: string }) {
  const [saved, setSaved] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminGetReportComment(code)
      .then((c) => {
        if (cancelled) return;
        setSaved(c);
        setDraft(c);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function save() {
    setBusy(true);
    setMsg("");
    const res = await adminSaveReportComment(code, draft).catch(() => ({ ok: false as const, error: "저장에 실패했습니다." }));
    setBusy(false);
    if (res.ok) {
      setSaved(draft.trim());
      setMsg("저장됨");
    } else setMsg(res.error);
  }

  const dirty = draft.trim() !== saved;
  return (
    <div className="flex items-center gap-2 flex-wrap text-xs">
      <span className="font-semibold text-gray-700" title="진료용 PDF 맨 아래 요약에 한 줄로 들어가요. 비우면 빠져요.">
        PDF 코멘트
      </span>
      <input
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setMsg("");
        }}
        maxLength={300}
        placeholder="예: 11/2 주 설문은 증상부담이 심해 작성하지 못함"
        className="flex-1 min-w-[16rem] border border-gray-300 rounded-lg px-2 py-1 text-xs"
      />
      <button
        onClick={save}
        disabled={busy || !dirty}
        className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-gray-800 disabled:opacity-40"
      >
        저장
      </button>
      {msg && <span className={msg === "저장됨" ? "text-green-700" : "text-red-600"}>{msg}</span>}
    </div>
  );
}
