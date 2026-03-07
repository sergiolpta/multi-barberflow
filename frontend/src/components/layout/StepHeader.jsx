// src/components/StepHeader.jsx

export function StepHeader({ passo }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-400 mb-6">
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
            passo >= 1
              ? "bg-emerald-500 text-slate-900"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          1
        </div>
        <span>Profissional</span>
      </div>
      <div className="h-px flex-1 bg-slate-700" />
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
            passo >= 2
              ? "bg-sky-500 text-slate-900"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          2
        </div>
        <span>Serviço</span>
      </div>
      <div className="h-px flex-1 bg-slate-700" />
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
            passo >= 3
              ? "bg-violet-500 text-slate-900"
              : "bg-slate-700 text-slate-300"
          }`}
        >
          3
        </div>
        <span>Data & horários</span>
      </div>
    </div>
  );
}

