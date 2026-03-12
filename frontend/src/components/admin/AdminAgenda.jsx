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
    cancelarOcorrenciaPacote,
    remarcarOcorrenciaPacote,
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

  function normalizarDataISO(valor) {
    const s = String(valor || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
    return s;
  }

  function normalizarHoraHHMM(valor) {
    const s = String(valor || "").trim();
    if (!s) return "";
    if (/^\d{2}:\d{2}$/.test(s)) return s;
    if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
    return "";
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

  function formatBRL(valor) {
    const n = Number(valor ?? 0);
    if (!Number.isFinite(n)) return "R$ 0,00";
    return n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
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

  const [pacoteEditOpen, setPacoteEditOpen] = useState(false);
  const [pacoteEditAg, setPacoteEditAg] = useState(null);
  const [pacoteEditData, setPacoteEditData] = useState(hoje);
  const [pacoteEditHora, setPacoteEditHora] = useState("09:00");
  const [pacoteEditObservacoes, setPacoteEditObservacoes] = useState("");
  const [pacoteEditSaving, setPacoteEditSaving] = useState(false);
  const [pacoteEditErro, setPacoteEditErro] = useState(null);
  const [pacoteEditSucesso, setPacoteEditSucesso] = useState(null);

  const [servicos, setServicos] = useState([]);
  const [servicosLoading, setServicosLoading] = useState(false);
  const [servicosErro, setServicosErro] = useState(null);

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

  useEffect(() => {
    let alive = true;

    async function carregarServicos() {
      if (!novoOpen && !editOpen) return;
      if (!accessToken) return;

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
  }, [novoOpen, editOpen, accessToken]);

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
        hora: String(novoHora || "").slice(0, 5),
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

    setEditAg(ag || null);
    setEditData(normalizarDataISO(ag?.data) || dataAgenda || hoje);
    setEditHora(normalizarHoraHHMM(ag?.hora_inicio) || "09:00");
    setEditOpen(true);
  }

  function fecharEditar() {
    setEditOpen(false);
    setEditAg(null);
    setEditErro(null);
    setEditSucesso(null);
  }

  function abrirEditarPacote(ag) {
    setPacoteEditErro(null);
    setPacoteEditSucesso(null);

    setPacoteEditAg(ag || null);
    setPacoteEditData(normalizarDataISO(ag?.data) || dataAgenda || hoje);
    setPacoteEditHora(normalizarHoraHHMM(ag?.hora_inicio) || "09:00");
    setPacoteEditObservacoes("");
    setPacoteEditOpen(true);
  }

  function fecharEditarPacote() {
    setPacoteEditOpen(false);
    setPacoteEditAg(null);
    setPacoteEditErro(null);
    setPacoteEditSucesso(null);
    setPacoteEditObservacoes("");
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

    if (ag.status === "pacote" || ag.status === "pacote_remarcado") {
      const okPacote = window.confirm(
        `Tem certeza que deseja cancelar somente esta ocorrência do pacote em ${fmtBRDate(
          ag.data
        )} às ${ag.hora_inicio?.slice(0, 5)} para o cliente ${ag.cliente?.nome || "—"}?`
      );
      if (!okPacote) return;

      try {
        await cancelarOcorrenciaPacote({
          pacoteId: ag.pacote_id,
          pacoteHorarioId: ag.pacote_horario_id,
          dataOriginal: ag.data_original || ag.data,
        });
        await recarregarAgenda();
      } catch (err) {
        alert(err?.message || "Erro ao cancelar ocorrência do pacote.");
      }
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

    if (ag.status === "pacote" || ag.status === "pacote_remarcado") {
      abrirEditarPacote(ag);
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
      const dataOriginal = normalizarDataISO(editAg?.data) || "";
      const horaOriginal = normalizarHoraHHMM(editAg?.hora_inicio) || "";

      const dataFinal = normalizarDataISO(editData) || dataOriginal;
      const horaFinal = normalizarHoraHHMM(editHora) || horaOriginal;

      if (!dataFinal) {
        throw new Error("Data inválida para reagendamento.");
      }

      if (!horaFinal) {
        throw new Error("Hora inválida para reagendamento.");
      }

      const mudouData = dataFinal !== dataOriginal;
      const mudouHora = horaFinal !== horaOriginal;

      if (mudouData || mudouHora) {
        await reagendarAgendamento({
          id: editAg.id,
          novaData: dataFinal,
          novaHora: horaFinal,
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

      if (!mudouData && !mudouHora && extras.length === 0) {
        setEditSucesso("Nenhuma alteração para salvar.");
        return;
      }

      await recarregarAgenda();
      setEditSucesso("Alterações salvas com sucesso.");

      setTimeout(() => {
        fecharEditar();
      }, 400);
    } catch (err) {
      console.error("Erro ao salvar edição:", err);
      setEditErro(err?.message || "Erro ao salvar alterações.");
    } finally {
      setEditSaving(false);
    }
  }

  async function salvarEdicaoPacote() {
    if (!podeGerirAgenda) {
      setPacoteEditErro("Seu perfil não tem permissão para editar ocorrências de pacote.");
      return;
    }

    if (!pacoteEditAg?.pacote_id || !pacoteEditAg?.pacote_horario_id) {
      setPacoteEditErro("Ocorrência de pacote inválida.");
      return;
    }

    setPacoteEditErro(null);
    setPacoteEditSucesso(null);
    setPacoteEditSaving(true);

    try {
      const dataOriginalAtual = normalizarDataISO(pacoteEditAg?.data) || "";
      const horaOriginalAtual = normalizarHoraHHMM(pacoteEditAg?.hora_inicio) || "";

      const dataOriginalOcorrencia =
        normalizarDataISO(pacoteEditAg?.data_original) || dataOriginalAtual;

      const dataFinal = normalizarDataISO(pacoteEditData) || dataOriginalAtual;
      const horaFinal = normalizarHoraHHMM(pacoteEditHora) || horaOriginalAtual;

      if (!dataOriginalOcorrencia) {
        throw new Error("Data original da ocorrência do pacote é inválida.");
      }

      if (!dataFinal) {
        throw new Error("Data inválida para remarcar ocorrência do pacote.");
      }

      if (!horaFinal) {
        throw new Error("Hora inválida para remarcar ocorrência do pacote.");
      }

      const mudouData = dataFinal !== dataOriginalAtual;
      const mudouHora = horaFinal !== horaOriginalAtual;

      if (!mudouData && !mudouHora) {
        setPacoteEditSucesso("Nenhuma alteração para salvar.");
        return;
      }

      await remarcarOcorrenciaPacote({
        pacoteId: pacoteEditAg.pacote_id,
        pacoteHorarioId: pacoteEditAg.pacote_horario_id,
        dataOriginal: dataOriginalOcorrencia,
        novaData: dataFinal,
        novaHora: horaFinal,
        novaDuracaoMinutos: pacoteEditAg.duracao_minutos,
        observacoes: pacoteEditObservacoes || undefined,
      });

      await recarregarAgenda();
      setPacoteEditSucesso("Ocorrência do pacote remarcada com sucesso.");

      setTimeout(() => {
        fecharEditarPacote();
      }, 400);
    } catch (err) {
      console.error("Erro ao salvar edição do pacote:", err);
      setPacoteEditErro(err?.message || "Erro ao salvar ocorrência do pacote.");
    } finally {
      setPacoteEditSaving(false);
    }
  }

  const mostrarBotaoFinanceiro =
    podeVerFinanceiro && typeof onIrFinanceiro === "function";

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-app)] px-4 py-8 md:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-emerald-400 to-indigo-500" />
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
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-[var(--accent-primary-soft)] text-3xl">
                  ✂️
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Agenda operacional
                </div>

                <h1 className="max-w-2xl text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Agenda do dia"}
                </h1>

                <p className="mt-2 max-w-2xl text-sm text-[var(--text-muted)] md:text-[15px]">
                  Visualize compromissos, reagende horários, registre extras e mantenha a operação organizada em tempo real.
                </p>

                {!podeGerirAgenda && (
                  <p className="mt-3 text-[12px] text-[var(--text-soft)]">
                    Seu perfil pode visualizar a agenda, mas não pode editar, cancelar ou bloquear horários.
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                onClick={abrirNovoAgendamento}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-[1px] hover:opacity-95"
              >
                <span className="text-base leading-none">＋</span>
                Novo agendamento
              </button>

              {mostrarBotaoFinanceiro && (
                <button
                  onClick={onIrFinanceiro}
                  className="inline-flex items-center justify-center rounded-xl border border-emerald-500/70 bg-emerald-500/5 px-4 py-2.5 text-sm font-medium text-emerald-600 transition hover:bg-emerald-500/10"
                >
                  Ir para Financeiro
                </button>
              )}

              <button
                onClick={onVoltar}
                className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
              >
                Voltar ao painel
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.95fr]">
          <section className="rounded-[26px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-panel)] backdrop-blur-xl md:p-5">
            <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600">
                  <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                  Operação do dia
                </div>
                <h2 className="text-lg font-bold text-[var(--text-app)] md:text-xl">
                  Compromissos
                </h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  Filtre por data e profissional para acompanhar a agenda em detalhe.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input
                  type="date"
                  value={dataAgenda}
                  onChange={(e) => setDataAgenda(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-app)] shadow-sm outline-none transition focus:border-sky-500"
                />

                <select
                  value={profissionalFiltro}
                  onChange={(e) => setProfissionalFiltro(e.target.value)}
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-app)] shadow-sm outline-none transition focus:border-sky-500"
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
                  className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
                >
                  Atualizar
                </button>
              </div>
            </div>

            {erroAgenda && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {erroAgenda}
              </div>
            )}

            {erroProfissionais && (
              <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                {erroProfissionais}
              </div>
            )}

            {loadingAgenda ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                Carregando agenda...
              </div>
            ) : agenda && agenda.length > 0 ? (
              <ul className="space-y-3">
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

                  const isPacote =
                    ag.status === "pacote" || ag.status === "pacote_remarcado";

                  return (
                    <li
                      key={ag.id}
                      className="group overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-soft)] transition hover:-translate-y-[1px] hover:shadow-[var(--shadow-panel)]"
                    >
                      <div className="flex h-full">
                        <div
                          className={[
                            "w-1.5 shrink-0",
                            ag.status === "pacote"
                              ? "bg-sky-500"
                              : ag.status === "pacote_remarcado"
                              ? "bg-amber-500"
                              : "bg-emerald-500",
                          ].join(" ")}
                        />
                        <div className="flex-1 p-4">
                          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div className="min-w-0">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center rounded-full bg-[var(--accent-primary-soft)] px-3 py-1 text-[11px] font-bold tracking-wide text-[var(--accent-primary)]">
                                  {ag.hora_inicio?.slice(0, 5)} — {ag.hora_fim?.slice(0, 5)}
                                </span>

                                {ag.status === "pacote" && (
                                  <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10px] font-semibold text-sky-600">
                                    Pacote fixo
                                  </span>
                                )}

                                {ag.status === "pacote_remarcado" && (
                                  <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold text-amber-600">
                                    Pacote remarcado
                                  </span>
                                )}

                                {temExtras && (
                                  <span className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-600">
                                    {Number.isFinite(extrasTotalSrv) && extrasTotalSrv > 0
                                      ? `Extras ${formatBRL(extrasTotalSrv)}`
                                      : extrasResumo
                                      ? `Extras: ${extrasResumo}`
                                      : `Extras: ${extrasCount ?? "—"}`}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-base font-bold text-[var(--text-app)]">
                                {ag.servico?.nome || "Serviço"}
                              </h3>

                              <div className="mt-2 grid gap-2 text-[12px] text-[var(--text-muted)] sm:grid-cols-2">
                                <div>
                                  <span className="font-semibold text-[var(--text-app)]">Cliente:</span>{" "}
                                  {ag.cliente?.nome || "—"}
                                  {ag.cliente?.whatsapp ? ` • ${ag.cliente.whatsapp}` : ""}
                                </div>
                                <div>
                                  <span className="font-semibold text-[var(--text-app)]">Profissional:</span>{" "}
                                  {ag.profissional?.nome || "—"}
                                </div>
                              </div>
                            </div>

                            <div className="flex min-w-[150px] flex-col items-start gap-3 md:items-end">
                              {ag.servico?.preco != null && (
                                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-right">
                                  <div className="text-[10px] uppercase tracking-wide text-emerald-700/80">
                                    Valor
                                  </div>
                                  <div className="text-sm font-bold text-emerald-700">
                                    {formatBRL(ag.servico.preco)}
                                  </div>
                                </div>
                              )}

                              {podeGerirAgenda && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleEditar(ag)}
                                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-app)]"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleCancelar(ag)}
                                    className={[
                                      "rounded-xl border px-3 py-2 text-[11px] font-medium transition",
                                      isPacote
                                        ? "border-rose-500/60 text-rose-600 hover:bg-rose-500/10"
                                        : "border-rose-500/60 text-rose-600 hover:bg-rose-500/10",
                                    ].join(" ")}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-primary-soft)] text-xl">
                  📅
                </div>
                <p className="text-sm font-medium text-[var(--text-app)]">
                  Nenhum agendamento para este dia
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Ajuste os filtros ou crie um novo agendamento para preencher a agenda.
                </p>
              </div>
            )}
          </section>

          <aside className="rounded-[26px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-panel)] backdrop-blur-xl md:p-5">
            <div className="mb-5">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-[11px] font-semibold text-rose-600">
                <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                Gestão de indisponibilidade
              </div>
              <h2 className="text-lg font-bold text-[var(--text-app)] md:text-xl">
                Bloquear horário / dia
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Reserve períodos indisponíveis para férias, pausas, cursos ou imprevistos.
              </p>
            </div>

            {podeGerirAgenda ? (
              <>
                {bloqueioErro && (
                  <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                    {bloqueioErro}
                  </div>
                )}

                {bloqueioSucesso && (
                  <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                    {bloqueioSucesso}
                  </div>
                )}

                <form onSubmit={handleCriarBloqueio} className="space-y-4">
                  <div className="flex flex-col">
                    <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Profissional
                    </span>
                    <select
                      value={bloqueioProfissionalId || profissionalFiltro}
                      onChange={(e) => setBloqueioProfissionalId(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
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
                    <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Data do bloqueio
                    </span>
                    <input
                      type="date"
                      value={bloqueioData}
                      onChange={(e) => setBloqueioData(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-3 text-sm text-[var(--text-app)]">
                    <input
                      id="bloqueio-dia-inteiro"
                      type="checkbox"
                      checked={bloqueioDiaInteiro}
                      onChange={(e) => setBloqueioDiaInteiro(e.target.checked)}
                      className="h-4 w-4"
                    />
                    Bloquear dia inteiro
                  </label>

                  {!bloqueioDiaInteiro && (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="flex flex-col">
                        <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                          Hora inicial
                        </span>
                        <input
                          type="time"
                          value={bloqueioHoraInicio}
                          onChange={(e) => setBloqueioHoraInicio(e.target.value)}
                          className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                        />
                      </div>

                      <div className="flex flex-col">
                        <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                          Hora final
                        </span>
                        <input
                          type="time"
                          value={bloqueioHoraFim}
                          onChange={(e) => setBloqueioHoraFim(e.target.value)}
                          className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={bloqueioLoading}
                    className="w-full rounded-xl border border-rose-500 bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bloqueioLoading ? "Aplicando bloqueio..." : "Aplicar bloqueio"}
                  </button>
                </form>
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-xl">
                  ⛔
                </div>
                <p className="text-sm font-medium text-[var(--text-app)]">
                  Sem permissão para bloquear horários
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Seu perfil pode apenas visualizar esta agenda.
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>

      {novoOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm"
            onClick={fecharNovoAgendamento}
          />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 md:p-6">
            <div className="relative w-full max-w-4xl overflow-y-auto rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-panel)]">
              <div className="border-b border-[var(--border-color)] p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold text-sky-600">
                      Novo atendimento
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-app)]">
                      Novo agendamento
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Busque um cliente existente ou cadastre um novo e selecione um horário disponível.
                    </p>
                  </div>

                  <button
                    onClick={fecharNovoAgendamento}
                    className="shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)]"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-5 md:p-6">
                {novoErro && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                    {novoErro}
                  </div>
                )}
                {novoSucesso && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                    {novoSucesso}
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <h4 className="mb-3 text-sm font-bold text-[var(--text-app)]">
                    Dados do agendamento
                  </h4>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="flex flex-col">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Profissional
                      </span>
                      <select
                        value={novoProfissionalId}
                        onChange={(e) => setNovoProfissionalId(e.target.value)}
                        disabled={loadingProfissionais}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
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
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Serviço
                      </span>
                      <select
                        value={novoServicoId}
                        onChange={(e) => setNovoServicoId(e.target.value)}
                        disabled={servicosLoading}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500 disabled:opacity-60"
                      >
                        <option value="">
                          {servicosLoading ? "Carregando..." : "Selecione"}
                        </option>
                        {servicos?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                            {s.preco != null ? ` — ${formatBRL(s.preco)}` : ""}
                          </option>
                        ))}
                      </select>
                      {servicosErro && (
                        <span className="mt-1 text-[11px] text-red-500">{servicosErro}</span>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Data
                      </span>
                      <input
                        type="date"
                        value={novoData}
                        onChange={(e) => setNovoData(e.target.value)}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[var(--text-app)]">
                      Cliente
                    </h4>
                    {clienteId && (
                      <button
                        onClick={limparClienteSelecionado}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)]"
                      >
                        Trocar cliente
                      </button>
                    )}
                  </div>

                  <div className="relative">
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
                      placeholder="Digite o nome do cliente..."
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500"
                    />

                    {(clienteSugLoading || clienteSugErro) && (
                      <div className="mt-1 text-[11px]">
                        {clienteSugLoading && (
                          <span className="text-[var(--text-muted)]">Buscando…</span>
                        )}
                        {clienteSugErro && (
                          <span className="text-red-500">{clienteSugErro}</span>
                        )}
                      </div>
                    )}

                    {!clienteId &&
                      clienteSugestoes.length > 0 &&
                      String(clienteQuery || "").trim().length >= 2 && (
                        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-panel)]">
                          {clienteSugestoes.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => selecionarCliente(c)}
                              className="w-full border-b border-[var(--border-color)] px-3 py-3 text-left transition last:border-b-0 hover:bg-[var(--bg-panel)]"
                            >
                              <div className="text-sm font-medium text-[var(--text-app)]">
                                {c.nome}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)]">
                                {c.whatsapp || ""}
                                {c.nascimento ? ` • Nasc: ${fmtBRDate(c.nascimento)}` : ""}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="flex flex-col">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Nome
                      </span>
                      <input
                        value={clienteNome}
                        onChange={(e) => setClienteNome(e.target.value)}
                        disabled={!!clienteId}
                        placeholder={clienteId ? "Selecionado" : "Nome completo"}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500 disabled:opacity-60"
                      />
                    </div>

                    <div className="flex flex-col">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        WhatsApp
                      </span>
                      <input
                        value={clienteWhatsapp}
                        onChange={(e) => setClienteWhatsapp(e.target.value)}
                        disabled={!!clienteId}
                        placeholder="(xx) xxxxx-xxxx"
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500 disabled:opacity-60"
                      />
                    </div>

                    <div className="flex flex-col">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Nascimento
                      </span>
                      <input
                        type="date"
                        value={clienteNascimento}
                        onChange={(e) => setClienteNascimento(e.target.value)}
                        disabled={!!clienteId}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-sky-500 disabled:opacity-60"
                      />
                    </div>
                  </div>

                  {clienteId && (
                    <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-700">
                      Cliente selecionado com sucesso.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h4 className="text-sm font-bold text-[var(--text-app)]">
                      Horários disponíveis
                    </h4>

                    <button
                      onClick={carregarDisponibilidade}
                      disabled={slotsLoading}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)] disabled:opacity-60"
                    >
                      {slotsLoading ? "Buscando..." : "Recarregar horários"}
                    </button>
                  </div>

                  {slotsErro && (
                    <div className="mb-2 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                      {slotsErro}
                    </div>
                  )}

                  {!slotsLoading && !slotsErro && slots.length === 0 && (
                    <p className="text-xs text-[var(--text-muted)]">
                      Selecione profissional, serviço e data para listar horários.
                    </p>
                  )}

                  {slotsLoading ? (
                    <p className="text-xs text-[var(--text-muted)]">Carregando horários…</p>
                  ) : slots.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {slots.map((h) => {
                        const ativo = novoHora === h;
                        return (
                          <button
                            key={h}
                            onClick={() => setNovoHora(h)}
                            className={[
                              "rounded-xl border px-3 py-2 text-xs font-medium transition",
                              ativo
                                ? "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                                : "border-[var(--border-color)] bg-[var(--bg-panel-strong)] text-[var(--text-app)] hover:bg-[var(--bg-app)]",
                            ].join(" ")}
                          >
                            {h}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={fecharNovoAgendamento}
                    disabled={novoSaving}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)] disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={criarAgendamentoNovo}
                    disabled={novoSaving}
                    className="rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:opacity-95 disabled:opacity-60"
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
          <div className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm" onClick={fecharEditar} />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 md:p-6">
            <div className="relative w-full max-w-3xl overflow-y-auto rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-panel)]">
              <div className="border-b border-[var(--border-color)] p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600">
                      Ajustes do atendimento
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-app)]">
                      Editar agendamento
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Reagende data e hora ou lance serviços extras no financeiro sem alterar o serviço principal.
                    </p>
                  </div>

                  <button
                    onClick={fecharEditar}
                    className="shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)]"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-5 md:p-6">
                {editErro && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                    {editErro}
                  </div>
                )}
                {editSucesso && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                    {editSucesso}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="flex flex-col">
                    <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Data
                    </span>
                    <input
                      type="date"
                      value={editData}
                      onChange={(e) => setEditData(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Hora
                    </span>
                    <input
                      type="time"
                      value={editHora}
                      onChange={(e) => setEditHora(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4">
                  <h4 className="text-sm font-bold text-[var(--text-app)]">
                    Extras (lançamento no financeiro)
                  </h4>
                  <p className="mt-1 text-[11px] text-[var(--text-soft)]">
                    Use esta área quando o profissional realizar um serviço adicional dentro do mesmo horário.
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4 md:items-end">
                    <div className="flex flex-col md:col-span-2">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Serviço
                      </span>
                      <select
                        value={extraServicoId}
                        onChange={(e) => setExtraServicoId(e.target.value)}
                        disabled={servicosLoading}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500 disabled:opacity-60"
                      >
                        <option value="">
                          {servicosLoading ? "Carregando..." : "Selecione"}
                        </option>
                        {servicos?.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nome}
                            {s.preco != null ? ` — ${formatBRL(s.preco)}` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Qtd
                      </span>
                      <input
                        type="number"
                        min="1"
                        value={extraQtd}
                        onChange={(e) => setExtraQtd(e.target.value)}
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex flex-col">
                      <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                        Preço unit. (opcional)
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={extraPrecoUnit}
                        onChange={(e) => setExtraPrecoUnit(e.target.value)}
                        placeholder="Auto"
                        className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-emerald-500"
                      />
                    </div>

                    <div className="md:col-span-4 flex justify-end">
                      <button
                        onClick={adicionarExtraNaLista}
                        className="rounded-xl border border-emerald-500 bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-95"
                      >
                        Adicionar extra
                      </button>
                    </div>
                  </div>

                  {extras.length > 0 && (
                    <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4">
                      <div className="mb-3 text-[11px] font-medium text-[var(--text-muted)]">
                        Itens adicionados
                      </div>

                      <ul className="space-y-2">
                        {extras.map((it, idx) => (
                          <li
                            key={`${it.servico_id}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-3 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[var(--text-app)]">
                                {it.nome}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)]">
                                Qtd: {it.quantidade} • Unit: {formatBRL(it.preco_venda_unit ?? 0)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-emerald-700">
                                {formatBRL(
                                  Number(it.quantidade) * Number(it.preco_venda_unit ?? 0)
                                )}
                              </div>
                              <button
                                onClick={() => removerExtra(idx)}
                                className="rounded-xl border border-rose-500/60 px-2.5 py-1.5 text-[10px] font-medium text-rose-600 transition hover:bg-rose-500/10"
                              >
                                Remover
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-3 flex items-center justify-between border-t border-[var(--border-color)] pt-3 text-xs">
                        <span className="text-[var(--text-muted)]">Total extras</span>
                        <span className="font-bold text-emerald-700">
                          {formatBRL(extrasTotal)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={fecharEditar}
                    disabled={editSaving}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)] disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarEdicao}
                    disabled={editSaving}
                    className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:opacity-95 disabled:opacity-60"
                  >
                    {editSaving ? "Salvando..." : "Salvar alterações"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {pacoteEditOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-[var(--bg-overlay)] backdrop-blur-sm"
            onClick={fecharEditarPacote}
          />
          <div className="absolute inset-0 flex items-start justify-center overflow-y-auto p-4 md:p-6">
            <div className="relative w-full max-w-2xl overflow-y-auto rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel-strong)] shadow-[var(--shadow-panel)]">
              <div className="border-b border-[var(--border-color)] p-5 md:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-2 inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold text-amber-600">
                      Ocorrência avulsa
                    </div>
                    <h3 className="text-xl font-bold text-[var(--text-app)]">
                      Editar ocorrência do pacote
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Altere apenas esta ocorrência, sem mexer na regra fixa semanal do pacote.
                    </p>
                  </div>

                  <button
                    onClick={fecharEditarPacote}
                    className="shrink-0 rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-xs font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)]"
                  >
                    Fechar
                  </button>
                </div>
              </div>

              <div className="grid gap-4 p-5 md:p-6">
                {pacoteEditErro && (
                  <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-600">
                    {pacoteEditErro}
                  </div>
                )}

                {pacoteEditSucesso && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700">
                    {pacoteEditSucesso}
                  </div>
                )}

                <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 text-xs">
                  <div className="font-medium text-[var(--text-app)]">
                    Cliente: {pacoteEditAg?.cliente?.nome || "—"}
                  </div>
                  <div className="mt-1 text-[var(--text-muted)]">
                    Profissional: {pacoteEditAg?.profissional?.nome || "—"}
                  </div>
                  <div className="mt-1 text-[var(--text-muted)]">
                    Regra original: {fmtBRDate(pacoteEditAg?.data_original || pacoteEditAg?.data)} às{" "}
                    {pacoteEditAg?.hora_inicio?.slice(0, 5)}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="flex flex-col">
                    <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Nova data
                    </span>
                    <input
                      type="date"
                      value={pacoteEditData}
                      onChange={(e) => setPacoteEditData(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-amber-500"
                    />
                  </div>

                  <div className="flex flex-col">
                    <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                      Nova hora
                    </span>
                    <input
                      type="time"
                      value={pacoteEditHora}
                      onChange={(e) => setPacoteEditHora(e.target.value)}
                      className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex flex-col">
                  <span className="mb-1.5 text-[11px] font-medium text-[var(--text-muted)]">
                    Observações (opcional)
                  </span>
                  <textarea
                    rows={3}
                    value={pacoteEditObservacoes}
                    onChange={(e) => setPacoteEditObservacoes(e.target.value)}
                    placeholder="Ex.: cliente pediu excepcionalmente outro horário nesta semana"
                    className="resize-none rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={fecharEditarPacote}
                    disabled={pacoteEditSaving}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)] disabled:opacity-60"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={salvarEdicaoPacote}
                    disabled={pacoteEditSaving}
                    className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-500/20 transition hover:opacity-95 disabled:opacity-60"
                  >
                    {pacoteEditSaving ? "Salvando..." : "Salvar ocorrência"}
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