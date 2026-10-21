// Stores a hand-written (or Claude Code–written) nursing-notes summary for one patient, so the
// clinic hand-out can print it without an API key. The summary is tied to the patient's current
// notes by a hash — if the notes change later, the stored summary stops matching and the report
// asks for a new one.
//
//   npm run save-summary -- 1 summary.txt
//   npm run save-summary -- 1 summary.txt --model claude-sonnet-5-5
//   npm run save-summary -- 1 summary_en.txt --lang en     # the English hand-out's summary
//
// The text file holds the bullet lines ("- ..."). The prompt this summary should follow is
// SYSTEM_PROMPT in src/lib/notesSummary.ts.

import { readFileSync } from "fs";
import { sql } from "../src/lib/db";
import { DEFAULT_MODEL, notesHash, promptVersionFor, saveNotesSummary } from "../src/lib/notesSummary";

async function main() {
  const args = process.argv.slice(2);
  const modelIdx = args.indexOf("--model");
  const model = modelIdx >= 0 ? args.splice(modelIdx, 2)[1] || DEFAULT_MODEL : DEFAULT_MODEL;
  const langIdx = args.indexOf("--lang");
  const lang = langIdx >= 0 && args.splice(langIdx, 2)[1] === "en" ? "en" : "ko";
  const [code, file] = args;
  if (!code || !file) throw new Error("사용법: npm run save-summary -- <참여자번호> <요약 텍스트 파일> [--model 모델명]");

  const text = readFileSync(file, "utf8").trim();
  if (!text) throw new Error("요약 파일이 비어 있습니다.");

  const rows = await sql`
    SELECT note_date::text AS note_date, body FROM nursing_notes WHERE patient_code = ${code} ORDER BY note_date DESC, created_at DESC
  `;
  if (rows.length === 0) throw new Error(`참여자번호 ${code}에는 저장된 간호 노트가 없습니다.`);
  const notes = rows.map((r) => ({ note_date: String(r.note_date), body: String(r.body) }));

  await saveNotesSummary(code, notes, text, { model, source: "manual", lang });
  console.log(`저장했습니다: 참여자번호 ${code} · 노트 ${notes.length}건 · 노트 해시 ${notesHash(notes).slice(0, 12)} · 프롬프트 ${promptVersionFor(lang)} · 모델 ${model}`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
);
