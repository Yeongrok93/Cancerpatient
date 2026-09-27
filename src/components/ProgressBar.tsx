interface Props {
  current: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ current, total, label }: Props) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-base text-gray-700">
        <span>{label ?? `${current} / ${total} 문항 완료`}</span>
        <span className="font-bold text-primary-700">{pct}%</span>
      </div>
      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
