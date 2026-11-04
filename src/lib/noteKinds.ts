// Kinds of Researcher Notes (nursing_notes.kind). Contact-type entries (통화 / 부재중 / 문자) can be
// saved with no text so a call or text is logged in one tap; every other kind needs some text.
// Anything but a plain 메모 is drawn as an arrow above the matching survey week in the patient
// dashboard, so the effect of an intervention is easy to read next to the symptom grades.

export type NoteKind = "call" | "missed" | "sms" | "visit" | "intervention" | "external" | "note";

export type NoteKindInfo = {
  key: NoteKind;
  label: string;
  short: string; // chip text inside the timeline arrow
  hint: string; // placeholder for the text box
  contact: boolean; // counts as a contact attempt; text optional
  chip: string; // tailwind classes: button / badge colours
  arrow: string; // tailwind classes: timeline arrow colours
};

export const NOTE_KINDS: NoteKindInfo[] = [
  {
    key: "call", label: "통화", short: "통화", contact: true,
    hint: "통화 내용 (선택) — 예: 구토 호소, 수분 섭취 안내",
    chip: "bg-sky-50 text-sky-900 border-sky-200", arrow: "bg-sky-100 text-sky-900 border-sky-300",
  },
  {
    key: "missed", label: "부재중", short: "부재중", contact: true,
    hint: "메모 (선택) — 예: 2회 시도, 문자 남김",
    chip: "bg-gray-100 text-gray-800 border-gray-300", arrow: "bg-gray-100 text-gray-700 border-gray-300",
  },
  {
    key: "sms", label: "문자", short: "문자", contact: true,
    hint: "문자 내용 (선택)",
    chip: "bg-emerald-50 text-emerald-900 border-emerald-200", arrow: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
  {
    key: "visit", label: "방문·외래", short: "외래", contact: false,
    hint: "방문·외래 내용 — 예: 항암 투약일, 교수님 진료",
    chip: "bg-violet-50 text-violet-900 border-violet-200", arrow: "bg-violet-100 text-violet-900 border-violet-300",
  },
  {
    key: "intervention", label: "중재", short: "중재", contact: false,
    hint: "어떤 중재가 어떻게 들어갔는지 — 예: 구내염 구강간호 교육, 약 조정 요청",
    chip: "bg-rose-50 text-rose-900 border-rose-200", arrow: "bg-rose-100 text-rose-900 border-rose-400",
  },
  {
    key: "external", label: "타원·전원 (환자 보고)", short: "타원", contact: false,
    hint: "타 병원 진료·전원 내용을 환자가 말한 그대로 자유롭게 적어 주세요.",
    chip: "bg-amber-50 text-amber-900 border-amber-200", arrow: "bg-amber-100 text-amber-900 border-amber-300",
  },
  {
    key: "note", label: "메모", short: "메모", contact: false,
    hint: "자유 메모",
    chip: "bg-white text-gray-800 border-gray-300", arrow: "bg-white text-gray-700 border-gray-300",
  },
];

export const NOTE_KIND_BY_KEY: Record<NoteKind, NoteKindInfo> = Object.fromEntries(
  NOTE_KINDS.map((k) => [k.key, k])
) as Record<NoteKind, NoteKindInfo>;

export function parseNoteKind(v: unknown): NoteKind {
  return typeof v === "string" && v in NOTE_KIND_BY_KEY ? (v as NoteKind) : "note";
}

/** Notes of this kind are marked with an arrow on the timeline (everything except a plain 메모). */
export function isTimelineKind(kind: NoteKind): boolean {
  return kind !== "note";
}
