const toneClasses = {
  slate: "border-[var(--border-color)] bg-[var(--bg-panel-strong)] text-[var(--text-muted)]",
  sky: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-600",
  red: "border-red-500/30 bg-red-500/10 text-red-600",
};

export function Badge({ tone = "slate", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${toneClasses[tone] || toneClasses.slate}`}
    >
      {children}
    </span>
  );
}
