// src/hooks/useAdminVendas.js
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../config/api";

export function useAdminVendas({ accessToken }) {
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  const carregarVendasHoje = useCallback(async () => {
    if (!accessToken) {
      setErro("Token de acesso não encontrado.");
      setVendas([]);
      return;
    }

    try {
      setLoading(true);
      setErro(null);
      const data = await apiFetch("/vendas?periodo=hoje", { accessToken });
      setVendas(Array.isArray(data?.vendas) ? data.vendas : Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e?.message || "Erro ao carregar vendas.");
      setVendas([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    carregarVendasHoje();
  }, [carregarVendasHoje]);

  async function registrarVenda({ itens, profissional_id }) {
    const data = await apiFetch("/vendas", {
      method: "POST",
      accessToken,
      body: JSON.stringify({ itens, profissional_id }),
    });
    return data;
  }

  return {
    vendas,
    loading,
    erro,
    recarregar: carregarVendasHoje,
    registrarVenda,
  };
}