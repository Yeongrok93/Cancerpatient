// EORTC QLQ-C30 (v3) scoring. Functional scales and global health status: higher = better.
// Symptom scales: higher = worse. All scores are 0–100; a scale with a missing item has no score.

export type QlqScale = {
  key: string;
  label: string;
  group: "기능척도" | "전반적 건강상태" | "증상척도";
  items: number[];
  kind: "functional" | "symptom" | "global";
};

export const QLQ_SCALES: QlqScale[] = [
  { key: "pf", label: "신체기능", group: "기능척도", items: [1, 2, 3, 4, 5], kind: "functional" },
  { key: "rf", label: "역할기능", group: "기능척도", items: [6, 7], kind: "functional" },
  { key: "ef", label: "정서기능", group: "기능척도", items: [21, 22, 23, 24], kind: "functional" },
  { key: "cf", label: "인지기능", group: "기능척도", items: [20, 25], kind: "functional" },
  { key: "sf", label: "사회기능", group: "기능척도", items: [26, 27], kind: "functional" },
  { key: "ghs", label: "전반적 건강상태·삶의 질", group: "전반적 건강상태", items: [29, 30], kind: "global" },
  { key: "fa", label: "피로", group: "증상척도", items: [10, 12, 18], kind: "symptom" },
  { key: "nv", label: "오심/구토", group: "증상척도", items: [14, 15], kind: "symptom" },
  { key: "pa", label: "통증", group: "증상척도", items: [9, 19], kind: "symptom" },
  { key: "dy", label: "호흡곤란", group: "증상척도", items: [8], kind: "symptom" },
  { key: "sl", label: "불면", group: "증상척도", items: [11], kind: "symptom" },
  { key: "ap", label: "식욕상실", group: "증상척도", items: [13], kind: "symptom" },
  { key: "co", label: "변비", group: "증상척도", items: [16], kind: "symptom" },
  { key: "di", label: "설사", group: "증상척도", items: [17], kind: "symptom" },
  { key: "fi", label: "경제적 어려움", group: "증상척도", items: [28], kind: "symptom" },
];

/** Score 0–100 for one scale, or null when any of its items is unanswered. */
export function qlqScaleScore(scale: QlqScale, answers: Map<number, number>): number | null {
  const values = scale.items.map((n) => answers.get(n));
  if (values.some((v) => v === undefined)) return null;
  const mean = (values as number[]).reduce((a, b) => a + b, 0) / values.length;
  const score = scale.kind === "global" ? ((mean - 1) / 6) * 100 : scale.kind === "functional" ? (1 - (mean - 1) / 3) * 100 : ((mean - 1) / 3) * 100;
  return Math.round(score * 10) / 10;
}

/** How bad a score is, 0 (good) – 3 (bad), for colouring. Functional / global: low is bad; symptom: high is bad. */
export function qlqBadness(scale: QlqScale, score: number): 0 | 1 | 2 | 3 {
  const bad = scale.kind === "symptom" ? score : 100 - score;
  return bad <= 20 ? 0 : bad <= 40 ? 1 : bad <= 60 ? 2 : 3;
}
