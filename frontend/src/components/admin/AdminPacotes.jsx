// src/components/admin/AdminPacotes.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminPacotes } from "../../hooks/useAdminPacotes";

// helper para dia_semana (0–6) -> nome
function labelDiaSemana(n) {
  const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return nomes[n] ?? `Dia ${n}`;
}

function formatarData(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function formatBRL(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function competenciaMesAtualISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

export function AdminPacotes({
  profissionais,
  accessToken,
  barbeariaNome,
  barbeariaLogoUrl,
  onVoltarAgenda,
  onSair,
}) {
  const [filtroProfissional, setFiltroProfissional] = useState("");
  const [somenteAtivos, setSomenteAtivos] = useState(true);

  const [clienteNome, setClienteNome] = useState("");
  const [profissionalId, setProfissionalId] = useState("");
  const [diaSemana, setDiaSemana] = useState("1");
  const [horaInicio, setHoraInicio] = useState("09:00");
  const [duracaoMin, setDuracaoMin] = useState("30");
  const hojeISO = new Date().toISOString().slice(0, 10);
  const [vigenciaInicio, setVigenciaInicio] = useState(hojeISO);
  const [vigenciaFim, setVigenciaFim] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [precoMensal, setPrecoMensal] = useState("");
  const [cobrancaAtiva, setCobrancaAtiva] = useState(true);
  const [diaVencimento, setDiaVencimento] = useState("");

  const [mensagemSucesso, setMensagemSucesso] = useState("");
  const [mensagemErroCriacao, setMensagemErroCriacao] = useState("");

  const [salvandoAcaoId, setSalvandoAcaoId] = useState("");

  const [editandoPrecoId, setEditandoPrecoId] = useState("");
  const [novoPreco, setNovoPreco] = useState("");

  const [pagamentosAbertosId, setPagamentosAbertosId] = useState("");
  const [pagamentos, setPagamentos] = useState([]);
  const [loadingPagamentos, setLoadingPagamentos] = useState(false);
  const [erroPagamentos, setErroPagamentos] = useState("");

  const [formaPagamento, setFormaPagamento] = useState("pix");

  const {
    pacotes,
    loadingPacotes,
    erroPacotes,
    listarPacotes,
    criarPacote,
    atualizarPacote,
    desativarPacote,
    listarPagamentosPacote,
    registrarPagamentoPacote,
  } = useAdminPacotes({ accessToken });

  const handleAtualizarLista = useCallback(async () => {
    if (!accessToken) return;

    await listarPacotes({
      profissionalId: filtroProfissional || undefined,
      somenteAtivos,
    });
  }, [accessToken, listarPacotes, filtroProfissional, somenteAtivos]);

  useEffect(() => {
    setMensagemSucesso("");
    setMensagemErroCriacao("");
    handleAtualizarLista();
  }, [handleAtualizarLista]);

  const profMap = useMemo(() => {
    const m = new Map();
    (profissionais || []).forEach((p) => m.set(p.id, p));
    return m;
  }, [profissionais]);

  async function handleCriarPacote(e) {
    e.preventDefault();
    setMensagemSucesso("");
    setMensagemErroCriacao("");

    if (!profissionalId) {
      setMensagemErroCriacao("Selecione um profissional.");
      return;
    }

    if (!vigenciaInicio) {
      setMensagemErroCriacao("Informe a data de início da vigência.");
      return;
    }

    let precoParsed = null;
    if (String(precoMensal).trim() !== "") {
      const n = Number(String(precoMensal).replace(",", "."));
      if (!Number.isFinite(n) || n < 0) {
        setMensagemErroCriacao("Preço mensal inválido (use número >= 0).");
        return;
      }
      precoParsed = n;
    }

    let diaVenc = null;
    if (String(diaVencimento).trim() !== "") {
      const n = Number(diaVencimento);
      if (!Number.isInteger(n) || n < 1 || n > 31) {
        setMensagemErroCriacao("Dia de vencimento inválido (1 a 31).");
        return;
      }
      diaVenc = n;
    }

    try {
      const payload = {
        cliente_nome: clienteNome || null,
        profissional_id: profissionalId,
        dia_semana: Number(diaSemana),
        hora_inicio: horaInicio,
        duracao_minutos: Number(duracaoMin),
        vigencia_inicio: vigenciaInicio,
        vigencia_fim: vigenciaFim || null,
        observacoes: observacoes || null,
        ativo: true,
        preco_mensal: precoParsed,
        cobranca_ativa: !!cobrancaAtiva,
        dia_vencimento: diaVenc,
      };

      await criarPacote(payload);

      setMensagemSucesso("Pacote criado com sucesso.");
      setClienteNome("");
      setObservacoes("");
      setPrecoMensal("");
      setCobrancaAtiva(true);
      setDiaVencimento("");

      await handleAtualizarLista();
    } catch (err) {
      console.error("Erro ao criar pacote:", err);
      setMensagemErroCriacao(err.message || "Erro ao criar pacote. Tente novamente.");
    }
  }

  async function handleDesativar(id) {
    try {
      setMensagemSucesso("");
      setMensagemErroCriacao("");
      setSalvandoAcaoId(id);

      await desativarPacote(id);
      await handleAtualizarLista();
    } catch (err) {
      console.error("Erro ao desativar pacote:", err);
      alert(err.message || "Erro ao desativar pacote.");
    } finally {
      setSalvandoAcaoId("");
    }
  }

  async function handleAtivar(id) {
    try {
      setMensagemSucesso("");
      setMensagemErroCriacao("");
      setSalvandoAcaoId(id);

      await atualizarPacote(id, { ativo: true });
      await handleAtualizarLista();
    } catch (err) {
      console.error("Erro ao ativar pacote:", err);
      alert(err.message || "Erro ao ativar pacote.");
    } finally {
      setSalvandoAcaoId("");
    }
  }

  function abrirEdicaoPreco(p) {
    setEditandoPrecoId(p.id);
    setNovoPreco(String(p.preco_mensal ?? ""));
  }

  async function salvarPreco(p) {
    setMensagemSucesso("");
    setMensagemErroCriacao("");

    const raw = String(novoPreco).trim();
    if (raw === "") {
      try {
        setSalvandoAcaoId(p.id);
        await atualizarPacote(p.id, { preco_mensal: null });
        setEditandoPrecoId("");
        setNovoPreco("");
        await handleAtualizarLista();
        return;
      } catch (e) {
        setMensagemErroCriacao(e?.message || "Erro ao limpar preço.");
        return;
      } finally {
        setSalvandoAcaoId("");
      }
    }

    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < 0) {
      setMensagemErroCriacao("Preço inválido (use número >= 0).");
      return;
    }

    try {
      setSalvandoAcaoId(p.id);
      await atualizarPacote(p.id, { preco_mensal: n });
      setEditandoPrecoId("");
      setNovoPreco("");
      await handleAtualizarLista();
    } catch (e) {
      setMensagemErroCriacao(e?.message || "Erro ao atualizar preço.");
    } finally {
      setSalvandoAcaoId("");
    }
  }

  async function togglePagamentos(p) {
    setErroPagamentos("");
    if (pagamentosAbertosId === p.id) {
      setPagamentosAbertosId("");
      setPagamentos([]);
      return;
    }

    try {
      setLoadingPagamentos(true);
      setPagamentosAbertosId(p.id);
      const resp = await listarPagamentosPacote({ pacoteId: p.id, limit: 24 });
      setPagamentos(Array.isArray(resp?.pagamentos) ? resp.pagamentos : Array.isArray(resp) ? resp : []);
    } catch (e) {
      setErroPagamentos(e?.message || "Erro ao listar pagamentos.");
      setPagamentos([]);
    } finally {
      setLoadingPagamentos(false);
    }
  }

  async function registrarPagamentoDoMes(p) {
    setMensagemSucesso("");
    setMensagemErroCriacao("");
    setErroPagamentos("");

    const preco = Number(p.preco_mensal ?? 0);
    if (p.cobranca_ativa && (!Number.isFinite(preco) || preco <= 0)) {
      setMensagemErroCriacao("Defina um preço mensal > 0 antes de registrar pagamento (cobrança ativa).");
      return;
    }

    try {
      setSalvandoAcaoId(p.id);
      const competencia = competenciaMesAtualISO();

      await registrarPagamentoPacote({
        pacoteId: p.id,
        competencia,
        forma_pagamento: formaPagamento,
      });

      setMensagemSucesso(`Pagamento registrado (${competencia}) via ${formaPagamento}.`);

      if (pagamentosAbertosId === p.id) {
        const resp = await listarPagamentosPacote({ pacoteId: p.id, limit: 24 });
        setPagamentos(Array.isArray(resp?.pagamentos) ? resp.pagamentos : Array.isArray(resp) ? resp : []);
      }
    } catch (e) {
      const status = e?.status;
      if (status === 409) {
        setMensagemSucesso("Este mês já está pago para esse pacote. (Nada foi duplicado)");

        try {
          setLoadingPagamentos(true);
          setPagamentosAbertosId(p.id);
          const resp = await listarPagamentosPacote({ pacoteId: p.id, limit: 24 });
          setPagamentos(Array.isArray(resp?.pagamentos) ? resp.pagamentos : Array.isArray(resp) ? resp : []);
        } catch (err2) {
          setErroPagamentos(err2?.message || "Erro ao listar pagamentos.");
          setPagamentos([]);
        } finally {
          setLoadingPagamentos(false);
        }

        return;
      }

      setMensagemErroCriacao(e?.message || "Erro ao registrar pagamento.");
    } finally {
      setSalvandoAcaoId("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-center gap-4">
            {barbeariaLogoUrl ? (
              <div className="h-16 w-16 rounded-2xl bg-white/95 p-2 shadow-lg shadow-black/20 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={barbeariaLogoUrl}
                  alt={barbeariaNome || "Logo da barbearia"}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}

            <div>
              <h1 className="text-2xl font-bold text-slate-50">
                {barbeariaNome || "Pacotes Fixos"} <span className="text-slate-400">(Clientes VIP)</span>
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Configure horários semanais reservados por cliente. Pagamento mensal é registrado no financeiro.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onVoltarAgenda}
              className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
            >
              Voltar para Agenda
            </button>
            <button
              onClick={onSair}
              className="text-xs px-3 py-1 rounded-lg border border-rose-600 text-rose-200 hover:bg-rose-800/40 transition"
            >
              Sair para Agendamento
            </button>
          </div>
        </header>

        <div className="grid md:grid-cols-[1.3fr_1.7fr] gap-6">
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4">
            <h2 className="font-semibold text-slate-100 mb-3">
              Novo pacote semanal
            </h2>

            {mensagemSucesso && (
              <div className="bg-emerald-900/40 border border-emerald-600 text-emerald-100 text-xs px-3 py-2 rounded-lg mb-3">
                {mensagemSucesso}
              </div>
            )}

            {mensagemErroCriacao && (
              <div className="bg-red-900/40 border border-red-600 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                {mensagemErroCriacao}
              </div>
            )}

            <form onSubmit={handleCriarPacote} className="space-y-3 text-xs">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Cliente (nome livre)
                </label>
                <input
                  type="text"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  placeholder="Ex.: Sérgio Braz"
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Profissional *
                </label>
                <select
                  value={profissionalId}
                  onChange={(e) => setProfissionalId(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                  required
                >
                  <option value="">
                    {profissionais?.length
                      ? "Selecione um profissional"
                      : "Nenhum profissional cadastrado"}
                  </option>
                  {profissionais?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">
                    Preço mensal (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precoMensal}
                    onChange={(e) => setPrecoMensal(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                    placeholder="Ex.: 120.00"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">
                    Cobrança ativa
                  </label>
                  <label className="inline-flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1">
                    <input
                      type="checkbox"
                      checked={cobrancaAtiva}
                      onChange={(e) => setCobrancaAtiva(e.target.checked)}
                      className="rounded border-slate-600 bg-slate-800"
                    />
                    <span className="text-xs text-slate-200">Sim</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Dia de vencimento (opcional)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  step="1"
                  value={diaVencimento}
                  onChange={(e) => setDiaVencimento(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                  placeholder="Ex.: 5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">
                    Dia da semana *
                  </label>
                  <select
                    value={diaSemana}
                    onChange={(e) => setDiaSemana(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                  >
                    <option value="0">Domingo</option>
                    <option value="1">Segunda</option>
                    <option value="2">Terça</option>
                    <option value="3">Quarta</option>
                    <option value="4">Quinta</option>
                    <option value="5">Sexta</option>
                    <option value="6">Sábado</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">
                    Horário início *
                  </label>
                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Duração (minutos) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={duracaoMin}
                  onChange={(e) => setDuracaoMin(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">
                    Vigência início *
                  </label>
                  <input
                    type="date"
                    value={vigenciaInicio}
                    onChange={(e) => setVigenciaInicio(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400">
                    Vigência fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={vigenciaFim}
                    onChange={(e) => setVigenciaFim(e.target.value)}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-slate-400">
                  Observações (opcional)
                </label>
                <textarea
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs resize-none"
                  placeholder="Ex.: Cabelo/Barba"
                />
              </div>

              <button
                type="submit"
                className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-semibold text-slate-900 transition"
              >
                Criar pacote
              </button>
            </form>
          </section>

          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 text-xs">
            <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
              <h2 className="font-semibold text-slate-100">
                Pacotes cadastrados
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filtroProfissional}
                  onChange={(e) => setFiltroProfissional(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
                >
                  <option value="">Todos os profissionais</option>
                  {profissionais?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <input
                    type="checkbox"
                    checked={somenteAtivos}
                    onChange={(e) => setSomenteAtivos(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800"
                  />
                  Somente ativos
                </label>

                <button
                  onClick={handleAtualizarLista}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                >
                  Atualizar
                </button>
              </div>
            </div>

            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-slate-500">Forma de pagamento padrão:</span>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
              </select>
              <span className="text-[11px] text-slate-500">
                Competência: {competenciaMesAtualISO()}
              </span>
            </div>

            {erroPacotes && (
              <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                {erroPacotes}
              </div>
            )}

            {mensagemErroCriacao ? (
              <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                {mensagemErroCriacao}
              </div>
            ) : null}

            {loadingPacotes ? (
              <p className="text-slate-400 text-xs">Carregando pacotes...</p>
            ) : pacotes && pacotes.length > 0 ? (
              <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {pacotes.map((p) => (
                  <li
                    key={p.id}
                    className="bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <div className="font-semibold text-slate-100 text-[13px]">
                          {labelDiaSemana(p.dia_semana)} • {p.hora_inicio?.slice(0, 5)} ({p.duracao_minutos} min)
                        </div>
                        <div className="text-slate-300 text-[12px]">
                          {p.cliente_nome || "Cliente não informado"}
                        </div>

                        <div className="text-slate-400 text-[11px] mt-1">
                          Profissional: {p.profissional?.nome || profMap.get(p.profissional_id)?.nome || p.profissional_id}
                        </div>

                        <div className="text-slate-500 text-[11px] mt-1">
                          Vigência: {formatarData(p.vigencia_inicio)}{" "}
                          {p.vigencia_fim ? `até ${formatarData(p.vigencia_fim)}` : "em aberto"}
                        </div>

                        <div className="text-slate-300 text-[11px] mt-2 flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full border border-slate-600 bg-slate-900/40">
                            Preço: <b>{formatBRL(p.preco_mensal ?? 0)}</b>
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full border ${
                              p.cobranca_ativa
                                ? "border-emerald-500/60 text-emerald-300 bg-emerald-500/10"
                                : "border-slate-600 text-slate-300 bg-slate-900/40"
                            }`}
                          >
                            Cobrança: <b>{p.cobranca_ativa ? "Ativa" : "Pausada"}</b>
                          </span>
                          {p.dia_vencimento ? (
                            <span className="px-2 py-0.5 rounded-full border border-slate-600 bg-slate-900/40">
                              Venc.: <b>dia {p.dia_vencimento}</b>
                            </span>
                          ) : null}
                        </div>

                        {p.observacoes && (
                          <div className="text-slate-500 text-[11px] mt-1">
                            Obs.: {p.observacoes}
                          </div>
                        )}

                        {editandoPrecoId === p.id ? (
                          <div className="mt-3 flex items-center gap-2 flex-wrap">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={novoPreco}
                              onChange={(e) => setNovoPreco(e.target.value)}
                              className="bg-slate-900/60 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-xs w-[140px]"
                              placeholder="Ex.: 120.00"
                            />
                            <button
                              onClick={() => salvarPreco(p)}
                              disabled={salvandoAcaoId === p.id}
                              className="text-[11px] px-2 py-1 rounded-lg border border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/30 transition disabled:opacity-60"
                            >
                              {salvandoAcaoId === p.id ? "Salvando..." : "Salvar"}
                            </button>
                            <button
                              onClick={() => {
                                setEditandoPrecoId("");
                                setNovoPreco("");
                              }}
                              className="text-[11px] px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-900/40 transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : null}
                      </div>

                      <div className="text-right flex flex-col items-end gap-2">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            p.ativo
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/60"
                              : "bg-slate-700/60 text-slate-300 border border-slate-600"
                          }`}
                        >
                          {p.ativo ? "Ativo" : "Inativo"}
                        </span>

                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <button
                            onClick={() => abrirEdicaoPreco(p)}
                            className="text-[11px] px-2 py-1 rounded-lg border border-sky-500/60 text-sky-200 hover:bg-sky-900/30 transition"
                          >
                            Editar preço
                          </button>

                          <button
                            onClick={() => registrarPagamentoDoMes(p)}
                            disabled={salvandoAcaoId === p.id}
                            className="text-[11px] px-2 py-1 rounded-lg border border-amber-500/60 text-amber-200 hover:bg-amber-900/30 transition disabled:opacity-60"
                          >
                            {salvandoAcaoId === p.id ? "Registrando..." : "Registrar pagamento"}
                          </button>

                          <button
                            onClick={() => togglePagamentos(p)}
                            className="text-[11px] px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-900/40 transition"
                          >
                            {pagamentosAbertosId === p.id ? "Ocultar pagamentos" : "Ver pagamentos"}
                          </button>
                        </div>

                        {p.ativo ? (
                          <button
                            onClick={() => handleDesativar(p.id)}
                            disabled={salvandoAcaoId === p.id}
                            className="text-[11px] px-2 py-1 rounded-lg border border-rose-500/60 text-rose-300 hover:bg-rose-900/40 transition disabled:opacity-60"
                          >
                            Desativar
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAtivar(p.id)}
                            disabled={salvandoAcaoId === p.id}
                            className="text-[11px] px-2 py-1 rounded-lg border border-emerald-500/60 text-emerald-300 hover:bg-emerald-900/40 transition disabled:opacity-60"
                          >
                            Ativar
                          </button>
                        )}
                      </div>
                    </div>

                    {pagamentosAbertosId === p.id ? (
                      <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/40 p-3">
                        <div className="text-[11px] text-slate-400 mb-2">
                          Últimos pagamentos
                        </div>

                        {erroPagamentos ? (
                          <div className="text-[11px] text-rose-200">{erroPagamentos}</div>
                        ) : null}

                        {loadingPagamentos ? (
                          <div className="text-[11px] text-slate-500">Carregando pagamentos...</div>
                        ) : pagamentos?.length ? (
                          <ul className="space-y-2 text-[11px]">
                            {pagamentos.map((pg) => (
                              <li key={pg.id} className="flex items-center justify-between gap-2">
                                <span className="text-slate-200">
                                  {formatarData(pg.competencia)} • {formatBRL(pg.valor)} • {pg.forma_pagamento || "—"}
                                </span>
                                <span className="text-slate-500">
                                  {pg.pago_em ? new Date(pg.pago_em).toLocaleString("pt-BR") : "—"}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-[11px] text-slate-500">Nenhum pagamento registrado.</div>
                        )}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500 text-xs">
                Nenhum pacote cadastrado com esses filtros.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}