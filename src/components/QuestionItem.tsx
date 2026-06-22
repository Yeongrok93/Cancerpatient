"use client";

import { RESPONSE_OPTIONS, QuestionType, SubQuestion } from "@/lib/questions";

interface Props {
  itemId: number;
  question: SubQuestion;
  value: number | boolean | null;
  onChange: (value: number | boolean) => void;
}

const TYPE_LABEL: Record<QuestionType, string> = {
  frequency: "빈도",
  severity: "심각도",
  interference: "일상생활 영향",
  presence: "유무",
};

export default function QuestionItem({ itemId, question, value, onChange }: Props) {
  const optionKey = `q-${itemId}-${question.key}`;

  if (question.type === "presence") {
    return (
      <div className="space-y-3">
        <p className="text-sm font-medium text-gray-800 leading-relaxed">
          {question.text}
        </p>
        <div className="flex gap-3">
          {RESPONSE_OPTIONS.presence.map((label, idx) => {
            const boolVal = idx === 1; // "예" = true, "아니오" = false
            const checked = value === boolVal;
            return (
              <label key={idx} className="radio-option flex-1">
                <input
                  type="radio"
                  name={optionKey}
                  checked={checked}
                  onChange={() => onChange(boolVal)}
                />
                <span className="radio-label text-sm font-medium">{label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  const options = RESPONSE_OPTIONS[question.type];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-500 font-medium whitespace-nowrap">
          {TYPE_LABEL[question.type]}
        </span>
        <p className="text-sm font-medium text-gray-800 leading-relaxed">{question.text}</p>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {options.map((label, idx) => {
          const checked = value === idx;
          return (
            <label key={idx} className="radio-option">
              <input
                type="radio"
                name={optionKey}
                checked={checked}
                onChange={() => onChange(idx)}
              />
              <span className="radio-label">
                <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold
                  ${checked
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-gray-300 text-gray-400"
                  }`}>
                  {idx}
                </span>
                <span className="text-xs leading-tight">{label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
