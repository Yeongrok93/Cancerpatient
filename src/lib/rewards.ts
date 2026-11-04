// 적립금 (participation reward) rules, shared by the weekly reminder text and the 증상 설문 header.

export const REWARD_PER_SURVEY = 10_000; // 원, per completed 증상 설문
export const REWARD_PER_QLQ = 10_000; // 원, added on top when the 삶의 질 설문 of a quarterly week is completed (= 20,000원 that week)

export function rewardTotal(proDone: number, qlqDone: number): number {
  return proDone * REWARD_PER_SURVEY + qlqDone * REWARD_PER_QLQ;
}
