interface Props {
  current: number;
  total: number;
  label?: string;
}

export default function ProgressBar({ current, total, label }: Props) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label ?? `${current} / ${total} 문항 완료`}</span>
        <span className="font-semibold text-primary-600">{pct}%</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
