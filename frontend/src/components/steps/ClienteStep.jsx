// src/components/ClienteStep.jsx
export function ClienteStep({
  profissionalSelecionado,
  servicoSelecionado,
  dataSelecionada,
  horarioSelecionado,
  clienteNome,
  setClienteNome,
  clienteWhatsapp,
  setClienteWhatsapp,
  clienteNascimento,
  setClienteNascimento,
  agendando,
  onConfirmar,
  agendamentoConfirmado,
  error,
}) {
  const podeEditar =
    profissionalSelecionado &&
    servicoSelecionado &&
    dataSelecionada &&
    horarioSelecionado &&
    !agendando;

  const podeConfirmar = podeEditar && clienteNome.trim() && clienteWhatsapp.trim();

  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold text-slate-300 mb-2">4. Seus dados</h2>

      {(!profissionalSelecionado || !servicoSelecionado || !dataSelecionada || !horarioSelecionado) && (
        <p className="text-xs text-slate-500 mb-2">
          Selecione profissional, serviço, data e horário antes de informar seus dados.
        </p>
      )}

      {error ? (
        <div className="mb-3 text-xs bg-red-900/30 border border-red-700/60 text-red-100 rounded-xl p-3">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 mb-4">
        <div className="flex flex-col">
          <label htmlFor="nome" className="text-xs text-slate-400 mb-1">
            Nome completo
          </label>
          <input
            id="nome"
            type="text"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={clienteNome}
            onChange={(e) => setClienteNome(e.target.value)}
            disabled={!podeEditar}
            placeholder="Seu nome"
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="whatsapp" className="text-xs text-slate-400 mb-1">
            WhatsApp
          </label>
          <input
            id="whatsapp"
            type="tel"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={clienteWhatsapp}
            onChange={(e) => setClienteWhatsapp(e.target.value)}
            disabled={!podeEditar}
            placeholder="(DD) 9XXXX-XXXX"
          />
        </div>

        <div className="flex flex-col sm:col-span-2">
          <label htmlFor="nascimento" className="text-xs text-slate-400 mb-1">
            Data de nascimento (opcional)
          </label>
          <input
            id="nascimento"
            type="date"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={clienteNascimento || ""}
            onChange={(e) => setClienteNascimento(e.target.value)}
            disabled={!podeEditar}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onConfirmar}
        disabled={!podeConfirmar}
        className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors"
      >
        {agendando ? "Confirmando..." : "Confirmar agendamento"}
      </button>

      {agendamentoConfirmado && (
        <div className="mt-4 text-xs bg-emerald-900/20 border border-emerald-500/40 text-emerald-100 rounded-xl p-3">
          <div className="font-semibold text-emerald-200 mb-1">Agendamento confirmado!</div>
          <div>Cliente: {agendamentoConfirmado.cliente_nome}</div>
          <div>Profissional: {agendamentoConfirmado.profissional_nome}</div>
          <div>Serviço: {agendamentoConfirmado.servico_nome}</div>
          <div>
            Data: {agendamentoConfirmado.data} às{" "}
            {agendamentoConfirmado.hora_inicio?.slice(0, 5) ?? horarioSelecionado}
          </div>
          {agendamentoConfirmado.status && <div>Status: {agendamentoConfirmado.status}</div>}
        </div>
      )}
    </section>
  );
}
