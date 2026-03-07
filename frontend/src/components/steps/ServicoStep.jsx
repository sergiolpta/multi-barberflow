// src/components/ServicoStep.jsx

export function ServicoCard({ servico, onSelect, isSelected }) {
  return (
    <button
      onClick={() => onSelect(servico)}
      className={`w-full text-left bg-slate-800/70 hover:bg-slate-700 transition-colors border rounded-2xl p-4 flex items-center justify-between gap-3 ${
        isSelected ? "border-sky-400/80" : "border-slate-700/70"
      }`}
    >
      <div>
        <div className="text-xs text-slate-400 uppercase tracking-wide">
          Serviço
        </div>
        <div className="text-lg font-semibold text-slate-50">
          {servico.nome}
        </div>
        <div className="text-xs text-slate-400 mt-1 flex gap-3">
          <span>Duração: {servico.duracao_minutos} min</span>
          {servico.preco != null && (
            <span>
              Preço:{" "}
              {Number(servico.preco).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export function ServicoStep({
  servicos,
  loading,
  selecionado,
  onSelect,
  habilitado,
  profissionalSelecionado,
}) {
  return (
    <section
      className={habilitado ? "mb-6" : "mb-6 opacity-40 pointer-events-none"}
    >
      <h2 className="text-sm font-semibold text-slate-300 mb-2">
        2. Escolha o serviço
      </h2>

      {!profissionalSelecionado && (
        <p className="text-xs text-slate-500 mb-2">
          Primeiro selecione um profissional para habilitar os serviços.
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="text-sm text-slate-400">
            Carregando serviços...
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {servicos.length === 0 && (
            <p className="text-sm text-slate-400">
              Nenhum serviço cadastrado para esta barbearia.
            </p>
          )}

          {servicos.map((s) => (
            <ServicoCard
              key={s.id}
              servico={s}
              onSelect={onSelect}
              isSelected={selecionado?.id === s.id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

