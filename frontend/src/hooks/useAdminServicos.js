// src/hooks/useAdminServicos.js
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../config/api";

export function useAdminServicos({ accessToken }) {
  const [servicos, setServicos] = useState([]);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [erroServicos, setErroServicos] = useState(null);

  const carregarServicos = useCallback(async () => {
    if (!accessToken) {
      setErroServicos(
        "Token de acesso não encontrado. Faça login novamente para gerenciar serviços."
      );
      setServicos([]);
      return;
    }

    try {
      setLoadingServicos(true);
      setErroServicos(null);

      const lista = await apiFetch("/servicos/admin", {
        accessToken,
      });

      setServicos(Array.isArray(lista) ? lista : []);
    } catch (err) {
      console.error("Erro ao carregar serviços admin:", err);
      setErroServicos(err?.message || "Erro ao carregar lista de serviços.");
      setServicos([]);
    } finally {
      setLoadingServicos(false);
    }
  }, [accessToken]);

  useEffect(() => {
    carregarServicos();
  }, [carregarServicos]);

  async function criarServico({ nome, duracao_minutos, preco, ativo = true }) {
    try {
      const body = await apiFetch("/servicos", {
        method: "POST",
        accessToken,
        body: JSON.stringify({ nome, duracao_minutos, preco, ativo }),
      });

      await carregarServicos();
      return { ok: true, data: body };
    } catch (err) {
      return { ok: false, message: err?.message || "Erro ao criar serviço." };
    }
  }

  async function atualizarServico(id, dadosParciais) {
    try {
      const body = await apiFetch(`/servicos/${id}`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify(dadosParciais),
      });

      await carregarServicos();
      return { ok: true, data: body };
    } catch (err) {
      return { ok: false, message: err?.message || "Erro ao atualizar serviço." };
    }
  }

  async function desativarServico(id) {
    try {
      const body = await apiFetch(`/servicos/${id}`, {
        method: "DELETE",
        accessToken,
      });

      await carregarServicos();
      return { ok: true, message: body?.message || "Serviço desativado." };
    } catch (err) {
      return { ok: false, message: err?.message || "Erro ao desativar serviço." };
    }
  }

  return {
    servicos,
    loadingServicos,
    erroServicos,
    carregarServicos,
    criarServico,
    atualizarServico,
    desativarServico,
  };
}