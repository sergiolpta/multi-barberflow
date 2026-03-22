export function SectionCard({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-[26px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-panel)] backdrop-blur-xl md:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-app)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
