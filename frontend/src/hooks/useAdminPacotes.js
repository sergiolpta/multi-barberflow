// src/hooks/useAdminPacotes.js
import { useState, useCallback } from "react";
import { apiFetch } from "../config/api";

export function useAdminPacotes({ accessToken }) {
  const [pacotes, setPacotes] = useState([]);
  const [loadingPacotes, setLoadingPacotes] = useState(false);
  const [erroPacotes, setErroPacotes] = useState(null);

  const listarPacotes = useCallback(
    async ({ profissionalId, somenteAtivos } = {}) => {
      if (!accessToken) {
        setErroPacotes("Token de acesso não encontrado. Faça login novamente.");
        setPacotes([]);
        return;
      }

      try {
        setLoadingPacotes(true);
        setErroPacotes(null);

        const params = new URLSearchParams();
        if (profissionalId) params.append("profissional_id", profissionalId);
        if (somenteAtivos) params.append("ativo", "true");

        const path = `/pacotes${params.toString() ? `?${params.toString()}` : ""}`;

        const body = await apiFetch(path, { accessToken });
        setPacotes(Array.isArray(body) ? body : []);
      } catch (err) {
        console.error("Erro ao listar pacotes:", err);
        setErroPacotes(err?.message || "Erro ao listar pacotes.");
        setPacotes([]);
      } finally {
        setLoadingPacotes(false);
      }
    },
    [accessToken]
  );

  const criarPacote = useCallback(
    async (payload) => {
      if (!accessToken) throw new Error("Token de acesso ausente.");

      return apiFetch("/pacotes", {
        method: "POST",
        accessToken,
        body: JSON.stringify(payload),
      });
    },
    [accessToken]
  );

  const atualizarPacote = useCallback(
    async (id, payload) => {
      if (!id) throw new Error("ID do pacote é obrigatório.");
      if (!accessToken) throw new Error("Token de acesso ausente.");

      return apiFetch(`/pacotes/${id}`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify(payload),
      });
    },
    [accessToken]
  );

  const desativarPacote = useCallback(
    async (id) => {
      if (!id) throw new Error("ID do pacote é obrigatório.");
      if (!accessToken) throw new Error("Token de acesso ausente.");

      return apiFetch(`/pacotes/${id}`, {
        method: "DELETE",
        accessToken,
      });
    },
    [accessToken]
  );

  // pagamentos do pacote
  const listarPagamentosPacote = useCallback(
    async ({ pacoteId, limit = 24 } = {}) => {
      if (!pacoteId) throw new Error("pacoteId é obrigatório.");
      if (!accessToken) throw new Error("Token de acesso ausente.");

      const path = `/pacotes/${pacoteId}/pagamentos?limit=${encodeURIComponent(limit)}`;
      return apiFetch(path, { accessToken });
    },
    [accessToken]
  );

  const registrarPagamentoPacote = useCallback(
    async ({ pacoteId, competencia, forma_pagamento } = {}) => {
      if (!pacoteId) throw new Error("pacoteId é obrigatório.");
      if (!accessToken) throw new Error("Token de acesso ausente.");

      return apiFetch(`/pacotes/${pacoteId}/pagamentos`, {
        method: "POST",
        accessToken,
        body: JSON.stringify({
          competencia,
          forma_pagamento: forma_pagamento || "pix",
        }),
      });
    },
    [accessToken]
  );

  return {
    pacotes,
    loadingPacotes,
    erroPacotes,
    listarPacotes,
    criarPacote,
    atualizarPacote,
    desativarPacote,
    listarPagamentosPacote,
    registrarPagamentoPacote,
  };
}