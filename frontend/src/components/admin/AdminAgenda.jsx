// src/components/admin/AdminAgenda.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminAgenda } from "../../hooks/useAdminAgenda";
import { apiFetch } from "../../config/api";

/**
 * Props esperadas:
 * - accessToken
 * - barbeariaNome
 * - barbeariaLogoUrl
 * - adminRole
 * - onVoltar
 * - onIrFinanceiro (opcional)
 */
export function AdminAgenda({
  accessToken,
  barbeariaNome,
  barbeariaLogoUrl,
  adminRole,
  onVoltar,
  onIrFinanceiro,
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [dataAgenda, setDataAgenda] = useState(hoje);
  const [profissionalFiltro, setProfissionalFiltro] = useState("");

  const [profissionais, setProfissionais] = useState([]);
  const [loadingProfissionais, setLoadingProfissionais] = useState(false);
  const [erroProfissionais, setErroProfissionais] = useState(null);

  const podeGerirAgenda = ["admin_owner", "admin_staff"].includes(adminRole);
  const podeVerFinanceiro = adminRole === "admin_owner";

  const {
    agenda,
    loadingAgenda,
    erroAgenda,
    recarregarAgenda,
    reagendarAgendamento,
    cancelarAgendamento,
    adicionarExtrasAgendamento,
  } = useAdminAgenda({
    data: dataAgenda,
    profissionalId: profissionalFiltro || null,
    accessToken,
    
  });

  useEffect(() => {
    let alive = true;

    async function carregarProfissionais() {
      if (!accessToken) return;

      setLoadingProfissionais(true);
      setErroProfissionais(null);

      try {
        const data = await apiFetch("/profissionais/admin", {
          method: "GET",
          accessToken,
        });

        const lista = Array.isArray(data) ? data : data?.data || [];

        if (!alive) return;
        setProfissionais(lista || []);
      } catch (err) {
        if (!alive) return;
        setErroProfissionais(err?.message || "Erro ao carregar profissionais.");
        setProfissionais([]);
      } finally {
        if (!alive) return;
        setLoadingProfissionais(false);
      }
    }

    carregarProfissionais();

    return () => {
      alive = false;
    };
  }, [accessToken]);

  function toNumberOrNull(v) {
    if (v == null) return null;
    const s = String(v).trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  function onlyDigits(str) {
    return String(str || "").replace(/\D/g, "");
  }

  function fmtBRDate(iso) {
    const s = String(iso || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  function extractHorariosArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.horarios_disponiveis)) return payload.horarios_disponiveis;
    if (Array.isArray(payload?.horarios)) return payload.horarios;

    const inner = payload?.data;
    if (Array.isArray(inner)) return inner;
    if (Array.isArray(inner?.horarios_disponiveis)) return inner.horarios_disponiveis;
    if (Array.isArray(inner?.horarios)) return inner.horarios;

    return [];
  }

  const [bloqueioProfissionalId, setBloqueioProfissionalId] = useState("");
  const [bloqueioData, setBloqueioData] = useState(hoje);
  const [bloqueioDiaInteiro, setBloqueioDiaInteiro] = useState(false);
  const [bloqueioHoraInicio, setBloqueioHoraInicio] = useState("09:00");
  const [bloqueioHoraFim, setBloqueioHoraFim] = useState("18:00");
  const [bloqueioLoading, setBloqueioLoading] = useState(false);
  const [bloqueioErro, setBloqueioErro] = useState(null);
  const [bloqueioSucesso, setBloqueioSucesso] = useState(null);

  async function handleCriarBloqueio(e) {
    e.preventDefault();
    setBloqueioErro(null);
    setBloqueioSucesso(null);

    if (!podeGerirAgenda) {
      setBloqueioErro("Seu perfil não tem permissão para bloquear horários.");
      return;
    }

    if (!accessToken) {
      setBloqueioErro("Sessão inválida. Faça login novamente.");
      return;
    }

    const profissionalIdUsado = bloqueioProfissionalId || profissionalFiltro || "";

    if (!profissionalIdUsado) {
      setBloqueioErro("Selecione um profissional para bloquear.");
      return;
    }

    if (!bloqueioData) {
      setBloqueioErro("Selecione uma data para o bloqueio.");
      return;
    }

    let hora_inicio = bloqueioHoraInicio;
    let hora_fim = bloqueioHoraFim;

    if (bloqueioDiaInteiro) {
      hora_inicio = "00:00:00";
      hora_fim = "23:59:00";
    } else {
      if (!hora_inicio || !hora_fim) {
        setBloqueioErro("Informe hora inicial e hora final para o bloqueio.");
        return;
      }
      if (hora_inicio.length === 5) hora_inicio = `${hora_inicio}:00`;
      if (hora_fim.length === 5) hora_fim = `${hora_fim}:00`;
    }

    try {
      setBloqueioLoading(true);

      await apiFetch("/bloqueios", {
        method: "POST",
        accessToken,
        body: JSON.stringify({
          profissional_id: profissionalIdUsado,
          data: bloqueioData,
          hora_inicio,
          hora_fim,
          motivo: "Bloqueio criado pelo painel admin",
        }),
      });

      setBloqueioSucesso("Bloqueio criado com sucesso.");
      if (bloqueioData === dataAgenda) {
        await recarregarAgenda();
      }
    } catch (err) {
      console.error("Erro inesperado ao criar bloqueio:", err);
      setBloqueioErro(err?.message || "Erro inesperado ao criar bloqueio de agenda.");
    } finally {
      setBloqueioLoading(false);
    }
  }

  const [novoOpen, setNovoOpen] = useState(false);
  const [novoSaving, setNovoSaving] = useState(false);
  const [novoErro, setNovoErro] = useState(null);
  const [novoSucesso, setNovoSucesso] = useState(null);

  const [novoProfissionalId, setNovoProfissionalId] = useState("");
  const [novoServicoId, setNovoServicoId] = useState("");
  const [novoData, setNovoData] = useState(hoje);
  const [novoHora, setNovoHora] = useState("");

  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteSugestoes, setClienteSugestoes] = useState([]);
  const [clienteSugLoading, setClienteSugLoading] = useState(false);
  const [clienteSugErro, setClienteSugErro] = useState(null);

  const [clienteId, setClienteId] = useState(null);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [clienteNascimento, setClienteNascimento] = useState("");

  const debounceRef = useRef(null);

  function abrirNovoAgendamento() {
    setNovoErro(null);
    setNovoSucesso(null);
    setNovoSaving(false);

    setNovoProfissionalId(profissionalFiltro || "");
    setNovoServicoId("");
    setNovoData(dataAgenda || hoje);
    setNovoHora("");

    setClienteQuery("");
    setClienteSugestoes([]);
    setClienteSugLoading(false);
    setClienteSugErro(null);

    setClienteId(null);
    setClienteNome("");
    setClienteWhatsapp("");
    setClienteNascimento("");

    setNovoOpen(true);
  }

  function fecharNovoAgendamento() {
    setNovoOpen(false);
    setNovoErro(null);
    setNovoSucesso(null);
  }

  function selecionarCliente(c) {
    setClienteId(c?.id || null);
    setClienteNome(c?.nome || "");
    setClienteWhatsapp(c?.whatsapp || "");
    setClienteNascimento(c?.nascimento || "");
    setClienteQuery(c?.nome || "");
    setClienteSugestoes([]);
  }

  function limparClienteSelecionado() {
    setClienteId(null);
    setClienteNome("");
    setClienteWhatsapp("");
    setClienteNascimento("");
    setClienteQuery("");
    setClienteSugestoes([]);
  }

  useEffect(() => {
    if (!novoOpen) return;

    const q = String(clienteQuery || "").trim();

    if (clienteId && q === String(clienteNome || "").trim()) return;

    if (q.length < 2) {
      setClienteSugestoes([]);
      setClienteSugErro(null);
      setClienteSugLoading(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }

    if (!accessToken) return;

    setClienteSugErro(null);
    setClienteSugLoading(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await apiFetch(
          `/clientes/search?q=${encodeURIComponent(q)}&limit=10`,
          { method: "GET", accessToken }
        );
        const list = Array.isArray(data) ? data : data?.data || [];
        setClienteSugestoes(list || []);
      } catch (err) {
        setClienteSugErro(err?.message || "Erro ao buscar clientes.");
        setClienteSugestoes([]);
      } finally {
        setClienteSugLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [clienteQuery, novoOpen, accessToken, clienteId, clienteNome]);

  const [servicos, setServicos] = useState([]);
  const [servicosLoading, setServicosLoading] = useState(false);
  const [servicosErro, setServicosErro] = useState(null);

  useEffect(() => {
    let alive = true;

    async function carregarServicos() {
      if (!novoOpen) return;
      if (!accessToken) return;
      if (servicos && servicos.length > 0) return;

      setServicosErro(null);
      setServicosLoading(true);

      try {
        const data = await apiFetch("/servicos/admin", {
          method: "GET",
          accessToken,
        });

        const lista = Array.isArray(data) ? data : data?.data || [];
        const ativos = (lista || []).filter((s) => s?.ativo !== false);

        if (!alive) return;
        setServicos(ativos);
      } catch (err) {
        if (!alive) return;
        setServicosErro(err?.message || "Erro ao carregar serviços.");
      } finally {
        if (!alive) return;
        setServicosLoading(false);
      }
    }

    carregarServicos();

    return () => {
      alive = false;
    };
  }, [novoOpen, accessToken, servicos]);

  const servicoSelecionadoNovo = useMemo(() => {
    if (!novoServicoId) return null;
    return servicos.find((s) => s.id === novoServicoId) || null;
  }, [novoServicoId, servicos]);

  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsErro, setSlotsErro] = useState(null);

  async function carregarDisponibilidade() {
    setSlotsErro(null);
    setSlots([]);
    setNovoHora("");

    if (!accessToken) {
      setSlotsErro("Sessão inválida. Faça login novamente.");
      return;
    }

    if (!novoProfissionalId) {
      setSlotsErro("Selecione um profissional.");
      return;
    }

    if (!novoServicoId) {
      setSlotsErro("Selecione um serviço.");
      return;
    }

    if (!novoData) {
      setSlotsErro("Selecione uma data.");
      return;
    }

    try {
      setSlotsLoading(true);

      const data = await apiFetch(
        `/disponibilidade?profissional_id=${encodeURIComponent(
          novoProfissionalId
        )}&data=${encodeURIComponent(novoData)}&servico_id=${encodeURIComponent(
          novoServicoId
        )}`,
        { method: "GET", accessToken }
      );

      const list = extractHorariosArray(data);
      const norm = list.map((h) => String(h || "").slice(0, 5)).filter(Boolean);

      setSlots(norm);
    } catch (err) {
      setSlotsErro(err?.message || "Erro ao buscar disponibilidade.");
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  useEffect(() => {
    if (!novoOpen) return;
    if (!accessToken) return;
    if (!novoProfissionalId || !novoServicoId || !novoData) return;
    carregarDisponibilidade();
  }, [novoOpen, accessToken, novoProfissionalId, novoServicoId, novoData]);

  async function criarAgendamentoNovo() {
    setNovoErro(null);
    setNovoSucesso(null);

    if (!accessToken) {
      setNovoErro("Sessão inválida. Faça login novamente.");
      return;
    }

    if (!novoProfissionalId) {
      setNovoErro("Selecione um profissional.");
      return;
    }

    if (!novoServicoId) {
      setNovoErro("Selecione um serviço.");
      return;
    }

    if (!novoData) {
      setNovoErro("Selecione uma data.");
      return;
    }

    if (!novoHora) {
      setNovoErro("Selecione um horário disponível.");
      return;
    }

    const nomeTrim = String(clienteNome || "").trim();
    const whatsNorm = onlyDigits(clienteWhatsapp);

    if (!nomeTrim || nomeTrim.length < 2) {
      setNovoErro("Informe o nome do cliente (mín. 2 caracteres).");
      return;
    }

    if (!whatsNorm || whatsNorm.length < 8) {
      setNovoErro("Informe o WhatsApp/telefone do cliente.");
      return;
    }

    if (clienteNascimento && !/^\d{4}-\d{2}-\d{2}$/.test(clienteNascimento)) {
      setNovoErro("Nascimento deve estar no formato YYYY-MM-DD.");
      return;
    }

    try {
      setNovoSaving(true);

      const payload = {
        profissional_id: novoProfissionalId,
        servico_id: novoServicoId,
        data: novoData,
        hora: String(novoHora || "").slice(0, 8),
        cliente_nome: nomeTrim,
        cliente_whatsapp: whatsNorm,
        ...(clienteNascimento ? { cliente_nascimento: clienteNascimento } : {}),
      };

      await apiFetch("/agendamentos", {
        method: "POST",
        accessToken,
        body: JSON.stringify(payload),
      });

      await recarregarAgenda();

      setNovoSucesso("Agendamento criado com sucesso.");
      setTimeout(() => {
        fecharNovoAgendamento();
      }, 450);
    } catch (err) {
      setNovoErro(err?.message || "Erro ao criar agendamento.");
    } finally {
      setNovoSaving(false);
    }
  }

  const [editOpen, setEditOpen] = useState(false);
  const [editAg, setEditAg] = useState(null);

  const [editData, setEditData] = useState(hoje);
  const [editHora, setEditHora] = useState("09:00");

  const [extraServicoId, setExtraServicoId] = useState("");
  const [extraQtd, setExtraQtd] = useState("1");
  const [extraPrecoUnit, setExtraPrecoUnit] = useState("");
  const [extras, setExtras] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editErro, setEditErro] = useState(null);
  const [editSucesso, setEditSucesso] = useState(null);

  const extrasTotal = useMemo(() => {
    let total = 0;
    for (const it of extras) {
      const q = Number(it.quantidade ?? 1);
      const p = it.preco_venda_unit != null ? Number(it.preco_venda_unit) : 0;

      const qq = Number.isFinite(q) && q > 0 ? q : 0;
      const pp = Number.isFinite(p) && p >= 0 ? p : 0;

      total += qq * pp;
    }
    return Number(total.toFixed(2));
  }, [extras]);

  function abrirEditar(ag) {
    setEditErro(null);
    setEditSucesso(null);
    setExtras([]);
    setExtraServicoId("");
    setExtraQtd("1");
    setExtraPrecoUnit("");

    setEditAg(ag);
    setEditData(ag?.data || dataAgenda || hoje);
    setEditHora((ag?.hora_inicio || "09:00:00").slice(0, 5));
    setEditOpen(true);
  }

  function fecharEditar() {
    setEditOpen(false);
    setEditAg(null);
    setEditErro(null);
    setEditSucesso(null);
  }

  const extraServicoSelecionado = useMemo(() => {
    if (!extraServicoId) return null;
    return servicos.find((s) => s.id === extraServicoId) || null;
  }, [extraServicoId, servicos]);

  useEffect(() => {
    if (!extraServicoSelecionado) return;
    const preco = extraServicoSelecionado?.preco;
    if (preco != null && String(extraPrecoUnit).trim() === "") {
      setExtraPrecoUnit(String(Number(preco).toFixed(2)));
    }
  }, [extraServicoSelecionado, extraPrecoUnit]);

  function adicionarExtraNaLista() {
    setEditErro(null);
    setEditSucesso(null);

    if (!extraServicoId) {
      setEditErro("Selecione um serviço extra para adicionar.");
      return;
    }

    const qtdNum = toNumberOrNull(extraQtd);
    const qtd = qtdNum != null ? Math.floor(qtdNum) : null;
    if (!qtd || qtd <= 0) {
      setEditErro("Quantidade inválida (use um número maior que 0).");
      return;
    }

    const svc = servicos.find((s) => s.id === extraServicoId);
    const nome = svc?.nome || "Serviço";

    let precoUnit = null;
    const precoDigitado = toNumberOrNull(extraPrecoUnit);

    if (String(extraPrecoUnit).trim() !== "") {
      if (precoDigitado == null || precoDigitado < 0) {
        setEditErro("Preço unitário inválido (use número >= 0).");
        return;
      }
      precoUnit = Number(precoDigitado.toFixed(2));
    } else {
      const p = toNumberOrNull(svc?.preco);
      precoUnit = p != null ? Number(p.toFixed(2)) : 0;
    }

    setExtras((prev) => [
      ...prev,
      {
        servico_id: extraServicoId,
        nome,
        quantidade: qtd,
        preco_venda_unit: precoUnit,
      },
    ]);

    setExtraServicoId("");
    setExtraQtd("1");
    setExtraPrecoUnit("");
  }

  function removerExtra(idx) {
    setExtras((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCancelar(ag) {
    if (!podeGerirAgenda) {
      alert("Seu perfil não tem permissão para cancelar agendamentos.");
      return;
    }

    const ok = window.confirm(
      `Tem certeza que deseja cancelar o horário de ${ag.hora_inicio?.slice(
        0,
        5
      )} para o cliente ${ag.cliente?.nome || "—"}?`
    );
    if (!ok) return;

    try {
      await cancelarAgendamento(ag.id);
      await recarregarAgenda();
    } catch (err) {
      alert(err?.message || "Erro ao cancelar agendamento.");
    }
  }

  function handleEditar(ag) {
    if (!podeGerirAgenda) {
      alert("Seu perfil não tem permissão para editar agendamentos.");
      return;
    }
    abrirEditar(ag);
  }

  async function salvarEdicao() {
    if (!podeGerirAgenda) {
      setEditErro("Seu perfil não tem permissão para editar agendamentos.");
      return;
    }
    if (!editAg?.id) {
      setEditErro("Agendamento inválido.");
      return;
    }

    setEditErro(null);
    setEditSucesso(null);
    setEditSaving(true);

    try {
      const dataOriginal = editAg?.data || dataAgenda;
      const horaOriginal = (editAg?.hora_inicio || "09:00:00").slice(0, 5);

      const mudouData = editData && editData !== dataOriginal;
      const mudouHora = editHora && editHora !== horaOriginal;

      if (mudouData || mudouHora) {
        await reagendarAgendamento({
          id: editAg.id,
          novaData: editData || dataOriginal,
          novaHora: editHora || horaOriginal,
        });
      }

      if (extras.length > 0) {
        const itens = extras.map((x) => ({
          servico_id: x.servico_id,
          quantidade: x.quantidade,
          preco_venda_unit: x.preco_venda_unit,
        }));

        await adicionarExtrasAgendamento({ id: editAg.id, itens });
      }

      await recarregarAgenda();
      setEditSucesso("Alterações salvas com sucesso.");

      setTimeout(() => {
        fecharEditar();
      }, 400);
    } catch (err) {
      setEditErro(err?.message || "Erro ao salvar alterações.");
    } finally {
      setEditSaving(false);
    }
  }

  const mostrarBotaoFinanceiro =
    podeVerFinanceiro && typeof onIrFinanceiro === "function";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-5xl">
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
                {barbeariaNome || "Agenda do dia"}
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                Visualize compromissos, edite/cancele e bloqueie horários.
              </p>

              {!podeGerirAgenda && (
                <p className="text-[11px] text-slate-500 mt-2">
                  Seu perfil pode visualizar a agenda, mas não pode editar/cancelar
                  ou bloquear horários.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {mostrarBotaoFinanceiro && (
              <button
                onClick={onIrFinanceiro}
                className="text-xs px-3 py-1 rounded-lg border border-emerald-600 text-emerald-200 hover:bg-emerald-600/10 transition"
              >
                Ir para Financeiro
              </button>
            )}

            <button
              onClick={abrirNovoAgendamento}
              className="text-xs px-3 py-1 rounded-lg border border-sky-600 text-sky-200 hover:bg-sky-600/10 transition"
            >
              Novo agendamento
            </button>

            <button
              onClick={onVoltar}
              className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
            >
              Voltar ao painel
            </button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-[1.5fr]">
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
              <h2 className="font-semibold text-slate-100 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                Compromissos
              </h2>

              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="date"
                  value={dataAgenda}
                  onChange={(e) => setDataAgenda(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 text-sm rounded-lg px-2 py-1 text-slate-100"
                />

                <select
                  value={profissionalFiltro}
                  onChange={(e) => setProfissionalFiltro(e.target.value)}
                  className="bg-slate-800/80 border border-slate-700 text-sm rounded-lg px-2 py-1 text-slate-100"
                  disabled={loadingProfissionais}
                >
                  <option value="">Todos os profissionais</option>
                  {profissionais?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>

                <button
                  onClick={recarregarAgenda}
                  className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                >
                  Atualizar
                </button>
              </div>
            </div>

            {erroAgenda && (
              <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                {erroAgenda}
              </div>
            )}

            {erroProfissionais && (
              <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-3">
                {erroProfissionais}
              </div>
            )}

            {loadingAgenda ? (
              <p className="text-sm text-slate-400">Carregando agenda...</p>
            ) : agenda && agenda.length > 0 ? (
              <ul className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {agenda.map((ag) => {
                  const extrasTotalSrv =
                    ag?.extras_total != null ? Number(ag.extras_total) : null;
                  const extrasCount =
                    ag?.extras_count != null ? Number(ag.extras_count) : null;
                  const extrasResumo =
                    typeof ag?.extras_resumo === "string" && ag.extras_resumo
                      ? ag.extras_resumo
                      : null;

                  const temExtras =
                    (Number.isFinite(extrasTotalSrv) && extrasTotalSrv > 0) ||
                    (Number.isFinite(extrasCount) && extrasCount > 0) ||
                    !!extrasResumo;

                  return (
                    <li
                      key={ag.id}
                      className="bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2 text-xs flex justify-between items-start gap-3"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-100">
                          {ag.hora_inicio?.slice(0, 5)} — {ag.hora_fim?.slice(0, 5)}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-slate-200">
                            {ag.servico?.nome || "Serviço"}
                          </span>

                          {ag.status === "pacote" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-900/60 text-sky-100 border border-sky-600">
                              Pacote fixo
                            </span>
                          )}

                          {temExtras && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-900/30 text-emerald-100 border border-emerald-600">
                              {Number.isFinite(extrasTotalSrv) && extrasTotalSrv > 0
                                ? `+ R$ ${extrasTotalSrv.toFixed(2)} extras`
                                : extrasResumo
                                ? `Extras: ${extrasResumo}`
                                : `Extras: ${extrasCount ?? "—"}`}
                            </span>
                          )}
                        </div>

                        <div className="text-slate-400 text-[11px] mt-0.5">
                          Cliente: {ag.cliente?.nome || "—"} • {ag.cliente?.whatsapp || ""}
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <div>
                          <div className="text-[11px] text-slate-400">Profissional</div>
                          <div className="text-[13px] text-slate-100 font-medium">
                            {ag.profissional?.nome || "—"}
                          </div>

                          {ag.servico?.preco != null && (
                            <div className="text-[12px] text-emerald-400 font-semibold mt-1">
                              R$ {Number(ag.servico.preco).toFixed(2)}
                            </div>
                          )}
                        </div>

                        {podeGerirAgenda && ag.status !== "pacote" && (
                          <div className="flex gap-1 mt-1">
                            <button
                              onClick={() => handleEditar(ag)}
                              className="px-2 py-1 rounded-lg border border-slate-600 text-slate-200 text-[10px] hover:bg-slate-800 transition"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleCancelar(ag)}
                              className="px-2 py-1 rounded-lg border border-rose-600 text-rose-200 text-[10px] hover:bg-rose-600/10 transition"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}

                        {podeGerirAgenda && ag.status === "pacote" && (
                          <div className="text-[10px] text-slate-500 mt-2">
                            Pacote fixo: não editável aqui
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">Nenhum agendamento para este dia.</p>
            )}

            {podeGerirAgenda ? (
              <div className="mt-6 pt-4 border-t border-slate-700/60">
                <h3 className="font-semibold text-slate-100 mb-2 text-sm flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-rose-400" />
                  Bloquear horário / dia
                </h3>

                {bloqueioErro && (
                  <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-2">
                    {bloqueioErro}
                  </div>
                )}

                {bloqueioSucesso && (
                  <div className="bg-emerald-900/30 border border-emerald-600 text-emerald-100 text-xs px-3 py-2 rounded-lg mb-2">
                    {bloqueioSucesso}
                  </div>
                )}

                <form
                  onSubmit={handleCriarBloqueio}
                  className="grid gap-2 md:grid-cols-2 text-xs"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 mb-1">Profissional</span>
                    <select
                      value={bloqueioProfissionalId || profissionalFiltro}
                      onChange={(e) => setBloqueioProfissionalId(e.target.value)}
                      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                      disabled={loadingProfissionais}
                    >
                      <option value="">Selecione</option>
                      {profissionais?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 mb-1">Data do bloqueio</span>
                    <input
                      type="date"
                      value={bloqueioData}
                      onChange={(e) => setBloqueioData(e.target.value)}
                      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                    />
                  </div>

                  <div className="flex items-center gap-2 col-span-2 mt-1">
                    <input
                      id="bloqueio-dia-inteiro"
                      type="checkbox"
                      checked={bloqueioDiaInteiro}
                      onChange={(e) => setBloqueioDiaInteiro(e.target.checked)}
                      className="w-3 h-3"
                    />
                    <label
                      htmlFor="bloqueio-dia-inteiro"
                      className="text-[11px] text-slate-300"
                    >
                      Bloquear dia inteiro
                    </label>
                  </div>

                  {!bloqueioDiaInteiro && (
                    <>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400 mb-1">Hora inicial</span>
                        <input
                          type="time"
                          value={bloqueioHoraInicio}
                          onChange={(e) => setBloqueioHoraInicio(e.target.value)}
                          className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] text-slate-400 mb-1">Hora final</span>
                        <input
                          type="time"
                          value={bloqueioHoraFim}
                          onChange={(e) => setBloqueioHoraFim(e.target.value)}
                          className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100"
                        />
                      </div>
                    </>
                  )}

                  <div className="col-span-2 mt-2">
                    <button
                      type="submit"
                      disabled={bloqueioLoading}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-rose-500 text-rose-100 hover:bg-rose-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    >
                      {bloqueioLoading ? "Aplicando bloqueio..." : "Aplicar bloqueio"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 mt-4">
                Seu perfil não tem permissão para bloquear horários.
              </p>
            )}
          </section>
        </div>
      </div>

      {novoOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={fecharNovoAgendamento} />
          <div className="absolute inset-0 flex items-start justify-center p-4 md:p-6 overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-slate-700/60 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-50">Novo agendamento</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Busque cliente pelo nome (autocomplete) ou cadastre um novo com
                    WhatsApp e nascimento.
                  </p>
                </div>

                <button
                  onClick={fecharNovoAgendamento}
                  className="shrink-0 text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                >
                  Fechar
                </button>
              </div>

              <div className="p-4 grid gap-3">
                {novoErro && (
                  <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg">
                    {novoErro}
                  </div>
                )}
                {novoSucesso && (
                  <div className="bg-emerald-900/30 border border-emerald-600 text-emerald-100 text-xs px-3 py-2 rounded-lg">
                    {novoSucesso}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 mb-1">Profissional</span>
                    <select
                      value={novoProfissionalId}
                      onChange={(e) => setNovoProfissionalId(e.target.value)}
                      disabled={loadingProfissionais}
                      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    >
                      <option value="">Selecione</option>
                      {profissionais?.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 mb-1">Serviço</span>
                    <select
                      value={novoServicoId}
                      onChange={(e) => setNovoServicoId(e.target.value)}
                      disabled={servicosLoading}
                      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm disabled:opacity-60"
                    >
                      <option value="">
                        {servicosLoading ? "Carregando..." : "Selecione"}
                      </option>
                      {servicos?.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nome}
                          {s.preco != null ? ` — R$ ${Number(s.preco).toFixed(2)}` : ""}
                        </option>
                      ))}
                    </select>
                    {servicosErro && (
                      <span className="text-[11px] text-red-300 mt-1">{servicosErro}</span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 mb-1">Data</span>
                    <input
                      type="date"
                      value={novoData}
                      onChange={(e) => setNovoData(e.target.value)}
                      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-2 pt-3 border-t border-slate-700/60">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-semibold text-slate-100">Cliente</h4>
                    {clienteId && (
                      <button
                        onClick={limparClienteSelecionado}
                        className="text-[10px] px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                      >
                        Trocar cliente
                      </button>
                    )}
                  </div>

                  <div className="relative mt-2">
                    <input
                      value={clienteQuery}
                      onChange={(e) => {
                        const v = e.target.value;
                        setClienteQuery(v);

                        if (clienteId) {
                          setClienteId(null);
                          setClienteNome("");
                          setClienteWhatsapp("");
                          setClienteNascimento("");
                        }
                      }}
                      placeholder="Digite o nome (mín. 2 letras)…"
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
                    />

                    {(clienteSugLoading || clienteSugErro) && (
                      <div className="mt-1 text-[11px]">
                        {clienteSugLoading && (
                          <span className="text-slate-400">Buscando…</span>
                        )}
                        {clienteSugErro && (
                          <span className="text-red-300">{clienteSugErro}</span>
                        )}
                      </div>
                    )}

                    {!clienteId &&
                      clienteSugestoes.length > 0 &&
                      String(clienteQuery || "").trim().length >= 2 && (
                        <div className="absolute z-20 mt-1 w-full bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-lg">
                          {clienteSugestoes.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => selecionarCliente(c)}
                              className="w-full text-left px-3 py-2 hover:bg-slate-800 transition"
                            >
                              <div className="text-sm text-slate-100 font-medium">
                                {c.nome}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {c.whatsapp || ""}{" "}
                                {c.nascimento ? `• Nasc: ${fmtBRDate(c.nascimento)}` : ""}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
                    <div className="flex flex-col md:col-span-1">
                      <span className="text-[11px] text-slate-400 mb-1">Nome</span>
                      <input
                        value={clienteNome}
                        onChange={(e) => setClienteNome(e.target.value)}
                        disabled={!!clienteId}
                        placeholder={clienteId ? "Selecionado" : "Nome completo"}
                        className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm disabled:opacity-60"
                      />
                    </div>

                    <div className="flex flex-col md:col-span-1">
                      <span className="text-[11px] text-slate-400 mb-1">WhatsApp</span>
                      <input
                        value={clienteWhatsapp}
                        onChange={(e) => setClienteWhatsapp(e.target.value)}
                        disabled={!!clienteId}
                        placeholder="(xx) xxxxx-xxxx"
                        className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm disabled:opacity-60"
                      />
                    </div>

                    <div className="flex flex-col md:col-span-1">
                      <span className="text-[11px] text-slate-400 mb-1">Nascimento</span>
                      <input
                        type="date"
                        value={clienteNascimento}
                        onChange={(e) => setClienteNascimento(e.target.value)}
                        disabled={!!clienteId}
                        className="bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm disabled:opacity-60"
                      />
                      <span className="text-[10px] text-slate-500 mt-1">
                        Armazenar como YYYY-MM-DD (UI pode mostrar DD/MM/AAAA).
                      </span>
                    </div>
                  </div>

                  {clienteId && (
                    <div className="mt-2 text-[11px] text-emerald-200">
                      Cliente selecionado (ID):{" "}
                      <span className="text-emerald-300 font-semibold">{clienteId}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 pt-3 border-t border-slate-700/60">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-slate-100">
                      Horários disponíveis
                    </h4>

                    <button
                      onClick={carregarDisponibilidade}
                      disabled={slotsLoading}
                      className="text-[10px] px-2 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition disabled:opacity-60"
                    >
                      {slotsLoading ? "Buscando..." : "Recarregar horários"}
                    </button>
                  </div>

                  {slotsErro && (
                    <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mt-2">
                      {slotsErro}
                    </div>
                  )}

                  {!slotsLoading && !slotsErro && slots.length === 0 && (
                    <p className="text-xs text-slate-400 mt-2">
                      Selecione profissional, serviço e data para listar horários.
                    </p>
                  )}

                  {slotsLoading ? (
                    <p className="text-xs text-slate-400 mt-2">Carregando horários…</p>
                  ) : slots.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {slots.map((h) => {
                        const ativo = novoHora === h;
                        return (
                          <button
                            key={h}
                            onClick={() => setNovoHora(h)}
                            className={[
                              "text-xs px-3 py-2 rounded-lg border transition",
                              ativo
                                ? "border-emerald-500 text-emerald-100 bg-emerald-900/20"
                                : "border-slate-700 text-slate-200 hover:bg-slate-800",
                            ].join(" ")}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={fecharNovoAgendamento}
                    disabled={novoSaving}
                    className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={criarAgendamentoNovo}
                    disabled={novoSaving}
                    className="text-xs px-4 py-2 rounded-lg border border-emerald-600 text-emerald-200 hover:bg-emerald-600/10 transition disabled:opacity-60"
                  >
                    {novoSaving ? "Criando..." : "Criar agendamento"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/60" onClick={fecharEditar} />
          <div className="absolute inset-0 flex items-start justify-center p-4 md:p-6 overflow-y-auto">
            <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-slate-700/60 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-slate-50">Editar agendamento</h3>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Você pode reagendar (data/hora) e lançar serviços extras no
                    financeiro <span className="text-slate-300">sem alterar a agenda</span>.
                  </p>
                </div>

                <button
                  onClick={fecharEditar}
                  className="shrink-0 text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition"
                >
                  Fechar
                </button>
              </div>

              <div className="p-4 grid gap-3">
                {editErro && (
                  <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg">
                    {editErro}
                  </div>
                )}
                {editSucesso && (
                  <div className="bg-emerald-900/30 border border-emerald-600 text-emerald-100 text-xs px-3 py-2 rounded-lg">
                    {editSucesso}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 mb-1">Data</span>
                    <input
                      type="date"
                      value={editData}
                      onChange={(e) => setEditData(e.target.value)}
                      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-400 mb-1">Hora</span>
                    <input
                      type="time"
                      value={editHora}
                      onChange={(e) => setEditHora(e.target.value)}
                      className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                </div>

                <div className="mt-2 pt-3 border-t border-slate-700/60">
                  <h4 className="text-sm font-semibold text-slate-100">
                    Extras (lançamento no financeiro)
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Use isto quando o profissional fizer um serviço a mais “dentro do mesmo horário”.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-3 items-end">
                    <div className="flex flex-col md:col-span-2">
                      <span className="text-[11px] text-slate-400 mb-1">Serviço</span>
                      <select
                        value={extraServicoId}
                        onChange={(e) => setExtraServicoId(e.target.value)}
                        disabled={servicosLoading}
                        className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm disabled:opacity-60"
                      >
                        <option value="">
                          {servicosLoading ? "Carregando..." : "Selecione"}
                        </option>
                        {servicos?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                            {s.preco != null ? ` — R$ ${Number(s.preco).toFixed(2)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400 mb-1">Qtd</span>
                      <input
                        type="number"
                        min="1"
                        value={extraQtd}
                        onChange={(e) => setExtraQtd(e.target.value)}
                        className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                      />
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[11px] text-slate-400 mb-1">
                        Preço unit (opcional)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={extraPrecoUnit}
                        onChange={(e) => setExtraPrecoUnit(e.target.value)}
                        placeholder="Auto"
                        className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                      />
                    </div>

                    <div className="md:col-span-4 flex justify-end">
                      <button
                        onClick={adicionarExtraNaLista}
                        className="text-xs px-3 py-2 rounded-lg border border-emerald-600 text-emerald-200 hover:bg-emerald-600/10 transition"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>

                  {extras.length > 0 && (
                    <div className="mt-3 bg-slate-800/40 border border-slate-700 rounded-xl p-3">
                      <div className="text-[11px] text-slate-400 mb-2">Itens adicionados</div>

                      <ul className="space-y-2">
                        {extras.map((it, idx) => (
                          <li
                            key={`${it.servico_id}-${idx}`}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="text-slate-100 font-medium truncate">
                                {it.nome}
                              </div>
                              <div className="text-[11px] text-slate-400">
                                Qtd: {it.quantidade} • Unit: R${" "}
                                {Number(it.preco_venda_unit ?? 0).toFixed(2)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="text-emerald-300 font-semibold">
                                R${" "}
                                {Number(
                                  Number(it.quantidade) * Number(it.preco_venda_unit ?? 0)
                                ).toFixed(2)}
                              </div>
                              <button
                                onClick={() => removerExtra(idx)}
                                className="text-[10px] px-2 py-1 rounded-lg border border-rose-600 text-rose-200 hover:bg-rose-600/10 transition"
                              >
                                Remover
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-3 pt-2 border-t border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Total extras</span>
                        <span className="text-emerald-300 font-bold">
                          R$ {Number(extrasTotal).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={fecharEditar}
                    disabled={editSaving}
                    className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEdicao}
                    disabled={editSaving}
                    className="text-xs px-4 py-2 rounded-lg border border-emerald-600 text-emerald-200 hover:bg-emerald-600/10 transition disabled:opacity-60"
                  >
                    {editSaving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}