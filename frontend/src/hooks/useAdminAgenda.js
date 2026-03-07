// src/hooks/useAdminAgenda.js
import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "../config/api";

/**
 * Hook para carregar agenda do dia no painel Admin e operar:
 * - reagendamento
 * - cancelamento
 * - extras (lançamento no financeiro sem mexer na agenda)
 *
 * Parâmetros:
 *  - data: YYYY-MM-DD (obrigatório)
 *  - profissionalId: opcional (filtra por profissional)
 *  - accessToken: JWT do Supabase (obrigatório p/ admin)
 *  - barbeariaId: uuid (vem do /me)
 */
export function useAdminAgenda({
  data,
  profissionalId,
  accessToken,
  barbeariaId,
}) {
  const [agenda, setAgenda] = useState([]);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [erroAgenda, setErroAgenda] = useState(null);

  // evita race condition: só a última requisição “vence”
  const reqSeq = useRef(0);

  const carregarAgenda = useCallback(async () => {
    const mySeq = ++reqSeq.current;

    // Se não tem data, zera e não tenta buscar
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

    if (!barbeariaId) {
      setErroAgenda(
        "Não foi possível identificar a barbearia deste usuário. Faça login novamente (falha ao carregar /me)."
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
        barbeariaId,
      });

      // se outra requisição mais nova já começou, ignora esta
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
  }, [data, profissionalId, accessToken, barbeariaId]);

  useEffect(() => {
    carregarAgenda();
  }, [carregarAgenda]);

  // ------------------------------------------------------------------
  // AÇÕES: reagendar e cancelar
  // ------------------------------------------------------------------

  async function reagendarAgendamento({ id, novaData, novaHora }) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");
    if (!barbeariaId)
      throw new Error("Barbearia não identificada (falha ao carregar /me).");

    if (!id || !novaData || !novaHora) {
      throw new Error("id, data e hora são obrigatórios para reagendar.");
    }

    // normaliza HH:MM -> HH:MM:SS
    let horaUsada = String(novaHora);
    if (horaUsada.length === 5) horaUsada = `${horaUsada}:00`;

    return apiFetch(`/agendamentos/${id}/reagendar`, {
      method: "PUT",
      accessToken,
      barbeariaId,
      body: JSON.stringify({
        data: novaData,
        hora: horaUsada,
      }),
    });
  }

  async function cancelarAgendamento(id) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");
    if (!barbeariaId)
      throw new Error("Barbearia não identificada (falha ao carregar /me).");

    if (!id) throw new Error("id é obrigatório para cancelar agendamento.");

    return apiFetch(`/agendamentos/${id}/cancelar`, {
      method: "POST",
      accessToken,
      barbeariaId,
    });
  }

  // ------------------------------------------------------------------
  // NOVO: lançar extras (serviços) no financeiro sem mexer na agenda
  // Endpoint: POST /agendamentos/:id/extras
  // Body: { itens: [{ servico_id, quantidade?, preco_venda_unit?, preco_custo_unit? }] }
  // ------------------------------------------------------------------

  function toNumberOrNull(v) {
    if (v == null) return null;
    if (typeof v === "string" && v.trim() === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  async function adicionarExtrasAgendamento({
    id,
    itens,
    profissional_id, // opcional (se quiser forçar)
    user_id, // opcional (se quiser forçar)
  }) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");
    if (!barbeariaId)
      throw new Error("Barbearia não identificada (falha ao carregar /me).");

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
        // se vier inválido/vazio, default 1 (backend também assume 1)
        quantidade: qtd && qtd > 0 ? Math.floor(qtd) : 1,
      };

      // só manda se for número válido (senão deixa backend usar preço do serviço / custo 0)
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
      barbeariaId,
      body: JSON.stringify(body),
    });
  }

  return {
    agenda,
    loadingAgenda,
    erroAgenda,
    recarregarAgenda: carregarAgenda,
    reagendarAgendamento,
    cancelarAgendamento,
    adicionarExtrasAgendamento, // ✅ novo
  };
}
