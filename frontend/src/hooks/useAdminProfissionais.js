// src/hooks/useAdminProfissionais.js
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../config/api";

export function useAdminProfissionais({ accessToken }) {
  const [profissionais, setProfissionais] = useState([]);
  const [loadingProfissionais, setLoadingProfissionais] = useState(false);
  const [erroProfissionais, setErroProfissionais] = useState(null);

  const carregarProfissionais = useCallback(async () => {
    if (!accessToken) {
      setErroProfissionais(
        "Token de acesso não encontrado. Faça login novamente para gerenciar profissionais."
      );
      setProfissionais([]);
      return;
    }

    try {
      setLoadingProfissionais(true);
      setErroProfissionais(null);

      const lista = await apiFetch("/profissionais/admin", {
        accessToken,
      });

      setProfissionais(Array.isArray(lista) ? lista : []);
    } catch (err) {
      console.error("Erro ao carregar profissionais admin:", err);
      setErroProfissionais(err?.message || "Erro ao carregar lista de profissionais.");
      setProfissionais([]);
    } finally {
      setLoadingProfissionais(false);
    }
  }, [accessToken]);

  useEffect(() => {
    carregarProfissionais();
  }, [carregarProfissionais]);

  async function criarProfissional({
    nome,
    whatsapp,
    ativo = true,
    comissao_pdv_pct,
    comissao_pacote_pct,
  }) {
    if (!accessToken) {
      return { ok: false, message: "Token de acesso não encontrado. Faça login novamente." };
    }

    try {
      const payload = {
        nome,
        whatsapp,
        ativo,
      };

      if (comissao_pdv_pct !== undefined) payload.comissao_pdv_pct = comissao_pdv_pct;
      if (comissao_pacote_pct !== undefined) payload.comissao_pacote_pct = comissao_pacote_pct;

      const body = await apiFetch("/profissionais", {
        method: "POST",
        accessToken,
        body: JSON.stringify(payload),
      });

      await carregarProfissionais();
      return { ok: true, data: body };
    } catch (err) {
      return {
        ok: false,
        message: err?.message || "Erro inesperado ao criar o profissional.",
      };
    }
  }

  async function atualizarProfissional(id, dadosParciais) {
    if (!id) return { ok: false, message: "ID do profissional é obrigatório." };
    if (!accessToken) {
      return { ok: false, message: "Token de acesso não encontrado. Faça login novamente." };
    }

    try {
      const body = await apiFetch(`/profissionais/${id}`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify(dadosParciais),
      });

      await carregarProfissionais();
      return { ok: true, data: body };
    } catch (err) {
      return {
        ok: false,
        message: err?.message || "Erro inesperado ao atualizar o profissional.",
      };
    }
  }

  async function desativarProfissional(id) {
    if (!id) return { ok: false, message: "ID do profissional é obrigatório." };
    if (!accessToken) {
      return { ok: false, message: "Token de acesso não encontrado. Faça login novamente." };
    }

    try {
      const body = await apiFetch(`/profissionais/${id}`, {
        method: "DELETE",
        accessToken,
      });

      await carregarProfissionais();
      return {
        ok: true,
        message: body?.message || "Profissional desativado com sucesso.",
      };
    } catch (err) {
      return {
        ok: false,
        message: err?.message || "Erro inesperado ao desativar o profissional.",
      };
    }
  }

  async function carregarComissoesServico(profissionalId) {
    if (!profissionalId) return { ok: false, message: "profissionalId é obrigatório." };
    if (!accessToken) return { ok: false, message: "Token de acesso não encontrado." };

    try {
      const resp = await apiFetch(`/profissionais/${profissionalId}/comissoes-servico`, {
        method: "GET",
        accessToken,
      });

      return { ok: true, data: resp };
    } catch (err) {
      return { ok: false, message: err?.message || "Erro ao carregar comissões do profissional." };
    }
  }

  async function salvarComissoesServico(profissionalId, itens, vigencia_inicio) {
    if (!profissionalId) return { ok: false, message: "profissionalId é obrigatório." };
    if (!Array.isArray(itens) || !itens.length) {
      return { ok: false, message: "itens é obrigatório." };
    }
    if (!accessToken) return { ok: false, message: "Token de acesso não encontrado." };

    try {
      const resp = await apiFetch(`/profissionais/${profissionalId}/comissoes-servico`, {
        method: "PUT",
        accessToken,
        body: JSON.stringify({ vigencia_inicio, itens }),
      });

      return { ok: true, data: resp };
    } catch (err) {
      return { ok: false, message: err?.message || "Erro ao salvar comissões por serviço." };
    }
  }

  return {
    profissionais,
    loadingProfissionais,
    erroProfissionais,
    carregarProfissionais,
    criarProfissional,
    atualizarProfissional,
    desativarProfissional,
    carregarComissoesServico,
    salvarComissoesServico,
  };
}