// src/hooks/useAdminProdutos.js
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../config/api";

export function useAdminProdutos({ accessToken, barbeariaId }) {
  const [produtos, setProdutos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    if (!accessToken) {
      setErro("Token de acesso não encontrado.");
      setProdutos([]);
      return;
    }
    if (!barbeariaId) {
      setErro("Barbearia não identificada (falha ao carregar /me).");
      setProdutos([]);
      return;
    }

    try {
      setLoading(true);
      setErro(null);
      const data = await apiFetch("/produtos", { accessToken, barbeariaId });
      setProdutos(Array.isArray(data?.produtos) ? data.produtos : Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e?.message || "Erro ao carregar produtos.");
      setProdutos([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, barbeariaId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criarProduto(payload) {
    const data = await apiFetch("/produtos", {
      method: "POST",
      accessToken,
      barbeariaId,
      body: JSON.stringify(payload),
    });
    return data;
  }

  async function atualizarProduto(id, payload) {
    const data = await apiFetch(`/produtos/${id}`, {
      method: "PUT",
      accessToken,
      barbeariaId,
      body: JSON.stringify(payload),
    });
    return data;
  }

  return {
    produtos,
    loading,
    erro,
    recarregar: carregar,
    criarProduto,
    atualizarProduto,
  };
}

