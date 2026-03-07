// src/components/ProfissionalStep.jsx

export function ProfissionalCard({ profissional, onSelect, isSelected }) {
  return (
    <button
      onClick={() => onSelect(profissional)}
      className={`w-full text-left bg-slate-800/70 hover:bg-slate-700 transition-colors border rounded-2xl p-4 flex items-center justify-between gap-3 ${
        isSelected ? "border-emerald-400/80" : "border-slate-700/70"
      }`}
    >
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wide">
          Profissional
        </div>
        <div className="text-lg font-semibold text-slate-50">
          {profissional.nome}
        </div>
        {profissional.whatsapp && (
          <div className="text-xs text-slate-400 mt-1">
            WhatsApp: {profissional.whatsapp}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/40">
          Ativo
        </span>
        {isSelected && (
          <span className="text-[10px] text-emerald-300">
            Selecionado
          </span>
        )}
      </div>
    </button>
  );
}

export function ProfissionalStep({
  profissionais,
  loading,
  selecionado,
  onSelect,
}) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-slate-300 mb-2">
        1. Escolha o profissional
      </h2>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="text-sm text-slate-400">
            Carregando profissionais...
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {profissionais.length === 0 && (
            <p className="text-sm text-slate-400">
              Nenhum profissional encontrado para esta barbearia.
            </p>
          )}

          {profissionais.map((p) => (
            <ProfissionalCard
              key={p.id}
              profissional={p}
              onSelect={onSelect}
              isSelected={selecionado?.id === p.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

