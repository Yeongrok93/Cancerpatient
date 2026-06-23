export interface W0RadioQuestion {
  key: string;
  label: string;
  type: "radio";
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

export type W0Question = W0RadioQuestion | W0NumberQuestion | W0DurationQuestion;

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
    key: "living", label: "동거형태", type: "radio",
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

// Part II — IPAQ
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
