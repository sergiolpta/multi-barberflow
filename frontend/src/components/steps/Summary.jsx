// src/components/Summary.jsx

export function Summary({
  profissionalSelecionado,
  servicoSelecionado,
  dataSelecionada,
  horarioSelecionado,
}) {
  if (
    !profissionalSelecionado &&
    !servicoSelecionado &&
    !dataSelecionada &&
    !horarioSelecionado
  ) {
    return null;
  }

  return (
    <div className="mt-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
      {profissionalSelecionado && (
        <div>
          Profissional selecionado:{" "}
          <span className="font-semibold text-slate-200">
            {profissionalSelecionado.nome}
          </span>
        </div>
      )}
      {servicoSelecionado && (
        <div>
          Serviço selecionado:{" "}
          <span className="font-semibold text-slate-200">
            {servicoSelecionado.nome} ({servicoSelecionado.duracao_minutos} min)
          </span>
        </div>
      )}
      {dataSelecionada && (
        <div>
          Data selecionada:{" "}
          <span className="font-semibold text-slate-200">
            {dataSelecionada}
          </span>
        </div>
      )}
      {horarioSelecionado && (
        <div>
          Horário selecionado:{" "}
          <span className="font-semibold text-slate-200">
            {horarioSelecionado}
          </span>
        </div>
      )}
    </div>
  );
}

