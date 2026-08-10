// PRO-CTCAE Composite Grading Algorithm
//
// Source: Basch E, et al. "Composite Grading Algorithm for the National
// Cancer Institute's Patient-Reported Outcomes version of the Common
// Terminology Criteria for Adverse Events (PRO-CTCAE)." Supplemental Table
// S2 (parts A, B, C). Values below are transcribed verbatim from that table.
//
// Response scales (0-indexed, matches RESPONSE_OPTIONS in questions.ts):
//   frequency:    Never(0) Rarely(1) Occasionally(2) Frequently(3) Almost Constantly(4)
//   severity:     None(0) Mild(1) Moderate(2) Severe(3) Very Severe(4)
//   interference: Not at all(0) A little bit(1) Somewhat(2) Quite a bit(3) Very Much(4)
//
// The source table collapses the "never/none/not-at-all" anchor of each
// dimension to a single all-zero row (skip-logic: if a symptom never
// happened, its severity/interference aren't clinically meaningful). That is
// reproduced here as an explicit shortcut in computeCompositeGrade rather
// than as sparse rows, so every combination our UI can actually produce
// resolves to a grade.

import type { SurveyItem, QuestionType } from "./questions";

export type GradeInputs = {
  frequency?: number;
  severity?: number;
  interference?: number;
};

function buildMap3(rows: [number, number, number, number][]): Map<string, number> {
  const map = new Map<string, number>();
  for (const [a, b, c, grade] of rows) map.set(`${a}-${b}-${c}`, grade);
  return map;
}

function buildMap2(rows: [number, number, number][]): Map<string, number> {
  const map = new Map<string, number>();
  for (const [a, b, grade] of rows) map.set(`${a}-${b}`, grade);
  return map;
}

function buildMap1(rows: [number, number][]): Map<number, number> {
  const map = new Map<number, number>();
  for (const [a, grade] of rows) map.set(a, grade);
  return map;
}

// Table S2-A: frequency x severity x interference -> grade
// (rows for frequency=0 "Never" omitted; see frequency===0 shortcut below)
const TABLE_3ITEM = buildMap3([
  [1, 0, 0, 0], [1, 0, 1, 1], [1, 0, 2, 1], [1, 0, 3, 2], [1, 0, 4, 2],
  [1, 1, 0, 1], [1, 1, 1, 1], [1, 1, 2, 1], [1, 1, 3, 2], [1, 1, 4, 2],
  [1, 2, 0, 1], [1, 2, 1, 2], [1, 2, 2, 2], [1, 2, 3, 2], [1, 2, 4, 3],
  [1, 3, 0, 2], [1, 3, 1, 2], [1, 3, 2, 2], [1, 3, 3, 3], [1, 3, 4, 3],
  [1, 4, 0, 2], [1, 4, 1, 2], [1, 4, 2, 3], [1, 4, 3, 3], [1, 4, 4, 3],

  [2, 0, 0, 0], [2, 0, 1, 1], [2, 0, 2, 1], [2, 0, 3, 2], [2, 0, 4, 2],
  [2, 1, 0, 1], [2, 1, 1, 1], [2, 1, 2, 1], [2, 1, 3, 2], [2, 1, 4, 2],
  [2, 2, 0, 2], [2, 2, 1, 2], [2, 2, 2, 2], [2, 2, 3, 3], [2, 2, 4, 3],
  [2, 3, 0, 2], [2, 3, 1, 2], [2, 3, 2, 2], [2, 3, 3, 3], [2, 3, 4, 3],
  [2, 4, 0, 2], [2, 4, 1, 2], [2, 4, 2, 3], [2, 4, 3, 3], [2, 4, 4, 3],

  [3, 0, 0, 1], [3, 0, 1, 1], [3, 0, 2, 1], [3, 0, 3, 2], [3, 0, 4, 2],
  [3, 1, 0, 1], [3, 1, 1, 1], [3, 1, 2, 1], [3, 1, 3, 2], [3, 1, 4, 2],
  [3, 2, 0, 2], [3, 2, 1, 2], [3, 2, 2, 2], [3, 2, 3, 3], [3, 2, 4, 3],
  [3, 3, 0, 2], [3, 3, 1, 2], [3, 3, 2, 3], [3, 3, 3, 3], [3, 3, 4, 3],
  [3, 4, 0, 2], [3, 4, 1, 2], [3, 4, 2, 3], [3, 4, 3, 3], [3, 4, 4, 3],

  [4, 0, 0, 1], [4, 0, 1, 1], [4, 0, 2, 1], [4, 0, 3, 2], [4, 0, 4, 2],
  [4, 1, 0, 1], [4, 1, 1, 1], [4, 1, 2, 2], [4, 1, 3, 2], [4, 1, 4, 3],
  [4, 2, 0, 2], [4, 2, 1, 2], [4, 2, 2, 2], [4, 2, 3, 3], [4, 2, 4, 3],
  [4, 3, 0, 2], [4, 3, 1, 2], [4, 3, 2, 3], [4, 3, 3, 3], [4, 3, 4, 3],
  [4, 4, 0, 2], [4, 4, 1, 2], [4, 4, 2, 3], [4, 4, 3, 3], [4, 4, 4, 3],
]);

// Table S2-B (frequency x severity); frequency=0 row omitted (shortcut).
const TABLE_FREQ_SEV = buildMap2([
  [1, 0, 1], [1, 1, 1], [1, 2, 1], [1, 3, 2], [1, 4, 2],
  [2, 0, 1], [2, 1, 1], [2, 2, 2], [2, 3, 2], [2, 4, 2],
  [3, 0, 1], [3, 1, 1], [3, 2, 2], [3, 3, 3], [3, 4, 3],
  [4, 0, 1], [4, 1, 1], [4, 2, 2], [4, 3, 3], [4, 4, 3],
]);

// Table S2-B (severity x interference); severity=0 row omitted (shortcut).
const TABLE_SEV_INT = buildMap2([
  [1, 0, 1], [1, 1, 1], [1, 2, 1], [1, 3, 2], [1, 4, 2],
  [2, 0, 1], [2, 1, 1], [2, 2, 2], [2, 3, 2], [2, 4, 3],
  [3, 0, 1], [3, 1, 2], [3, 2, 2], [3, 3, 3], [3, 4, 3],
  [4, 0, 2], [4, 1, 2], [4, 2, 2], [4, 3, 3], [4, 4, 3],
]);

// Table S2-B (frequency x interference); frequency=0 row omitted (shortcut).
const TABLE_FREQ_INT = buildMap2([
  [1, 0, 1], [1, 1, 1], [1, 2, 1], [1, 3, 2], [1, 4, 2],
  [2, 0, 1], [2, 1, 1], [2, 2, 1], [2, 3, 2], [2, 4, 2],
  [3, 0, 1], [3, 1, 1], [3, 2, 2], [3, 3, 3], [3, 4, 3],
  [4, 0, 1], [4, 1, 1], [4, 2, 2], [4, 3, 3], [4, 4, 3],
]);

// Table S2-C: single-dimension tables (frequency, severity, amount).
const TABLE_FREQ_ONLY = buildMap1([[0, 0], [1, 1], [2, 1], [3, 2], [4, 3]]);
const TABLE_SEV_ONLY = buildMap1([[0, 0], [1, 1], [2, 2], [3, 3], [4, 3]]);
const TABLE_AMOUNT_ONLY = buildMap1([[0, 0], [1, 1], [2, 1], [3, 2], [4, 2]]);

/**
 * Maps a PRO-CTCAE item's reported frequency/severity/interference to a
 * CTCAE-style composite grade (0-3), per Basch et al. 2021 Table S2.
 * "presence" (yes/no) items are not covered by the algorithm and are not
 * accepted here — pass only frequency/severity/interference.
 * Returns null when no gradable dimension was provided.
 */
export function computeCompositeGrade(inputs: GradeInputs): number | null {
  const { frequency, severity, interference } = inputs;
  const hasFreq = frequency !== undefined;
  const hasSev = severity !== undefined;
  const hasInt = interference !== undefined;

  if (hasFreq && hasSev && hasInt) {
    if (frequency === 0) return 0;
    return TABLE_3ITEM.get(`${frequency}-${severity}-${interference}`) ?? null;
  }
  if (hasFreq && hasSev) {
    if (frequency === 0) return 0;
    return TABLE_FREQ_SEV.get(`${frequency}-${severity}`) ?? null;
  }
  if (hasSev && hasInt) {
    if (severity === 0) return 0;
    return TABLE_SEV_INT.get(`${severity}-${interference}`) ?? null;
  }
  if (hasFreq && hasInt) {
    if (frequency === 0) return 0;
    return TABLE_FREQ_INT.get(`${frequency}-${interference}`) ?? null;
  }
  if (hasFreq) return TABLE_FREQ_ONLY.get(frequency as number) ?? null;
  if (hasSev) return TABLE_SEV_ONLY.get(severity as number) ?? null;
  return null;
}

/** Same as computeCompositeGrade, for a PRO-CTCAE "amount" question alone. */
export function computeAmountOnlyGrade(amount: number): number | null {
  return TABLE_AMOUNT_ONLY.get(amount) ?? null;
}

/**
 * Resolves an item's composite grade from its question definitions and a
 * map of that item's answered values (keyed by sub-question key, e.g.
 * survey_answers rows for one item_id keyed by question_key).
 * Returns null for presence-only items (not covered by the algorithm).
 */
export function computeItemGrade(
  item: Pick<SurveyItem, "questions">,
  valuesByKey: Record<string, number | undefined>
): number | null {
  const inputs: GradeInputs = {};
  for (const q of item.questions) {
    const value = valuesByKey[q.key];
    if (value === undefined) continue;
    if (q.type === "frequency") inputs.frequency = value;
    else if (q.type === "severity") inputs.severity = value;
    else if (q.type === "interference") inputs.interference = value;
    // "presence" is intentionally ignored — not part of the grading algorithm
  }
  return computeCompositeGrade(inputs);
}

// Grade 0 recedes toward the surface (near-zero); 1-3 escalate warning -> critical.
// Matches this app's existing warning-color convention (bg-amber-*) rather than
// introducing new hex values.
export const GRADE_COLORS: Record<number, string> = {
  0: "bg-gray-100 text-gray-400",
  1: "bg-amber-200 text-amber-900",
  2: "bg-orange-400 text-white",
  3: "bg-red-600 text-white",
};

export const GRADE_LABELS: Record<number, string> = {
  0: "없음",
  1: "경도",
  2: "중등도",
  3: "중증",
};

export type { QuestionType };
