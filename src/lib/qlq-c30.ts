export interface QlqQuestion {
  no: number;
  text: string;
  prefix?: string; // "지난 한 주 기준" if applicable
  scale: "four" | "seven";
}

export const QLQ_QUESTIONS: QlqQuestion[] = [
  // Physical Functioning (Q1-5) — no time prefix
  { no: 1,  text: "계단을 여러 층 올라가는 것이 힘드십니까?",                                     scale: "four" },
  { no: 2,  text: "계단을 한 층 올라가는 것이 힘드십니까?",                                       scale: "four" },
  { no: 3,  text: "걷거나 장을 보러 나가는 것이 힘드십니까?",                                     scale: "four" },
  { no: 4,  text: "하루 동안 침대나 의자에만 계셔야 했습니까?",                                   scale: "four" },
  { no: 5,  text: "식사, 옷 입기, 세수하기 또는 화장실 가기 등 일상 활동을 하는 데 도움이 필요하셨습니까?", scale: "four" },

  // Role / Symptom / Functioning (Q6-28) — "지난 한 주 기준"
  { no: 6,  text: "일상적인 사회 활동이나 가족과의 활동에 제한을 받으셨습니까?",                  prefix: "지난 한 주 기준", scale: "four" },
  { no: 7,  text: "업무(직장일이나 집안일)를 하는 것이 힘드셨습니까?",                           prefix: "지난 한 주 기준", scale: "four" },
  { no: 8,  text: "숨이 차셨습니까?",                                                           prefix: "지난 한 주 기준", scale: "four" },
  { no: 9,  text: "통증이 있으셨습니까?",                                                       prefix: "지난 한 주 기준", scale: "four" },
  { no: 10, text: "휴식이 필요하셨습니까?",                                                     prefix: "지난 한 주 기준", scale: "four" },
  { no: 11, text: "잠을 자는 데 어려움이 있으셨습니까?",                                        prefix: "지난 한 주 기준", scale: "four" },
  { no: 12, text: "몸이 약하거나 피로감을 느끼셨습니까?",                                       prefix: "지난 한 주 기준", scale: "four" },
  { no: 13, text: "식욕이 없으셨습니까?",                                                       prefix: "지난 한 주 기준", scale: "four" },
  { no: 14, text: "구역질(메스꺼움)이 나셨습니까?",                                             prefix: "지난 한 주 기준", scale: "four" },
  { no: 15, text: "구토하셨습니까?",                                                            prefix: "지난 한 주 기준", scale: "four" },
  { no: 16, text: "변비가 있으셨습니까?",                                                       prefix: "지난 한 주 기준", scale: "four" },
  { no: 17, text: "설사가 있으셨습니까?",                                                       prefix: "지난 한 주 기준", scale: "four" },
  { no: 18, text: "피로감을 느끼셨습니까?",                                                     prefix: "지난 한 주 기준", scale: "four" },
  { no: 19, text: "통증으로 인해 일상 활동에 지장을 받으셨습니까?",                              prefix: "지난 한 주 기준", scale: "four" },
  { no: 20, text: "집중하거나 주의를 기울이는 것이 힘드셨습니까?",                               prefix: "지난 한 주 기준", scale: "four" },
  { no: 21, text: "긴장되거나 불안하셨습니까?",                                                 prefix: "지난 한 주 기준", scale: "four" },
  { no: 22, text: "걱정이 되셨습니까?",                                                         prefix: "지난 한 주 기준", scale: "four" },
  { no: 23, text: "과민하거나 짜증이 나셨습니까?",                                              prefix: "지난 한 주 기준", scale: "four" },
  { no: 24, text: "우울하셨습니까?",                                                            prefix: "지난 한 주 기준", scale: "four" },
  { no: 25, text: "사물을 기억하기 힘드셨습니까?",                                              prefix: "지난 한 주 기준", scale: "four" },
  { no: 26, text: "신체 상태나 의학적 치료가 가정생활에 지장을 주셨습니까?",                     prefix: "지난 한 주 기준", scale: "four" },
  { no: 27, text: "신체 상태나 의학적 치료가 사회 활동에 지장을 주셨습니까?",                    prefix: "지난 한 주 기준", scale: "four" },
  { no: 28, text: "신체 상태나 의학적 치료로 인해 재정적 어려움이 있으셨습니까?",                prefix: "지난 한 주 기준", scale: "four" },

  // Global Health / QoL (Q29-30) — 7-point
  { no: 29, text: "건강 상태를 전반적으로 어떻게 평가하시겠습니까?",   prefix: "지난 한 주 기준", scale: "seven" },
  { no: 30, text: "전반적인 삶의 질을 어떻게 평가하시겠습니까?",       prefix: "지난 한 주 기준", scale: "seven" },
];

export const FOUR_POINT_LABELS = ["전혀 아니다", "조금", "꽤", "매우"];
export const SEVEN_POINT_LABELS = ["1\n매우 나쁨", "2", "3", "4", "5", "6", "7\n아주 좋음"];
