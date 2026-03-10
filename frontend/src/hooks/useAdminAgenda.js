import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../config/api";

/**
 * Hook para carregar agenda do dia no painel Admin e operar:
 * - reagendamento de agendamento normal
 * - cancelamento de agendamento normal
 * - extras (lançamento no financeiro sem mexer na agenda)
 * - cancelamento de ocorrência de pacote
 * - remarcação de ocorrência de pacote
 *
 * Parâmetros:
 *  - data: YYYY-MM-DD (obrigatório)
 *  - profissionalId: opcional (filtra por profissional)
 *  - accessToken: JWT do Supabase (obrigatório p/ admin)
 */
export function useAdminAgenda({
  data,
  profissionalId,
  accessToken,
}) {
  const [agenda, setAgenda] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [erroAgenda, setErroAgenda] = useState(null);

  const reqSeq = useRef(0);

  const carregarAgenda = useCallback(async () => {
    const mySeq = ++reqSeq.current;

    if (!data) {
      setErroAgenda(null);
      setAgenda([]);
      setLoadingAgenda(false);
      return;
    }

    if (!accessToken) {
      setErroAgenda(
        "Token de acesso não encontrado. Faça login novamente para ver a agenda."
      );
      setAgenda([]);
      setLoadingAgenda(false);
      return;
    }

    try {
      setLoadingAgenda(true);
      setErroAgenda(null);

      const params = new URLSearchParams({ data });
      if (profissionalId) params.append("profissional_id", profissionalId);

      const json = await apiFetch(`/agendamentos?${params.toString()}`, {
        accessToken,
      });

      if (mySeq !== reqSeq.current) return;

      const itens = Array.isArray(json)
        ? json
        : Array.isArray(json?.agendamentos)
        ? json.agendamentos
        : [];

      setAgenda(itens);
    } catch (err) {
      if (mySeq !== reqSeq.current) return;

      console.error("Erro ao carregar agenda admin:", err);
      setErroAgenda(err?.message || "Erro ao carregar agenda admin.");
      setAgenda([]);
    } finally {
      if (mySeq !== reqSeq.current) return;
      setLoadingAgenda(false);
    }
  }, [data, profissionalId, accessToken]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  function normalizarHoraHHMM(valor) {
    let hora = String(valor || "").trim();

    if (/^\d{2}:\d{2}:\d{2}$/.test(hora)) {
      hora = hora.slice(0, 5);
    }

    if (!/^\d{2}:\d{2}$/.test(hora)) {
      return null;
    }

    return hora;
  }

  function normalizarDataISO(valor) {
    const s = String(valor || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    return s;
  }

  async function reagendarAgendamento({ id, novaData, novaHora }) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");

    if (!id || !novaData || !novaHora) {
      throw new Error("id, data e hora são obrigatórios para reagendar.");
    }

    const dataUsada = normalizarDataISO(novaData);
    const horaUsada = normalizarHoraHHMM(novaHora);

    if (!dataUsada) {
      throw new Error("Data inválida para reagendamento. Use YYYY-MM-DD.");
    }

    if (!horaUsada) {
      throw new Error("Hora inválida para reagendamento. Use HH:MM.");
    }

    return apiFetch(`/agendamentos/${id}/reagendar`, {
      method: "PUT",
      accessToken,
      body: JSON.stringify({
        data: dataUsada,
        hora: horaUsada,
      }),
    });
  }

  async function cancelarAgendamento(id) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");
    if (!id) throw new Error("id é obrigatório para cancelar agendamento.");

    return apiFetch(`/agendamentos/${id}/cancelar`, {
      method: "POST",
      accessToken,
    });
  }

  function toNumberOrNull(v) {
    if (v == null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function adicionarExtrasAgendamento({
    id,
    itens,
    profissional_id,
    user_id,
  }) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");
    if (!id) throw new Error("id é obrigatório para lançar extras.");
    if (!Array.isArray(itens) || itens.length === 0) {
      throw new Error("Informe ao menos um item de extra.");
    }

    const payloadItens = itens.map((it) => {
      const qtd = toNumberOrNull(it.quantidade);
      const pv = toNumberOrNull(it.preco_venda_unit);
      const pc = toNumberOrNull(it.preco_custo_unit);

      const obj = {
        servico_id: it.servico_id,
        quantidade: qtd && qtd > 0 ? Math.floor(qtd) : 1,
      };

      if (pv != null && pv >= 0) obj.preco_venda_unit = pv;
      if (pc != null && pc >= 0) obj.preco_custo_unit = pc;

      return obj;
    });

    const body = {
      itens: payloadItens,
      ...(profissional_id ? { profissional_id } : {}),
      ...(user_id ? { user_id } : {}),
    };

    return apiFetch(`/agendamentos/${id}/extras`, {
      method: "POST",
      accessToken,
      body: JSON.stringify(body),
    });
  }

  async function cancelarOcorrenciaPacote({
    pacoteId,
    pacoteHorarioId,
    dataOriginal,
    observacoes,
  }) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");

    const pacoteIdUsado = String(pacoteId || "").trim();
    const pacoteHorarioIdUsado = String(pacoteHorarioId || "").trim();
    const dataOriginalUsada = normalizarDataISO(dataOriginal);

    if (!pacoteIdUsado || !pacoteHorarioIdUsado || !dataOriginalUsada) {
      throw new Error(
        "pacoteId, pacoteHorarioId e dataOriginal são obrigatórios para cancelar a ocorrência do pacote."
      );
    }

    const body = {
      pacote_id: pacoteIdUsado,
      pacote_horario_id: pacoteHorarioIdUsado,
      data_original: dataOriginalUsada,
      ...(observacoes ? { observacoes: String(observacoes).trim() } : {}),
    };

    return apiFetch("/agendamentos/pacotes/ocorrencias/cancelar", {
      method: "POST",
      accessToken,
      body: JSON.stringify(body),
    });
  }

  async function remarcarOcorrenciaPacote({
    pacoteId,
    pacoteHorarioId,
    dataOriginal,
    novaData,
    novaHora,
    novaDuracaoMinutos,
    observacoes,
  }) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");

    const pacoteIdUsado = String(pacoteId || "").trim();
    const pacoteHorarioIdUsado = String(pacoteHorarioId || "").trim();
    const dataOriginalUsada = normalizarDataISO(dataOriginal);
    const novaDataUsada = normalizarDataISO(novaData);
    const novaHoraUsada = normalizarHoraHHMM(novaHora);

    if (
      !pacoteIdUsado ||
      !pacoteHorarioIdUsado ||
      !dataOriginalUsada ||
      !novaDataUsada ||
      !novaHoraUsada
    ) {
      throw new Error(
        "pacoteId, pacoteHorarioId, dataOriginal, novaData e novaHora são obrigatórios para remarcar a ocorrência do pacote."
      );
    }

    const body = {
      pacote_id: pacoteIdUsado,
      pacote_horario_id: pacoteHorarioIdUsado,
      data_original: dataOriginalUsada,
      nova_data: novaDataUsada,
      nova_hora_inicio: novaHoraUsada,
      ...(novaDuracaoMinutos != null && String(novaDuracaoMinutos).trim() !== ""
        ? { nova_duracao_minutos: Number(novaDuracaoMinutos) }
        : {}),
      ...(observacoes ? { observacoes: String(observacoes).trim() } : {}),
    };

    return apiFetch("/agendamentos/pacotes/ocorrencias/remarcar", {
      method: "POST",
      accessToken,
      body: JSON.stringify(body),
    });
  }

  return {
    agenda,
    loadingAgenda,
    erroAgenda,
    recarregarAgenda: carregarAgenda,

    // agendamento normal
    reagendarAgendamento,
    cancelarAgendamento,
    adicionarExtrasAgendamento,

    // pacote
    cancelarOcorrenciaPacote,
    remarcarOcorrenciaPacote,
  };
}