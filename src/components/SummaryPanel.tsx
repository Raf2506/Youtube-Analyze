import type { AnalysisSummary } from "@/lib/types";

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

export function SummaryPanel({ summary }: { summary: AnalysisSummary }) {
  const { total, positive, negative, neutral } = summary;
  const positivePct = pct(positive, total);
  const negativePct = pct(negative, total);
  const neutralPct = pct(neutral, total);

  return (
    <div className="w-full rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-3 gap-4 text-center">
        <Stat label="Positive" value={positive} percent={positivePct} colorClass="text-amber-600 dark:text-amber-400" />
        <Stat label="Negative" value={negative} percent={negativePct} colorClass="text-indigo-600 dark:text-indigo-400" />
        <Stat label="Neutral" value={neutral} percent={neutralPct} colorClass="text-zinc-500 dark:text-zinc-400" />
      </div>

      <div
        role="img"
        aria-label={`${positivePct}% positive, ${negativePct}% negative, ${neutralPct}% neutral`}
        className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
      >
        {positivePct > 0 && (
          <div className="h-full bg-amber-500 motion-safe:transition-all" style={{ width: `${positivePct}%` }} />
        )}
        {negativePct > 0 && (
          <div className="h-full bg-indigo-500 motion-safe:transition-all" style={{ width: `${negativePct}%` }} />
        )}
        {neutralPct > 0 && (
          <div className="h-full bg-zinc-400 motion-safe:transition-all" style={{ width: `${neutralPct}%` }} />
        )}
      </div>

      <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
        {total.toLocaleString()} comments analyzed · avg. confidence{" "}
        {Math.round(summary.averageConfidence * 100)}%
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  percent,
  colorClass,
}: {
  label: string;
  value: number;
  percent: number;
  colorClass: string;
}) {
  return (
    <div>
      <div className={`text-2xl font-semibold ${colorClass}`}>{percent}%</div>
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        {label} · {value.toLocaleString()}
      </div>
    </div>
  );
}
