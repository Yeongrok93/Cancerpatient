// Kinds of Researcher Notes (nursing_notes.kind). Contact-type entries (통화 / 문자) can be
// saved with no text so a call or text is logged in one tap; every other kind needs some text.
// Anything but a plain 메모 is drawn as an arrow above the matching survey week in the patient
// dashboard, so the effect of an intervention is easy to read next to the symptom grades.

export type NoteKind = "call" | "sms" | "note";

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
    key: "sms", label: "문자", short: "문자", contact: true,
    hint: "문자 내용 (선택)",
    chip: "bg-emerald-50 text-emerald-900 border-emerald-200", arrow: "bg-emerald-100 text-emerald-900 border-emerald-300",
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
