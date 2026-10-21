// Server-only: the researcher-notes summary printed on the clinic hand-out.
//
// Reproducibility: a summary is stored in `note_summaries`, keyed by a hash of the notes it
// was written from (+ the prompt version). The same notes therefore always print the same
// summary, no matter how often the report is regenerated. If the notes change, the old summary
// no longer matches and a new one has to be made — by the API (ANTHROPIC_API_KEY set) or by
// hand with `npm run save-summary` (source = 'manual').
//
// Privacy: with an API key, note text is sent to Anthropic. Check that this is covered by the
// study's consent / data-handling approval before enabling it in production.

import { createHash } from "crypto";
import { sql } from "./db";

/** Bump when SYSTEM_PROMPT changes, so old summaries are not mistaken for the new prompt's. */
export const PROMPT_VERSION = "2026-10-21.2";
export type SummaryLang = "ko" | "en";
/** Korean keeps the original version string (existing rows stay valid); English gets its own. */
export const promptVersionFor = (lang: SummaryLang) => (lang === "en" ? `${PROMPT_VERSION}-en` : PROMPT_VERSION);
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export type NoteInput = { note_date: string; body: string };

export type NotesSummary =
  | { kind: "none" } // there are no notes
  | { kind: "summary"; text: string; model: string; source: "api" | "manual"; createdAt: string }
  | { kind: "unavailable"; reason: string }
  | { kind: "sample"; text: string }; // local layout preview only

const MAX_INPUT_CHARS = 15_000;

export const SYSTEM_PROMPT = `당신은 암 환자 연구의 연구자 노트를 진료용으로 요약하는 보조자입니다.
환자가 담당 의사에게 보여 줄 한 장짜리 자료에 들어갈 요약을 작성합니다.

규칙:
- 노트에 적힌 내용만 사용합니다. 추측하거나 진단·치료 권고를 덧붙이지 않습니다.
- 한국어, 간결한 임상 어투. 최대 7줄. 각 줄은 "- "로 시작하는 한 문장 또는 짧은 구절이며, 한 줄은 한글 80자 안팎을 넘기지 않습니다.
- 날짜가 중요하면 (M/D)로 짧게 표시합니다. 상담한 사람의 이름은 쓰지 않고 "연구 간호사", "수간호사"처럼 역할로만 씁니다.
- 환자의 안전과 관련된 내용(자해·자살 생각, 급격한 악화, 응급 상황 등)은 완화하지 말고 첫 줄에 분명히 씁니다.
- 순서: 안전 관련 → 정서·증상 변화 → 치료에 대한 인식 → 진료·돌봄 접근의 어려움 → 환자가 원하는 것 → 이미 제공된 상담·설명과 환자의 반응.
- 마크다운 제목, 굵은 글씨, 번호 목록은 쓰지 않습니다.`;

export const SYSTEM_PROMPT_EN = `You summarize researcher notes from a cancer-patient research study for a clinic hand-out.
The patient will carry this one-page document to their physician.

Rules:
- Use only what the notes say. Do not speculate and do not add diagnoses or treatment advice.
- English, concise clinical tone. At most 7 lines; each line starts with "- " and is one sentence or short phrase of roughly 20 words or fewer.
- Add dates as (M/D) when they matter. Do not name staff members; use roles such as "research nurse" or "head nurse".
- Safety-related content (suicidal thoughts or self-harm, rapid deterioration, emergencies) must not be softened and goes on the first line.
- Order: safety → emotional state and symptom changes → views about treatment → difficulties accessing care → what the patient wants → counselling already provided and the patient's response.
- No markdown headings, bold text or numbered lists.`;

/** Stable fingerprint of a patient's notes (order-independent, whitespace at the ends ignored). */
export function notesHash(notes: NoteInput[]): string {
  const canon = notes
    .map((n) => `${n.note_date}\n${n.body.trim()}`)
    .sort()
    .join("\n\u0000\n");
  return createHash("sha256").update(canon).digest("hex");
}

export async function saveNotesSummary(
  code: string,
  notes: NoteInput[],
  text: string,
  meta: { model: string; source: "api" | "manual"; lang?: SummaryLang }
): Promise<void> {
  await sql`
    INSERT INTO note_summaries (patient_code, notes_hash, summary, model, source, prompt_version)
    VALUES (${code}, ${notesHash(notes)}, ${text.trim()}, ${meta.model}, ${meta.source}, ${promptVersionFor(meta.lang ?? "ko")})
    ON CONFLICT (patient_code, notes_hash, prompt_version)
    DO UPDATE SET summary = EXCLUDED.summary, model = EXCLUDED.model, source = EXCLUDED.source, created_at = NOW()
  `;
}

export async function getNotesSummary(code: string, notes: NoteInput[], lang: SummaryLang = "ko"): Promise<NotesSummary> {
  if (notes.length === 0) return { kind: "none" };

  const hash = notesHash(notes);
  const [stored] = await sql`
    SELECT summary, model, source, created_at FROM note_summaries
    WHERE patient_code = ${code} AND notes_hash = ${hash} AND prompt_version = ${promptVersionFor(lang)}
  `;
  if (stored) {
    return {
      kind: "summary",
      text: String(stored.summary),
      model: String(stored.model),
      source: stored.source === "manual" ? "manual" : "api",
      createdAt: (stored.created_at instanceof Date ? stored.created_at : new Date(stored.created_at)).toISOString(),
    };
  }

  const generated = await generateWithApi(notes, lang);
  if (generated.ok) {
    await saveNotesSummary(code, notes, generated.text, { model: generated.model, source: "api", lang });
    return { kind: "summary", text: generated.text, model: generated.model, source: "api", createdAt: new Date().toISOString() };
  }
  return { kind: "unavailable", reason: generated.reason };
}

async function generateWithApi(
  notes: NoteInput[],
  lang: SummaryLang
): Promise<{ ok: true; text: string; model: string } | { ok: false; reason: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "이 노트에 대한 요약이 아직 없습니다 (ANTHROPIC_API_KEY 미설정). 요약을 만들어 저장하면 표시됩니다." };
  }

  // Newest first, trimmed to a safe size.
  let used = 0;
  const parts: string[] = [];
  for (const n of [...notes].sort((a, b) => b.note_date.localeCompare(a.note_date))) {
    const chunk = `[${n.note_date}]\n${n.body.trim()}`;
    if (used + chunk.length > MAX_INPUT_CHARS) break;
    parts.push(chunk);
    used += chunk.length;
  }

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 1200,
        temperature: 0,
        system: lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT,
        messages: [{ role: "user", content: `${lang === "en" ? "Summarize the following researcher notes (they may be in Korean; write the summary in English)." : "다음 연구자 노트를 요약해 주세요."}\n\n${parts.join("\n\n---\n\n")}` }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.error?.message ? String(body.error.message).slice(0, 200) : `HTTP ${res.status}`;
      return { ok: false, reason: `요약 생성에 실패했습니다 (${msg}).` };
    }
    const text = Array.isArray(body?.content)
      ? body.content.filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim()
      : "";
    if (!text) return { ok: false, reason: "요약 결과가 비어 있습니다." };
    return { ok: true, text, model };
  } catch (err) {
    console.error("Notes summary failed:", err);
    return { ok: false, reason: "요약 생성 중 오류가 발생했습니다." };
  }
}
