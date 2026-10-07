export interface W0RadioQuestion {
  key: string;
  label: string;
  type: "radio";
  options: { value: number; label: string }[];
}

export interface W0MultiQuestion {
  key: string;
  label: string;
  type: "multi"; // checkboxes; stored as comma-separated option values, e.g. "2,3"
  hint?: string;
  /** Option value that cannot be combined with any other (e.g. "혼자"). */
  exclusiveValue?: number;
  options: { value: number; label: string }[];
}

export interface W0NumberQuestion {
  key: string;
  label: string;
  type: "number";
  unit?: string;
  min?: number;
  max?: number;
}

export interface W0DurationQuestion {
  key: string;
  label: string;
  type: "duration"; // hours + minutes
}

export type W0Question = W0RadioQuestion | W0MultiQuestion | W0NumberQuestion | W0DurationQuestion;

// Part I — Demographics
export const DEMOGRAPHICS: W0Question[] = [
  { key: "age",      label: "나이",     type: "number", unit: "세",  min: 0,  max: 120 },
  {
    key: "gender", label: "성별", type: "radio",
    options: [{ value: 1, label: "남성" }, { value: 2, label: "여성" }],
  },
  {
    key: "education", label: "최종학력", type: "radio",
    options: [
      { value: 1, label: "무학·초등학교 졸업" },
      { value: 2, label: "중·고등학교 졸업" },
      { value: 3, label: "대학교 졸업" },
      { value: 4, label: "대학원 이상" },
    ],
  },
  {
    key: "marital", label: "결혼상태", type: "radio",
    options: [
      { value: 1, label: "미혼" },
      { value: 2, label: "기혼" },
      { value: 3, label: "이혼·별거" },
      { value: 4, label: "사별" },
    ],
  },
  {
    key: "living", label: "동거형태", type: "multi",
    hint: "함께 사는 분을 모두 선택해 주세요.",
    exclusiveValue: 1,
    options: [
      { value: 1, label: "혼자" },
      { value: 2, label: "배우자와 함께" },
      { value: 3, label: "자녀와 함께" },
      { value: 4, label: "기타" },
    ],
  },
  {
    key: "religion", label: "종교", type: "radio",
    options: [{ value: 1, label: "있음" }, { value: 2, label: "없음" }],
  },
  {
    key: "financial_burden", label: "치료비 부담 정도", type: "radio",
    options: [
      { value: 1, label: "전혀 부담되지 않음" },
      { value: 2, label: "조금 부담됨" },
      { value: 3, label: "보통" },
      { value: 4, label: "많이 부담됨" },
      { value: 5, label: "매우 많이 부담됨" },
    ],
  },
];

// Part II — Patient-Reported ECOG
export interface ECOGOption {
  value: number;
  label: string;
  description: string;
}

export const ECOG_KEY = "ecog";
export const ECOG_LABEL =
  "지난 일주일 동안 환자분의 하루 일상활동 능력과 가장 가까운 설명을 하나만 선택해 주세요.";

export const ECOG_OPTIONS: ECOGOption[] = [
  {
    value: 0,
    label: "0점 (제한 없음)",
    description:
      "암 진단 전과 마찬가지로 운동, 직장 생활, 집안일 등 모든 활동을 제한 없이 할 수 있습니다.",
  },
  {
    value: 1,
    label: "1점 (가벼운 활동 가능)",
    description:
      "격렬한 운동이나 힘든 일은 어렵지만, 가벼운 집안일이나 사무 업무 등은 무리 없이 할 수 있습니다.",
  },
  {
    value: 2,
    label: "2점 (자가간호 가능, 일은 불가)",
    description:
      "혼자 씻고 옷 입는 등의 자가간호는 가능하지만 일을 하기는 어렵고, 낮 시간의 절반 이상(50% 이상)을 누워있지 않고 앉거나 걸어서 활동합니다.",
  },
  {
    value: 3,
    label: "3점 (제한된 자가간호, 주로 누워있음)",
    description:
      "혼자 씻거나 옷 입기 등 최소한의 자가간호만 가능하며, 낮 시간의 절반 이상(50% 이상)을 침대나 의자에 누워/앉아서 보냅니다.",
  },
  {
    value: 4,
    label: "4점 (전적으로 누워 생활)",
    description:
      "혼자서는 씻거나 움직일 수 없어 도움이 필요하며, 하루 종일 침대나 의자에 누워/앉아서 보냅니다.",
  },
];

// Part IV — High-risk toxicity / emergency screening
export interface EmergencyQuestion {
  key: string;
  title: string;
  question: string;
  options: { value: number; label: string }[];
}

export const EMERGENCY_SCREENING: EmergencyQuestion[] = [
  {
    key: "er_fever",
    title: "발열 여부",
    question: "지난 일주일 동안 38.0℃ 이상의 열이 난 적이 있습니까?",
    options: [
      { value: 1, label: "예" },
      { value: 2, label: "아니오" },
      { value: 3, label: "측정해 보지 않음" },
    ],
  },
  {
    key: "er_respiratory",
    title: "급성 호흡기 증상",
    question: "평지를 걸을 때도 평소보다 숨이 차거나, 가슴 통증을 동반한 기침이 지속됩니까?",
    options: [
      { value: 1, label: "예" },
      { value: 2, label: "아니오" },
    ],
  },
  {
    key: "er_dehydration",
    title: "중증 탈수 위험 (위장관계 독성)",
    question: "지난 24시간 동안 물이나 음식을 전혀 삼키지 못할 정도로 구토나 설사가 심했습니까?",
    options: [
      { value: 1, label: "예" },
      { value: 2, label: "아니오" },
    ],
  },
  {
    key: "er_visit_history",
    title: "돌발 상황 이력",
    question: "지난 일주일 사이 부작용이나 건강 악화로 응급실을 방문하거나 입원하신 적이 있습니까?",
    options: [
      { value: 1, label: "예" },
      { value: 2, label: "아니오" },
    ],
  },
];

// Part III — IPAQ
export const IPAQ_ITEMS = [
  {
    id: "vigorous",
    activityLabel: "격렬한 신체활동",
    description: "숨이 많이 차거나 심장이 많이 뛰는 활동 (예: 달리기, 빠른 자전거 타기, 에어로빅 등)",
    daysKey: "vigorous_days",
    daysLabel: "지난 7일 동안, 격렬한 신체활동을 한 날은 며칠입니까?",
    hoursKey: "vigorous_hours",
    minutesKey: "vigorous_minutes",
    durationLabel: "그 중 하루에 평균 격렬한 신체활동을 얼마나 하셨습니까?",
  },
  {
    id: "moderate",
    activityLabel: "중등도 신체활동",
    description: "숨이 약간 차거나 심장이 약간 빠르게 뛰는 활동 (예: 빠른 걷기, 가벼운 자전거 타기, 복식 테니스 등)",
    daysKey: "moderate_days",
    daysLabel: "지난 7일 동안, 중등도 신체활동을 한 날은 며칠입니까?",
    hoursKey: "moderate_hours",
    minutesKey: "moderate_minutes",
    durationLabel: "그 중 하루에 평균 중등도 신체활동을 얼마나 하셨습니까?",
  },
  {
    id: "walking",
    activityLabel: "걷기",
    description: "출·퇴근, 여가, 운동 등의 목적으로 적어도 10분 이상 걷기",
    daysKey: "walking_days",
    daysLabel: "지난 7일 동안, 걷기를 한 날은 며칠입니까?",
    hoursKey: "walking_hours",
    minutesKey: "walking_minutes",
    durationLabel: "그 중 하루에 평균 걷기를 얼마나 하셨습니까?",
  },
];

export const SITTING_KEYS = { hours: "sitting_hours", minutes: "sitting_minutes" };
export const SITTING_LABEL = "지난 7일 동안, 앉아서 보낸 시간은 하루에 평균 얼마입니까?";
