// PRO-CTCAE Korean Item Library Version 1.0
// NCI Patient-Reported Outcomes version of the Common Terminology Criteria for Adverse Events

export type QuestionType = "frequency" | "severity" | "interference" | "presence";

export interface SubQuestion {
  key: string; // 'a', 'b', 'c'
  type: QuestionType;
  text: string; // Korean question text
}

export interface SurveyItem {
  id: number;
  termEn: string;
  termKo: string;
  category: string;
  questions: SubQuestion[];
}

// Response options per question type
export const RESPONSE_OPTIONS: Record<QuestionType, string[]> = {
  frequency: ["전혀 없다", "드물게 있다", "가끔 있다", "자주 있다", "거의 항상 있다"],
  severity: ["전혀 없다", "조금 있다", "중간 정도이다", "심하다", "매우 심하다"],
  interference: ["전혀 없다", "조금 있다", "어느 정도 있다", "상당히 있다", "매우 많이 있다"],
  presence: ["아니오", "예"],
};

export const SURVEY_ITEMS: SurveyItem[] = [
  // ── 구강·소화기계 ──────────────────────────────────────────────
  {
    id: 1,
    termEn: "Dry mouth",
    termKo: "입마름",
    category: "구강",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 입마름이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 2,
    termEn: "Difficulty swallowing",
    termKo: "삼키기 어려움",
    category: "구강",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 삼키기 어려움이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 3,
    termEn: "Mouth/throat sores",
    termKo: "구강이나 인후 궤양이나 염증 (점막염)",
    category: "구강",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 구강이나 인후 궤양이나 염증이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 구강이나 인후 궤양이나 염증이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 4,
    termEn: "Cracking at the corners of the mouth (cheilosis/cheilitis)",
    termKo: "입술 양쪽 귀퉁이가 트거나 갈라짐",
    category: "구강",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 입술 양쪽 귀퉁이가 트거나 갈라지는 것이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 5,
    termEn: "Voice quality changes",
    termKo: "목소리 변화",
    category: "구강",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 목소리의 변화가 있었습니까?",
      },
    ],
  },
  {
    id: 6,
    termEn: "Hoarseness",
    termKo: "쉰 목소리",
    category: "구강",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 쉰 목소리가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 7,
    termEn: "Taste changes",
    termKo: "맛이나 냄새에 대한 미각이나 후각의 변화",
    category: "구강",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 맛이나 냄새에 대한 미각이나 후각의 변화가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 8,
    termEn: "Decreased appetite",
    termKo: "식욕 감소",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 식욕 감소가 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 식욕 감소가 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 9,
    termEn: "Nausea",
    termKo: "메스꺼움",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 메스꺼움이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 메스꺼움이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 10,
    termEn: "Vomiting",
    termKo: "구토 (토하거나 욕지기)",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 구토를 얼마나 자주 하였습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 구토가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 11,
    termEn: "Heartburn",
    termKo: "속쓰림",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 속 쓰림이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 속 쓰림이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 12,
    termEn: "Gas",
    termKo: "가스(방귀)가 증가하거나 트림이 많아짐",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 복부 내 가스 증가나 트림이 많아진 적이 있었습니까?",
      },
    ],
  },
  {
    id: 13,
    termEn: "Bloating",
    termKo: "복부 팽만감 (배에 가스가 찬 것처럼 배가 불룩해짐)",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 복부 팽만감이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 복부 팽만감이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 14,
    termEn: "Hiccups",
    termKo: "딸꾹질",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 딸꾹질이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 딸꾹질이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 15,
    termEn: "Constipation",
    termKo: "변비",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 변비가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 16,
    termEn: "Diarrhea",
    termKo: "설사 (묽은 변)",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 설사가 있거나 묽은 변을 본 적이 얼마나 자주 있었습니까?",
      },
    ],
  },
  {
    id: 17,
    termEn: "Abdominal pain",
    termKo: "복통",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 복통이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 복통이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 복통이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 18,
    termEn: "Fecal incontinence",
    termKo: "변실금",
    category: "소화기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 변실금이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 변실금이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },

  // ── 호흡기·심혈관계 ────────────────────────────────────────────
  {
    id: 19,
    termEn: "Shortness of breath",
    termKo: "호흡 곤란",
    category: "호흡기",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 호흡 곤란이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 호흡 곤란이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 20,
    termEn: "Cough",
    termKo: "기침",
    category: "호흡기",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 기침이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 기침이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 21,
    termEn: "Wheezing",
    termKo: "천명음 (쌕쌕거리는 소리)",
    category: "호흡기",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 천명음(쌕쌕거리는 소리)이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 22,
    termEn: "Swelling",
    termKo: "부종 (몸이 붓는 것)",
    category: "심혈관계",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 몸이 붓는 증상이 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 부종이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 부종이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 23,
    termEn: "Heart palpitations",
    termKo: "심계항진 (두근거림)",
    category: "심혈관계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 심계항진(두근거림)이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 심계항진(두근거림)이 얼마나 심했습니까?",
      },
    ],
  },

  // ── 피부·모발·손발톱 ───────────────────────────────────────────
  {
    id: 24,
    termEn: "Rash",
    termKo: "발진",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 발진이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 25,
    termEn: "Skin dryness",
    termKo: "피부 건조",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 피부 건조가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 26,
    termEn: "Acne",
    termKo: "여드름",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 여드름이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 27,
    termEn: "Hair loss",
    termKo: "탈모",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 탈모가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 28,
    termEn: "Itching",
    termKo: "가려움증",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 가려움증이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 29,
    termEn: "Hives",
    termKo: "두드러기",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 두드러기가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 30,
    termEn: "Hand-foot syndrome",
    termKo: "수족 증후군 (손발이 빨개지거나 아프거나 벗겨짐)",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 수족 증후군이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 31,
    termEn: "Nail loss",
    termKo: "손발톱 빠짐",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 손발톱 빠짐이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 32,
    termEn: "Nail ridging",
    termKo: "손발톱 융기 (손발톱에 세로 혹은 가로 줄이 생김)",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 손발톱 융기가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 33,
    termEn: "Nail discoloration",
    termKo: "손발톱 변색",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 손발톱 색이 변했습니까?",
      },
    ],
  },
  {
    id: 34,
    termEn: "Sensitivity to sunlight",
    termKo: "햇빛 민감성",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 햇빛 민감성이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 35,
    termEn: "Bed/pressure sores",
    termKo: "욕창/압박 궤양",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 욕창 또는 압박 궤양이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 36,
    termEn: "Radiation skin reaction",
    termKo: "방사선 피부 반응",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 방사선 피부 반응이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 37,
    termEn: "Skin darkening",
    termKo: "피부 색소 침착 (피부가 어두워짐)",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 피부가 어두워지는 색소 침착이 있었습니까?",
      },
    ],
  },
  {
    id: 38,
    termEn: "Stretch marks",
    termKo: "튼살",
    category: "피부, 모발 및 손발톱",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 튼살이 있었습니까?",
      },
    ],
  },

  // ── 신경계·감각기계 ────────────────────────────────────────────
  {
    id: 39,
    termEn: "Numbness & tingling",
    termKo: "감각 이상 (저림이나 따끔따끔한 느낌)",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 저림이나 따끔따끔한 감각 이상이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 감각 이상이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 40,
    termEn: "Dizziness",
    termKo: "어지럼증",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 어지럼증이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 어지럼증이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 41,
    termEn: "Blurred vision",
    termKo: "시야 흐림",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 시야 흐림이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 시야 흐림이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 42,
    termEn: "Flashing lights",
    termKo: "섬광 (눈 앞에 번쩍이는 빛)",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 눈 앞에 번쩍이는 빛(섬광)이 있었습니까?",
      },
    ],
  },
  {
    id: 43,
    termEn: "Visual floaters",
    termKo: "날파리증 (눈 앞에 떠다니는 물체)",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 눈 앞에 떠다니는 물체(날파리증)가 있었습니까?",
      },
    ],
  },
  {
    id: 44,
    termEn: "Watery eyes",
    termKo: "눈물 흘림",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 눈물 흘림이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 눈물 흘림이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 45,
    termEn: "Ringing in ears",
    termKo: "이명 (귀울림)",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 이명(귀울림)이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 46,
    termEn: "Concentration",
    termKo: "집중력 저하",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 집중하는 것이 얼마나 어려웠습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 집중력 저하가 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 47,
    termEn: "Memory",
    termKo: "기억력 저하",
    category: "신경계 및 감각기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 기억력 저하가 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 기억력 저하가 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },

  // ── 통증 ─────────────────────────────────────────────────────
  {
    id: 48,
    termEn: "General pain",
    termKo: "일반적 통증",
    category: "통증",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 통증이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 통증이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 통증이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 49,
    termEn: "Headache",
    termKo: "두통",
    category: "통증",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 두통이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 두통이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 두통이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 50,
    termEn: "Muscle pain",
    termKo: "근육통",
    category: "통증",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 근육통이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 근육통이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 근육통이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 51,
    termEn: "Joint pain",
    termKo: "관절통",
    category: "통증",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 관절통이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 관절통이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 관절통이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },

  // ── 수면·피로·정서 ────────────────────────────────────────────
  {
    id: 52,
    termEn: "Insomnia",
    termKo: "불면증",
    category: "수면, 피로 및 정서",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 불면증이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 불면증이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 53,
    termEn: "Fatigue",
    termKo: "피로감",
    category: "수면, 피로 및 정서",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 피로감이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 피로감이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 54,
    termEn: "Anxious",
    termKo: "불안감",
    category: "수면, 피로 및 정서",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 불안감이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 불안감이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 불안감이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 55,
    termEn: "Discouraged",
    termKo: "낙담 (아무것도 나를 즐겁게 할 수 없을 것 같은 느낌)",
    category: "수면, 피로 및 정서",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 낙담감이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 낙담감이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 낙담감이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 56,
    termEn: "Sad",
    termKo: "슬픔",
    category: "수면, 피로 및 정서",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 슬픔이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 슬픔이 얼마나 심했습니까?",
      },
      {
        key: "c",
        type: "interference",
        text: "지난 일주일 동안, 슬픔이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },

  // ── 생식기계 ─────────────────────────────────────────────────
  {
    id: 57,
    termEn: "Irregular periods/vaginal bleeding",
    termKo: "불규칙한 생리 또는 질 출혈",
    category: "생식기계",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 불규칙한 생리 또는 예상치 못한 질 출혈이 있었습니까?",
      },
    ],
  },
  {
    id: 58,
    termEn: "Missed expected menstrual period",
    termKo: "생리 결여 (예상된 생리가 없음)",
    category: "생식기계",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 예상했던 생리가 없었습니까?",
      },
    ],
  },
  {
    id: 59,
    termEn: "Vaginal discharge",
    termKo: "질 분비물",
    category: "생식기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 질 분비물이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 60,
    termEn: "Vaginal dryness",
    termKo: "질 건조",
    category: "생식기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 질 건조가 얼마나 심했습니까?",
      },
    ],
  },

  // ── 비뇨기계 ─────────────────────────────────────────────────
  {
    id: 61,
    termEn: "Painful urination",
    termKo: "배뇨통 (소변 볼 때 통증)",
    category: "비뇨기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 소변 볼 때 통증이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 62,
    termEn: "Urinary urgency",
    termKo: "요절박 (소변이 갑자기 급하게 마려움)",
    category: "비뇨기계",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 소변이 갑자기 급하게 마려운 요절박이 얼마나 심했습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 요절박이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 63,
    termEn: "Urinary frequency",
    termKo: "빈뇨 (소변을 자주 봄)",
    category: "비뇨기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 평상시보다 소변을 자주 보았습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 빈뇨가 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },
  {
    id: 64,
    termEn: "Change in usual urine color",
    termKo: "소변 색 변화",
    category: "비뇨기계",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 평소와 다른 소변 색깔이 있었습니까?",
      },
    ],
  },
  {
    id: 65,
    termEn: "Urinary incontinence",
    termKo: "요실금 (소변이 새는 것)",
    category: "비뇨기계",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 소변이 새는 요실금이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "interference",
        text: "지난 일주일 동안, 요실금이 일상생활에 얼마나 영향을 미쳤습니까?",
      },
    ],
  },

  // ── 성기능 ───────────────────────────────────────────────────
  {
    id: 66,
    termEn: "Achieve and maintain erection",
    termKo: "발기 유지 어려움",
    category: "성기능",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 발기를 유지하는 것이 얼마나 어려웠습니까?",
      },
    ],
  },
  {
    id: 67,
    termEn: "Ejaculation",
    termKo: "사정 어려움",
    category: "성기능",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 사정이 얼마나 어려웠습니까?",
      },
    ],
  },
  {
    id: 68,
    termEn: "Decreased libido",
    termKo: "성욕 감소",
    category: "성기능",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 성욕 감소가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 69,
    termEn: "Delayed orgasm",
    termKo: "오르가즘 지연",
    category: "성기능",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 오르가즘 지연이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 70,
    termEn: "Unable to have orgasm",
    termKo: "오르가즘 불능",
    category: "성기능",
    questions: [
      {
        key: "a",
        type: "presence",
        text: "지난 일주일 동안, 오르가즘을 경험하지 못했습니까?",
      },
    ],
  },
  {
    id: 71,
    termEn: "Pain w/sexual intercourse",
    termKo: "성교통 (성관계 시 통증)",
    category: "성기능",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 성관계 시 통증이 얼마나 심했습니까?",
      },
    ],
  },

  // ── 기타 전신 증상 ─────────────────────────────────────────────
  {
    id: 72,
    termEn: "Breast swelling and tenderness",
    termKo: "유방 팽창 및 압통",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 유방 팽창 및 압통이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 73,
    termEn: "Bruising",
    termKo: "멍 (멍이 듦)",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 멍이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 74,
    termEn: "Chills",
    termKo: "오한 (몸이 떨리고 춥게 느껴짐)",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 오한이 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 오한이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 75,
    termEn: "Increased sweating",
    termKo: "발한 증가 (땀이 많이 남)",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 땀이 많이 나는 발한 증가가 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 발한 증가가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 76,
    termEn: "Decreased sweating",
    termKo: "발한 감소 (땀이 잘 나지 않음)",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 발한 감소가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 77,
    termEn: "Hot flashes",
    termKo: "안면홍조 (열감)",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 안면홍조(열감)가 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 안면홍조(열감)가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 78,
    termEn: "Nosebleed",
    termKo: "코피",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "frequency",
        text: "지난 일주일 동안, 코피가 얼마나 자주 있었습니까?",
      },
      {
        key: "b",
        type: "severity",
        text: "지난 일주일 동안, 코피가 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 79,
    termEn: "Pain and swelling at injection site",
    termKo: "주사 또는 정맥주사 삽입 부위의 통증, 부종, 발적",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 주사 부위의 통증, 부종, 발적이 얼마나 심했습니까?",
      },
    ],
  },
  {
    id: 80,
    termEn: "Body odor",
    termKo: "체취 변화",
    category: "기타 전신 증상",
    questions: [
      {
        key: "a",
        type: "severity",
        text: "지난 일주일 동안, 체취 변화가 얼마나 심했습니까?",
      },
    ],
  },
];

export const CATEGORIES = [...new Set(SURVEY_ITEMS.map((item) => item.category))];

export function getTotalQuestionCount(): number {
  return SURVEY_ITEMS.reduce((sum, item) => sum + item.questions.length, 0);
}

export function getItemsByCategory(category: string): SurveyItem[] {
  return SURVEY_ITEMS.filter((item) => item.category === category);
}
