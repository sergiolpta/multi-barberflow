import { useEffect, useState, useCallback, useMemo } from "react";
import { useAdminPacotes } from "../../hooks/useAdminPacotes";
import { Badge } from "../common/Badge";
import { SectionCard } from "../common/SectionCard";
import { formatBRL } from "../../utils/formatters";

function labelDiaSemana(n) {
  const nomes = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return nomes[n] ?? `Dia ${n}`;
}

function formatarData(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR");
}

function competenciaMesAtualISO() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function sortHorarios(horarios) {
  return [...(horarios || [])].sort((a, b) => {
    const diaA = Number(a?.dia_semana ?? 99);
    const diaB = Number(b?.dia_semana ?? 99);
    if (diaA !== diaB) return diaA - diaB;

    const horaA = String(a?.hora_inicio || "");
    const horaB = String(b?.hora_inicio || "");
    return horaA.localeCompare(horaB);
  });
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
  const [horariosPacote, setHorariosPacote] = useState([]);

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

  function limparFormularioPacote() {
    setClienteNome("");
    setProfissionalId("");
    setDiaSemana("1");
    setHoraInicio("09:00");
    setDuracaoMin("30");
    setHorariosPacote([]);
    setVigenciaInicio(hojeISO);
    setVigenciaFim("");
    setObservacoes("");
    setPrecoMensal("");
    setCobrancaAtiva(true);
    setDiaVencimento("");
  }

  function handleAdicionarHorario() {
    setMensagemSucesso("");
    setMensagemErroCriacao("");

    if (!profissionalId) {
      setMensagemErroCriacao("Selecione o profissional antes de adicionar horários.");
      return;
    }

    const dia = Number(diaSemana);
    const dur = Number(duracaoMin);
    const hora = String(horaInicio || "").trim();

    if (!Number.isInteger(dia) || dia < 0 || dia > 6) {
      setMensagemErroCriacao("Dia da semana inválido.");
      return;
    }

    if (!hora) {
      setMensagemErroCriacao("Informe o horário de início.");
      return;
    }

    if (!Number.isFinite(dur) || dur <= 0) {
      setMensagemErroCriacao("Duração inválida.");
      return;
    }

    const duplicado = horariosPacote.some(
      (h) =>
        Number(h.dia_semana) === dia &&
        String(h.hora_inicio) === hora &&
        Number(h.duracao_minutos) === dur
    );

    if (duplicado) {
      setMensagemErroCriacao("Esse horário já foi adicionado ao pacote.");
      return;
    }

    const novoHorario = {
      dia_semana: dia,
      hora_inicio: hora,
      duracao_minutos: dur,
    };

    setHorariosPacote((prev) => sortHorarios([...prev, novoHorario]));
    setMensagemErroCriacao("");
  }

  function handleRemoverHorario(indexToRemove) {
    setHorariosPacote((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }

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

    if (!Array.isArray(horariosPacote) || horariosPacote.length === 0) {
      setMensagemErroCriacao("Adicione pelo menos 1 horário ao pacote.");
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
        vigencia_inicio: vigenciaInicio,
        vigencia_fim: vigenciaFim || null,
        observacoes: observacoes || null,
        ativo: true,
        preco_mensal: precoParsed,
        cobranca_ativa: !!cobrancaAtiva,
        dia_vencimento: diaVenc,
        horarios: horariosPacote.map((h) => ({
          dia_semana: Number(h.dia_semana),
          hora_inicio: h.hora_inicio,
          duracao_minutos: Number(h.duracao_minutos),
        })),
      };

      await criarPacote(payload);

      setMensagemSucesso("Pacote criado com sucesso.");
      limparFormularioPacote();

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
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-sky-500 to-emerald-500" />
          <div className="flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {barbeariaLogoUrl ? (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-3 shadow-xl shadow-black/10">
                  <img
                    src={barbeariaLogoUrl}
                    alt={barbeariaNome || "Logo da barbearia"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-violet-500/10 text-3xl">
                  📦
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Pacotes recorrentes
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Pacotes Fixos"}{" "}
                  <span className="text-[var(--text-muted)]">(Clientes VIP)</span>
                </h1>

                <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)] md:text-[15px]">
                  Crie pacotes semanais recorrentes, reserve horários, controle cobrança mensal e acompanhe o histórico de pagamentos.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                onClick={onVoltarAgenda}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
              >
                Voltar para Agenda
              </button>
              <button
                onClick={onSair}
                className="inline-flex items-center justify-center rounded-xl border border-rose-500/60 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-500/15"
              >
                Sair para Agendamento
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.08fr_1.92fr]">
          <SectionCard
            title="Novo pacote semanal"
            subtitle="Monte um pacote com múltiplos horários recorrentes, vigência e regra de cobrança."
          >
            {mensagemSucesso && (
              <div className="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                {mensagemSucesso}
              </div>
            )}

            {mensagemErroCriacao && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {mensagemErroCriacao}
              </div>
            )}

            <form onSubmit={handleCriarPacote} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Cliente (nome livre)
                  </label>
                  <input
                    type="text"
                    value={clienteNome}
                    onChange={(e) => setClienteNome(e.target.value)}
                    placeholder="Ex.: Sérgio Braz"
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Profissional responsável *
                  </label>
                  <select
                    value={profissionalId}
                    onChange={(e) => setProfissionalId(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
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
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Preço mensal (R$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={precoMensal}
                    onChange={(e) => setPrecoMensal(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                    placeholder="Ex.: 120.00"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Dia de vencimento
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={diaVencimento}
                    onChange={(e) => setDiaVencimento(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                    placeholder="Ex.: 5"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Cobrança ativa
                  </label>
                  <label className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-2.5 text-sm text-[var(--text-app)]">
                    <input
                      type="checkbox"
                      checked={cobrancaAtiva}
                      onChange={(e) => setCobrancaAtiva(e.target.checked)}
                      className="rounded"
                    />
                    Sim
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4">
                <div className="mb-4">
                  <h3 className="text-sm font-bold text-[var(--text-app)]">
                    Horários recorrentes do pacote
                  </h3>
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Você pode adicionar 1 ou vários horários para o mesmo pacote semanal.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex flex-col">
                    <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Dia da semana
                    </label>
                    <select
                      value={diaSemana}
                      onChange={(e) => setDiaSemana(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
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

                  <div className="flex flex-col">
                    <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Horário início
                    </label>
                    <input
                      type="time"
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Duração (minutos)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={duracaoMin}
                      onChange={(e) => setDuracaoMin(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-start">
                  <button
                    type="button"
                    onClick={handleAdicionarHorario}
                    className="inline-flex items-center justify-center rounded-xl border border-sky-500/60 bg-sky-500/10 px-4 py-2.5 text-sm font-medium text-sky-600 transition hover:bg-sky-500/15"
                  >
                    Adicionar horário
                  </button>
                </div>

                <div className="mt-4">
                  {horariosPacote.length > 0 ? (
                    <ul className="space-y-2">
                      {sortHorarios(horariosPacote).map((h, idx) => (
                        <li
                          key={`${h.dia_semana}-${h.hora_inicio}-${h.duracao_minutos}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3"
                        >
                          <div className="text-sm text-[var(--text-app)]">
                            <span className="font-medium">{labelDiaSemana(h.dia_semana)}</span>{" "}
                            • {String(h.hora_inicio).slice(0, 5)} • {h.duracao_minutos} min
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoverHorario(idx)}
                            className="rounded-xl border border-rose-500/60 px-3 py-1.5 text-[11px] font-medium text-rose-600 transition hover:bg-rose-500/10"
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
                      Nenhum horário adicionado ainda.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Vigência início *
                  </label>
                  <input
                    type="date"
                    value={vigenciaInicio}
                    onChange={(e) => setVigenciaInicio(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                    required
                  />
                </div>

                <div className="flex flex-col">
                  <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Vigência fim (opcional)
                  </label>
                  <input
                    type="date"
                    value={vigenciaFim}
                    onChange={(e) => setVigenciaFim(e.target.value)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col">
                <label className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                  Observações (opcional)
                </label>
                <textarea
                  rows={3}
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-violet-500"
                  placeholder="Ex.: Cabelo/Barba"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95"
                >
                  Criar pacote
                </button>
              </div>
            </form>
          </SectionCard>

          <SectionCard
            title="Pacotes cadastrados"
            subtitle="Filtre por profissional, visualize cobrança e registre pagamentos mensais."
            actions={
              <>
                <select
                  value={filtroProfissional}
                  onChange={(e) => setFiltroProfissional(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-[var(--accent-primary)]"
                >
                  <option value="">Todos os profissionais</option>
                  {profissionais?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>

                <label className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-2.5 text-sm text-[var(--text-app)]">
                  <input
                    type="checkbox"
                    checked={somenteAtivos}
                    onChange={(e) => setSomenteAtivos(e.target.checked)}
                    className="rounded"
                  />
                  Somente ativos
                </label>

                <button
                  onClick={handleAtualizarLista}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-panel)]"
                >
                  Atualizar
                </button>
              </>
            }
          >
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--text-muted)]">Forma padrão:</span>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value)}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-app)] outline-none transition focus:border-[var(--accent-primary)]"
              >
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="transferencia">Transferência</option>
              </select>
              <Badge tone="slate">Competência: {competenciaMesAtualISO()}</Badge>
            </div>

            {erroPacotes && (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {erroPacotes}
              </div>
            )}

            {mensagemErroCriacao ? (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
                {mensagemErroCriacao}
              </div>
            ) : null}

            {loadingPacotes ? (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Carregando pacotes...
              </div>
            ) : pacotes && pacotes.length > 0 ? (
              <ul className="space-y-3">
                {pacotes.map((p) => {
                  const horarios = sortHorarios(
                    Array.isArray(p.horarios) && p.horarios.length > 0
                      ? p.horarios
                      : [
                          {
                            dia_semana: p.dia_semana,
                            hora_inicio: p.hora_inicio,
                            duracao_minutos: p.duracao_minutos,
                          },
                        ]
                  );

                  return (
                    <li
                      key={p.id}
                      className="overflow-hidden rounded-[24px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-soft)]"
                    >
                      <div className="flex h-full">
                        <div className={`w-1.5 shrink-0 ${p.ativo ? "bg-emerald-500" : "bg-slate-400"}`} />
                        <div className="flex-1 p-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <Badge tone={p.ativo ? "emerald" : "slate"}>
                                  {p.ativo ? "Ativo" : "Inativo"}
                                </Badge>

                                <Badge tone="sky">
                                  Preço: {formatBRL(p.preco_mensal ?? 0)}
                                </Badge>

                                <Badge tone={p.cobranca_ativa ? "emerald" : "slate"}>
                                  Cobrança: {p.cobranca_ativa ? "Ativa" : "Pausada"}
                                </Badge>

                                {p.dia_vencimento ? (
                                  <Badge tone="amber">Venc.: dia {p.dia_vencimento}</Badge>
                                ) : null}
                              </div>

                              <h3 className="text-base font-bold text-[var(--text-app)]">
                                {p.cliente_nome || "Cliente não informado"}
                              </h3>

                              <div className="mt-2 grid gap-2 text-[12px] text-[var(--text-muted)] sm:grid-cols-2">
                                <div>
                                  <span className="font-semibold text-[var(--text-app)]">Profissional:</span>{" "}
                                  {p.profissional?.nome ||
                                    profMap.get(p.profissional_id)?.nome ||
                                    p.profissional_id}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--text-app)]">Vigência:</span>{" "}
                                  {formatarData(p.vigencia_inicio)}{" "}
                                  {p.vigencia_fim ? `até ${formatarData(p.vigencia_fim)}` : "em aberto"}
                                </div>
                              </div>

                              <div className="mt-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-3">
                                <div className="mb-2 text-[11px] font-medium text-[var(--text-muted)]">
                                  Horários do pacote
                                </div>
                                <div className="space-y-1.5">
                                  {horarios.map((h, idx) => (
                                    <div
                                      key={`${p.id}-${h.id || idx}-${h.dia_semana}-${h.hora_inicio}`}
                                      className="text-sm text-[var(--text-app)]"
                                    >
                                      • {labelDiaSemana(h.dia_semana)} • {String(h.hora_inicio || "").slice(0, 5)} ({h.duracao_minutos} min)
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {p.observacoes && (
                                <div className="mt-3 text-[12px] text-[var(--text-muted)]">
                                  <span className="font-semibold text-[var(--text-app)]">Obs.:</span> {p.observacoes}
                                </div>
                              )}

                              {editandoPrecoId === p.id ? (
                                <div className="mt-4 flex items-center gap-2 flex-wrap">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={novoPreco}
                                    onChange={(e) => setNovoPreco(e.target.value)}
                                    className="w-[160px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                                    placeholder="Ex.: 120.00"
                                  />
                                  <button
                                    onClick={() => salvarPreco(p)}
                                    disabled={salvandoAcaoId === p.id}
                                    className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-60"
                                  >
                                    {salvandoAcaoId === p.id ? "Salvando..." : "Salvar"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditandoPrecoId("");
                                      setNovoPreco("");
                                    }}
                                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)]"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              ) : null}
                            </div>

                            <div className="flex min-w-[240px] flex-col items-start gap-2 lg:items-end">
                              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                <button
                                  onClick={() => abrirEdicaoPreco(p)}
                                  className="rounded-xl border border-sky-500/60 bg-sky-500/10 px-3 py-2 text-[11px] font-medium text-sky-600 transition hover:bg-sky-500/15"
                                >
                                  Editar preço
                                </button>

                                <button
                                  onClick={() => registrarPagamentoDoMes(p)}
                                  disabled={salvandoAcaoId === p.id}
                                  className="rounded-xl border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-700 transition hover:bg-amber-500/15 disabled:opacity-60"
                                >
                                  {salvandoAcaoId === p.id ? "Registrando..." : "Registrar pagamento"}
                                </button>

                                <button
                                  onClick={() => togglePagamentos(p)}
                                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)]"
                                >
                                  {pagamentosAbertosId === p.id ? "Ocultar pagamentos" : "Ver pagamentos"}
                                </button>
                              </div>

                              {p.ativo ? (
                                <button
                                  onClick={() => handleDesativar(p.id)}
                                  disabled={salvandoAcaoId === p.id}
                                  className="rounded-xl border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-[11px] font-medium text-rose-600 transition hover:bg-rose-500/15 disabled:opacity-60"
                                >
                                  Desativar
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleAtivar(p.id)}
                                  disabled={salvandoAcaoId === p.id}
                                  className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-700 transition hover:bg-emerald-500/15 disabled:opacity-60"
                                >
                                  Ativar
                                </button>
                              )}
                            </div>
                          </div>

                          {pagamentosAbertosId === p.id ? (
                            <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                              <div className="mb-3 text-sm font-bold text-[var(--text-app)]">
                                Últimos pagamentos
                              </div>

                              {erroPagamentos ? (
                                <div className="mb-3 text-sm text-rose-600">{erroPagamentos}</div>
                              ) : null}

                              {loadingPagamentos ? (
                                <div className="text-sm text-[var(--text-muted)]">Carregando pagamentos...</div>
                              ) : pagamentos?.length ? (
                                <ul className="space-y-2">
                                  {pagamentos.map((pg) => (
                                    <li
                                      key={pg.id}
                                      className="flex flex-col gap-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <span className="text-sm text-[var(--text-app)]">
                                        {formatarData(pg.competencia)} • {formatBRL(pg.valor)} • {pg.forma_pagamento || "—"}
                                      </span>
                                      <span className="text-[11px] text-[var(--text-muted)]">
                                        {pg.pago_em ? new Date(pg.pago_em).toLocaleString("pt-BR") : "—"}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="text-sm text-[var(--text-muted)]">
                                  Nenhum pagamento registrado.
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Nenhum pacote cadastrado com esses filtros.
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}