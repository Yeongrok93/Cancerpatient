"use client";

// "다음 종양내과 외래는 언제인가요?" — date + time pickers.
//
// Built from plain <select> elements on purpose. Native <input type="date"> / type="time"
// only open their calendar/clock when the small icon is hit (desktop) and behave
// differently on every phone, so a patient tapping the field itself often sees nothing.
// A <select> opens wherever it is tapped, on every device.

export type VisitDraft = {
  year: string; // "2026"
  month: string; // "1".."12"
  day: string; // "1".."31"
  ampm: "" | "AM" | "PM";
  hour: string; // "1".."12"
  minute: string; // "0","5",…,"55"
  unknown: boolean; // "아직 일정이 안 잡혔어요"
};

export const EMPTY_VISIT: VisitDraft = { year: "", month: "", day: "", ampm: "", hour: "", minute: "", unknown: false };

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
  return { y, m, d };
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The picked date as "YYYY-MM-DD" and time as "HH:MM" (24h), or null if anything is missing. */
export function visitDraftValue(v: VisitDraft): { date: string; time: string } | null {
  if (!v.year || !v.month || !v.day || !v.ampm || !v.hour || v.minute === "") return null;
  const y = Number(v.year), m = Number(v.month), d = Number(v.day);
  if (d > daysInMonth(y, m)) return null;
  const h24 = (Number(v.hour) % 12) + (v.ampm === "PM" ? 12 : 0);
  return { date: `${y}-${pad(m)}-${pad(d)}`, time: `${pad(h24)}:${pad(v.minute)}` };
}

/** What gets sent to the server: the picked visit, "unknown", or null while incomplete. */
export function visitDraftInput(v: VisitDraft): { date: string; time: string } | { unknown: true } | null {
  if (v.unknown) return { unknown: true };
  return visitDraftValue(v);
}

function isPast(date: string, time: string) {
  return new Date(`${date}T${time}:00+09:00`).getTime() <= Date.now();
}

/** True when the picked date/time is complete and still in the future. */
export function visitDraftIsValid(v: VisitDraft): boolean {
  if (v.unknown) return true;
  const value = visitDraftValue(v);
  return value !== null && !isPast(value.date, value.time);
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

export default function NextVisitField({
  value,
  onChange,
  showError,
}: {
  value: VisitDraft;
  onChange: (next: VisitDraft) => void;
  showError: boolean;
}) {
  const now = kstNow();
  const set = (patch: Partial<VisitDraft>) => onChange({ ...value, ...patch });

  const years = [now.y, now.y + 1];
  const maxDay = value.year && value.month ? daysInMonth(Number(value.year), Number(value.month)) : 31;
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);

  const picked = visitDraftValue(value);
  const past = picked ? isPast(picked.date, picked.time) : false;
  const summary = picked
    ? (() => {
        const [y, m, d] = picked.date.split("-").map(Number);
        const wd = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
        return `${y}년 ${m}월 ${d}일 (${wd}) ${value.ampm === "AM" ? "오전" : "오후"} ${value.hour}시 ${pad(value.minute)}분`;
      })()
    : null;
  const invalid = showError && !visitDraftIsValid(value);
  const off = value.unknown;

  return (
    <div
      id="next-visit"
      className={`card space-y-4 border-2 ${invalid ? "border-red-500" : "border-transparent"}`}
    >
      <div>
        <p className="text-lg font-semibold text-gray-900 leading-relaxed break-keep">
          다음 종양내과 담당교수님을 뵙는 날은 언제인가요?
        </p>
        <p className="text-base text-gray-700 mt-1">리포트 전달 날짜를 확인하기 위한 질문이에요.</p>
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

      <div className="space-y-2">
        <p className="text-base font-semibold text-gray-800">시간</p>
        <div className="flex flex-wrap items-center gap-2">
          <Select label="오전/오후" value={value.ampm} onChange={(v) => set({ ampm: v as VisitDraft["ampm"] })} placeholder="오전/오후" disabled={off} width="w-[8rem]">
            <option value="AM">오전</option>
            <option value="PM">오후</option>
          </Select>
          <Select label="시" value={value.hour} onChange={(v) => set({ hour: v })} placeholder="시" disabled={off} width="w-[6rem]">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
              <option key={h} value={h}>{h}시</option>
            ))}
          </Select>
          <Select label="분" value={value.minute} onChange={(v) => set({ minute: v })} placeholder="분" disabled={off} width="w-[6rem]">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
              <option key={m} value={m}>{m}분</option>
            ))}
          </Select>
        </div>
      </div>

      {summary && !off && (
        <p className={`text-lg font-bold ${past ? "text-red-700" : "text-primary-800"}`}>
          {past ? "⚠ 이미 지난 시간이에요: " : "✓ "}
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
        {off ? "✓ 아직 일정이 잡히지 않았어요 (다시 누르면 취소)" : "아직 일정이 잡히지 않았어요"}
      </button>

      {invalid && (
        <p className="text-base font-semibold text-red-700">
          ⚠ {past ? "지난 날짜는 선택할 수 없어요. 날짜와 시간을 다시 골라 주세요." : "날짜와 시간을 모두 골라 주세요. 일정이 아직 없으면 위 버튼을 눌러 주세요."}
        </p>
      )}
    </div>
  );
}
