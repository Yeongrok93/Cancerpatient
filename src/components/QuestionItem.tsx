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
  severity: "중증도",
  interference: "일상생활 지장",
  presence: "유무",
};

export default function QuestionItem({ itemId, question, value, onChange }: Props) {
  const optionKey = `q-${itemId}-${question.key}`;

  if (question.type === "presence") {
    return (
      <div className="space-y-3">
        <p className="text-lg font-medium text-gray-900 leading-relaxed break-keep">
          {question.text}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {RESPONSE_OPTIONS.presence.map((label, idx) => {
            const boolVal = idx === 1; // "예" = true, "아니오" = false
            const checked = value === boolVal;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onChange(boolVal)}
                aria-pressed={checked}
                className={`choice-pill ${checked ? "choice-pill-active" : "choice-pill-inactive"}`}
              >
                {checked && <span aria-hidden>✓ </span>}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const options = RESPONSE_OPTIONS[question.type];

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="inline-block px-2 py-0.5 text-sm rounded bg-gray-100 text-gray-700 font-semibold">
          {TYPE_LABEL[question.type]}
        </span>
        <p className="text-lg font-medium text-gray-900 leading-relaxed break-keep">{question.text}</p>
      </div>
      <div className="grid grid-cols-5 gap-1 sm:gap-2">
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
                <span className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-base font-bold
                  ${checked
                    ? "border-white bg-white text-primary-700"
                    : "border-gray-400 text-gray-700"
                  }`}>
                  {checked ? "✓" : idx}
                </span>
                <span className="text-base leading-snug break-keep">{label}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
