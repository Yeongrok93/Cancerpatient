// Server-only: summarises nursing notes for the clinic hand-out with Claude.
// Needs ANTHROPIC_API_KEY (optional ANTHROPIC_MODEL). Without a key the report
// simply says the summary is unavailable — nothing else depends on it.
//
// Privacy: the note text is sent to Anthropic's API. Check that this is covered by the
// study's consent / data-handling approval before enabling the key in production.

export type NoteInput = { note_date: string; body: string };

export type NotesSummary =
  | { kind: "none" } // there are no notes
  | { kind: "summary"; text: string }
  | { kind: "unavailable"; reason: string }
  | { kind: "sample"; text: string }; // local layout preview only

const MAX_INPUT_CHARS = 15_000;

const SYSTEM_PROMPT = `당신은 암 환자 연구의 간호 노트를 진료용으로 요약하는 보조자입니다.
환자가 담당 의사에게 보여 줄 한 장짜리 자료에 들어갈 요약을 작성합니다.

규칙:
- 노트에 적힌 내용만 사용합니다. 추측하거나 진단·치료 권고를 덧붙이지 않습니다.
- 한국어, 간결한 임상 어투. 최대 8줄. 각 줄은 "- "로 시작하는 한 문장 또는 짧은 구절입니다.
- 최신 노트의 내용을 먼저 씁니다. 날짜가 중요하면 (M/D)로 짧게 표시합니다.
- 환자의 안전과 관련된 내용(자해·자살 생각, 급격한 악화, 응급 상황 등)은 완화하지 말고 첫 줄에 분명히 씁니다.
- 증상, 정서 상태, 진료·돌봄 접근의 어려움, 환자가 원하는 것을 구분해서 담습니다.
- 마크다운 제목, 굵은 글씨, 번호 목록은 쓰지 않습니다.`;

export async function summarizeNotes(notes: NoteInput[]): Promise<NotesSummary> {
  if (notes.length === 0) return { kind: "none" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { kind: "unavailable", reason: "ANTHROPIC_API_KEY가 설정되지 않아 요약을 만들지 못했습니다." };

  // Newest first, trimmed to a safe size.
  let used = 0;
  const parts: string[] = [];
  for (const n of [...notes].sort((a, b) => b.note_date.localeCompare(a.note_date))) {
    const chunk = `[${n.note_date}]\n${n.body.trim()}`;
    if (used + chunk.length > MAX_INPUT_CHARS) break;
    parts.push(chunk);
    used += chunk.length;
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 1200,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: `다음 간호 노트를 요약해 주세요.\n\n${parts.join("\n\n---\n\n")}` }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.error?.message ? String(body.error.message).slice(0, 200) : `HTTP ${res.status}`;
      return { kind: "unavailable", reason: `요약 생성에 실패했습니다 (${msg}).` };
    }
    const text = Array.isArray(body?.content)
      ? body.content.filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text ?? "").join("\n").trim()
      : "";
    if (!text) return { kind: "unavailable", reason: "요약 결과가 비어 있습니다." };
    return { kind: "summary", text };
  } catch (err) {
    console.error("Notes summary failed:", err);
    return { kind: "unavailable", reason: "요약 생성 중 오류가 발생했습니다." };
  }
}
