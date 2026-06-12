type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  trend?: { text: string; positive?: boolean };
};

export default function KpiCard({ label, value, hint, trend }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-900">{value}</p>
      {trend ? (
        <p
          className={`mt-1 text-xs font-medium ${
            trend.positive === true
              ? "text-emerald-600"
              : trend.positive === false
                ? "text-red-600"
                : "text-zinc-500"
          }`}
        >
          {trend.text}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}
