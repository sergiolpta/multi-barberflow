// src/components/steps/DataHorariosStep.jsx
import React from "react";

export function DataHorariosStep({
  habilitado,
  profissionalSelecionado,
  servicoSelecionado,
  dataSelecionada,
  setDataSelecionada,
  horarios,
  horarioSelecionado,
  setHorarioSelecionado,
  loadingHorarios,
  onBuscarHorarios,
}) {
  // Calcula hoje (min) e hoje + 7 dias (max) no formato YYYY-MM-DD
  const hoje = new Date();
  const minDate = hoje.toISOString().slice(0, 10);

  const maxDateObj = new Date(hoje);
  maxDateObj.setDate(maxDateObj.getDate() + 7);
  const maxDate = maxDateObj.toISOString().slice(0, 10);

  const desabilitado =
    !habilitado || !profissionalSelecionado || !servicoSelecionado;

  const handleChangeData = (e) => {
    const value = e.target.value;
    setDataSelecionada(value);
  };

  const handleBuscarClick = async () => {
    if (!dataSelecionada) return;
    await onBuscarHorarios();
  };

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-2">
        3. Escolha a data e veja os horários
      </h2>

      <p className="text-xs text-slate-400 mb-3">
        Você pode agendar dentro dos próximos{" "}
        <span className="font-semibold text-slate-200">7 dias</span>.
      </p>

      <div
        className={`rounded-xl border px-4 py-4 ${
          desabilitado
            ? "border-slate-700 bg-slate-900/40 opacity-60"
            : "border-slate-700 bg-slate-900/80"
        }`}
      >
        {desabilitado && (
          <p className="text-xs text-slate-500 mb-2">
            Selecione primeiro um profissional e um serviço.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <label className="text-xs text-slate-400">Data</label>
            <input
              type="date"
              className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/80 disabled:opacity-50 disabled:cursor-not-allowed"
              value={dataSelecionada || ""}
              onChange={handleChangeData}
              min={minDate}
              max={maxDate}
              disabled={desabilitado}
            />
          </div>

          <button
            type="button"
            onClick={handleBuscarClick}
            disabled={desabilitado || !dataSelecionada || loadingHorarios}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-emerald-500 text-emerald-100 hover:bg-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loadingHorarios ? "Carregando..." : "Buscar horários"}
          </button>
        </div>

        {/* Lista de horários */}
        <div className="mt-4">
          {loadingHorarios && (
            <p className="text-xs text-slate-400">Carregando horários...</p>
          )}

          {!loadingHorarios && dataSelecionada && horarios.length === 0 && (
            <p className="text-xs text-slate-400">
              Nenhum horário disponível para esta data.
            </p>
          )}

          {!loadingHorarios && horarios.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {horarios.map((hora) => {
                const selecionadoBtn = horarioSelecionado === hora;
                return (
                  <button
                    key={hora}
                    type="button"
                    onClick={() => setHorarioSelecionado(hora)}
                    className={`px-3 py-2 rounded-lg text-sm border transition ${
                      selecionadoBtn
                        ? "bg-emerald-500 text-slate-900 border-emerald-400"
                        : "bg-slate-800 text-slate-100 border-slate-600 hover:border-emerald-500 hover:text-emerald-100"
                    }`}
                  >
                    {hora}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

