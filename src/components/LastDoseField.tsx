"use client";

// "마지막 표적항암제 투여일은 언제였나요?" — a date picker built from plain <select> elements,
// for the same reason as NextVisitField (a <select> opens wherever it is tapped, on every device).

export type DoseDraft = {
  year: string; // "2026"
  month: string; // "1".."12"
  day: string; // "1".."31"
  unknown: boolean; // "기억나지 않거나 아직 투여받지 않았어요"
};

export const EMPTY_DOSE: DoseDraft = { year: "", month: "", day: "", unknown: false };

const pad = (n: number | string) => String(n).padStart(2, "0");
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** Today in Korea as numbers, whatever the device's time zone is. */
function kstNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [y, m, d] = parts.split("-").map(Number);
  return { y, m, d, iso: parts };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The picked date as "YYYY-MM-DD", or null if anything is missing or the day does not exist. */
export function doseDraftDate(v: DoseDraft): string | null {
  if (!v.year || !v.month || !v.day) return null;
  const y = Number(v.year), m = Number(v.month), d = Number(v.day);
  if (d > daysInMonth(y, m)) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** What gets sent to the server: the picked date, "unknown", or null while incomplete. */
export function doseDraftInput(v: DoseDraft): { date: string } | { unknown: true } | null {
  if (v.unknown) return { unknown: true };
  const date = doseDraftDate(v);
  return date ? { date } : null;
}

/** True when the picked date is complete and not in the future. */
export function doseDraftIsValid(v: DoseDraft): boolean {
  if (v.unknown) return true;
  const date = doseDraftDate(v);
  return date !== null && date <= kstNow().iso;
}

function Select({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  children,
  width,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled: boolean;
  children: React.ReactNode;
  width: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${width} min-h-[56px] px-2 border-2 border-gray-300 rounded-xl text-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:bg-gray-100 disabled:text-gray-400`}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}

export default function LastDoseField({
  value,
  onChange,
  showError,
}: {
  value: DoseDraft;
  onChange: (next: DoseDraft) => void;
  showError: boolean;
}) {
  const now = kstNow();
  const set = (patch: Partial<DoseDraft>) => onChange({ ...value, ...patch });

  const years = [now.y, now.y - 1, now.y - 2];
  const maxDay = value.year && value.month ? daysInMonth(Number(value.year), Number(value.month)) : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const picked = doseDraftDate(value);
  const future = picked ? picked > now.iso : false;
  const summary = picked
    ? (() => {
        const [y, m, d] = picked.split("-").map(Number);
        const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
        return `${y}년 ${m}월 ${d}일 (${wd})`;
      })()
    : null;
  const invalid = showError && !doseDraftIsValid(value);
  const off = value.unknown;

  return (
    <div
      id="last-dose"
      className={`card space-y-4 border-2 ${invalid ? "border-red-500" : "border-transparent"}`}
    >
      <div>
        <p className="text-lg font-semibold text-gray-900 leading-relaxed break-keep">
          마지막 <strong className="font-extrabold">표적항암제</strong>(예: 캐싸일라, 엔허투 등) 투여일은 언제였나요?
        </p>
        <p className="text-base text-gray-700 mt-1">가장 최근에 맞으신 날짜를 골라 주세요.</p>
      </div>

      <div className="space-y-2">
        <p className="text-base font-semibold text-gray-800">날짜</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select label="연도" value={value.year} onChange={(v) => set({ year: v })} placeholder="연도" disabled={off} width="w-[7.5rem]">
            {years.map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </Select>
          <Select
            label="월"
            value={value.month}
            onChange={(v) => set({ month: v, day: value.day && Number(value.day) > daysInMonth(Number(value.year || now.y), Number(v)) ? "" : value.day })}
            placeholder="월"
            disabled={off}
            width="w-[6rem]"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}월</option>
            ))}
          </Select>
          <Select label="일" value={value.day} onChange={(v) => set({ day: v })} placeholder="일" disabled={off} width="w-[6rem]">
            {days.map((d) => (
              <option key={d} value={d}>{d}일</option>
            ))}
          </Select>
        </div>
      </div>

      {summary && !off && (
        <p className={`text-lg font-bold ${future ? "text-red-700" : "text-primary-800"}`}>
          {future ? "⚠ 아직 오지 않은 날짜예요: " : "✓ "}
          {summary}
        </p>
      )}

      <button
        type="button"
        aria-pressed={off}
        onClick={() => set({ unknown: !off })}
        className={`w-full min-h-[56px] px-4 py-3 rounded-xl border-2 text-lg font-semibold transition-colors ${
          off ? "bg-gray-700 border-gray-800 text-white" : "bg-white border-gray-400 text-gray-800 hover:bg-gray-50"
        }`}
      >
        {off ? "✓ 기억나지 않거나 아직 투여받지 않았어요 (다시 누르면 취소)" : "기억나지 않거나 아직 투여받지 않았어요"}
      </button>

      {invalid && (
        <p className="text-base font-semibold text-red-700">
          ⚠ {future ? "오늘 이후의 날짜는 선택할 수 없어요. 날짜를 다시 골라 주세요." : "연도, 월, 일을 모두 골라 주세요. 기억나지 않으면 위 버튼을 눌러 주세요."}
        </p>
      )}
    </div>
  );
}
