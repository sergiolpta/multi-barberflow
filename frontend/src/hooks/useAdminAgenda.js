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

  async function reagendarAgendamento({ id, novaData, novaHora }) {
    if (!accessToken) throw new Error("Token de acesso não encontrado.");

    if (!id || !novaData || !novaHora) {
      throw new Error("id, data e hora são obrigatórios para reagendar.");
    }

    let horaUsada = String(novaHora);
    if (horaUsada.length === 5) horaUsada = `${horaUsada}:00`;

    return apiFetch(`/agendamentos/${id}/reagendar`, {
      method: "PUT",
      accessToken,
      body: JSON.stringify({
        data: novaData,
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

  return {
    agenda,
    loadingAgenda,
    erroAgenda,
    recarregarAgenda: carregarAgenda,
    reagendarAgendamento,
    cancelarAgendamento,
    adicionarExtrasAgendamento,
  };
}