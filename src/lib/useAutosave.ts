"use client";

// Saves `value` a moment after it stops changing, one request at a time and in order, and once more
// as the page is hidden or closed. The value present when `enabled` first turns true (what was just
// loaded) is not saved again — only later changes are.

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

function failed(result: unknown): boolean {
  return !!result && typeof result === "object" && "ok" in result && (result as { ok: unknown }).ok === false;
}

export function useAutosave<T>(value: T, enabled: boolean, save: (value: T) => Promise<unknown>, delay = 600): SaveStatus {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const saveRef = useRef(save);
  const latest = useRef(value);
  const prev = useRef(value);
  const armed = useRef(false);
  const pending = useRef(false);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const flushRef = useRef<() => void>(() => {});

  useEffect(() => {
    saveRef.current = save;
    flushRef.current = () => {
      if (!pending.current) return;
      pending.current = false;
      const v = latest.current;
      setStatus("saving");
      chain.current = chain.current
        .catch(() => undefined)
        .then(() => saveRef.current(v))
        .then((r) => setStatus(failed(r) ? "error" : "saved"))
        .catch(() => setStatus("error"));
    };
  });

  useEffect(() => {
    if (!enabled) {
      armed.current = false;
      return;
    }
    if (!armed.current) {
      armed.current = true;
      prev.current = value;
      return;
    }
    if (Object.is(prev.current, value)) return;
    prev.current = value;
    latest.current = value;
    pending.current = true;
    const t = setTimeout(() => flushRef.current(), delay);
    return () => clearTimeout(t);
  }, [value, enabled, delay]);

  useEffect(() => {
    const flush = () => flushRef.current();
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  return status;
}

export function saveStatusText(status: SaveStatus): string {
  if (status === "saving") return "저장 중…";
  if (status === "error") return "⚠ 저장되지 않았어요. 인터넷 연결을 확인해 주세요.";
  return "✓ 답을 고르면 자동으로 저장돼요. 중간에 나가도 이어서 할 수 있어요.";
}
