// src/hooks/useAdminFinanceiro.js
import { useCallback, useMemo, useState } from "react";
import { apiFetch } from "../config/api";

export function useAdminFinanceiro({ accessToken }) {
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const [fechamento, setFechamento] = useState(null);
  const [profissionais, setProfissionais] = useState([]);

  // ⚠️ legado: ainda existe para compatibilidade, mas não é mais necessário no UX
  const [fechamentoIdManual, setFechamentoIdManual] = useState("");

  // lista de fechamentos
  const [fechamentos, setFechamentos] = useState([]);

  const [adiantamentos, setAdiantamentos] = useState([]);
  const [despesas, setDespesas] = useState([]);

  // prévia dinâmica
  const [previa, setPrevia] = useState(null);

  const headersBase = useMemo(
    () => ({
      accessToken,
    }),
    [accessToken]
  );

  const limparErro = () => setErro("");

  // =========================================================
  // HELPERS
  // =========================================================
  function safeStr(v) {
    return String(v ?? "").trim();
  }

  function resolveMsg(e, fallback) {
    return e?.data?.message || e?.message || fallback;
  }

  function setFechamentoAtual(f) {
    setFechamento(f || null);
    const id = f?.id ? String(f.id) : "";
    setFechamentoIdManual(id);
  }

  // =========================================================
  // SNAPSHOT (profissionais do fechamento)
  // =========================================================
  const carregarProfissionais = useCallback(
    async (fechamentoId) => {
      const id = safeStr(fechamentoId);
      if (!id) return;

      setLoading(true);
      limparErro();

      try {
        const resp = await apiFetch(`/financeiro/fechamentos/${id}/profissionais`, {
          method: "GET",
          ...headersBase,
        });

        if (resp?.fechamento) {
          setFechamentoAtual(resp.fechamento);
        } else {
          setFechamentoIdManual(id);
        }

        if (Array.isArray(resp?.profissionais)) {
          setProfissionais(resp.profissionais);
        }
      } catch (e) {
        setErro(resolveMsg(e, "Erro ao carregar snapshot."));
      } finally {
        setLoading(false);
      }
    },
    [headersBase]
  );

  // =========================================================
  // ADIANTAMENTOS
  // =========================================================
  const carregarAdiantamentos = useCallback(
    async ({ dataInicio, dataFim }) => {
      const di = safeStr(dataInicio);
      const df = safeStr(dataFim);
      if (!di || !df) return;

      setLoading(true);
      limparErro();

      try {
        const list = await apiFetch(
          `/financeiro/adiantamentos?data_inicio=${encodeURIComponent(di)}&data_fim=${encodeURIComponent(df)}`,
          { method: "GET", ...headersBase }
        );

        setAdiantamentos(Array.isArray(list) ? list : []);
      } catch (e) {
        setErro(resolveMsg(e, "Erro ao carregar adiantamentos."));
        setAdiantamentos([]);
      } finally {
        setLoading(false);
      }
    },
    [headersBase]
  );

  // =========================================================
  // DESPESAS
  // =========================================================
  const carregarDespesas = useCallback(
    async ({ dataInicio, dataFim, categoria }) => {
      const di = safeStr(dataInicio);
      const df = safeStr(dataFim);
      if (!di || !df) return;

      const cat = safeStr(categoria);

      setLoading(true);
      limparErro();

      try {
        const url =
          `/financeiro/despesas?data_inicio=${encodeURIComponent(di)}` +
          `&data_fim=${encodeURIComponent(df)}` +
          (cat ? `&categoria=${encodeURIComponent(cat)}` : "");

        const list = await apiFetch(url, { method: "GET", ...headersBase });
        setDespesas(Array.isArray(list) ? list : []);
      } catch (e) {
        setErro(resolveMsg(e, "Erro ao carregar despesas."));
        setDespesas([]);
      } finally {
        setLoading(false);
      }
    },
    [headersBase]
  );

  // =========================================================
  // PRÉVIA (sem criar fechamento)
  // =========================================================
  const gerarPreviaPeriodo = useCallback(
    async ({ dataInicio, dataFim }) => {
      const di = safeStr(dataInicio);
      const df = safeStr(dataFim);
      if (!di || !df) return { ok: false, message: "Período inválido." };

      setLoading(true);
      limparErro();

      try {
        const resp = await apiFetch(
          `/financeiro/previa?data_inicio=${encodeURIComponent(di)}&data_fim=${encodeURIComponent(df)}`,
          { method: "GET", ...headersBase }
        );

        setPrevia(resp?.resumo || null);
        return { ok: true, data: resp };
      } catch (e) {
        setPrevia(null);
        const msg = resolveMsg(e, "Erro ao gerar prévia.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase]
  );

  // =========================================================
  // FECHAMENTOS (listagem / seleção)
  // =========================================================
  const listarFechamentos = useCallback(
    async ({ inicio = "", fim = "", limit = 50 } = {}) => {
      setLoading(true);
      limparErro();

      try {
        const qs = [];
        if (safeStr(inicio)) qs.push(`inicio=${encodeURIComponent(safeStr(inicio))}`);
        if (safeStr(fim)) qs.push(`fim=${encodeURIComponent(safeStr(fim))}`);
        if (Number.isFinite(Number(limit))) qs.push(`limit=${encodeURIComponent(String(limit))}`);

        const url = `/financeiro/fechamentos${qs.length ? `?${qs.join("&")}` : ""}`;

        const rows = await apiFetch(url, { method: "GET", ...headersBase });
        setFechamentos(Array.isArray(rows) ? rows : []);

        return { ok: true, data: rows };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao listar fechamentos.");
        setErro(msg);
        setFechamentos([]);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase]
  );

  const selecionarFechamentoPorId = useCallback(
    async (fechamentoId) => {
      const id = safeStr(fechamentoId);
      if (!id) return { ok: false, message: "ID inválido." };

      setLoading(true);
      limparErro();

      try {
        const resp = await apiFetch(`/financeiro/fechamentos/${id}/profissionais`, {
          method: "GET",
          ...headersBase,
        });

        if (resp?.fechamento) setFechamentoAtual(resp.fechamento);
        else setFechamentoIdManual(id);

        if (Array.isArray(resp?.profissionais)) setProfissionais(resp.profissionais);

        const f = resp?.fechamento || fechamento;
        const fi = f?.periodo_inicio;
        const ff = f?.periodo_fim;

        if (fi && ff) {
          await carregarAdiantamentos({ dataInicio: fi, dataFim: ff });
          await carregarDespesas({ dataInicio: fi, dataFim: ff });
        }

        return { ok: true, data: resp };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao selecionar fechamento.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, carregarAdiantamentos, carregarDespesas, fechamento]
  );

  // =========================================================
  // FECHAMENTO (criar / snapshot / concluir)
  // =========================================================
  const criarFechamento = useCallback(
    async ({ dataInicial, dataFinal }) => {
      const di = safeStr(dataInicial);
      const df = safeStr(dataFinal);
      if (!di || !df) return { ok: false, message: "Período inválido." };

      setLoading(true);
      limparErro();

      try {
        const resp = await apiFetch("/financeiro/fechamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data_inicio: di, data_fim: df }),
          ...headersBase,
        });

        const f = resp?.fechamento || null;
        setFechamentoAtual(f);

        const id = f?.id;
        if (id) await carregarProfissionais(id);

        await carregarAdiantamentos({ dataInicio: di, dataFim: df });
        await carregarDespesas({ dataInicio: di, dataFim: df });

        return { ok: true, data: resp };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao criar fechamento.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, carregarProfissionais, carregarAdiantamentos, carregarDespesas]
  );

  const gerarSnapshot = useCallback(
    async (fechamentoId) => {
      const id = safeStr(fechamentoId);
      if (!id) return { ok: false, message: "ID inválido." };

      setLoading(true);
      limparErro();

      try {
        await apiFetch(`/financeiro/fechamentos/${id}/gerar-snapshot`, {
          method: "POST",
          ...headersBase,
        });

        await carregarProfissionais(id);

        const fi = fechamento?.periodo_inicio;
        const ff = fechamento?.periodo_fim;
        if (fi && ff) {
          await carregarAdiantamentos({ dataInicio: fi, dataFim: ff });
          await carregarDespesas({ dataInicio: fi, dataFim: ff });
        }

        return { ok: true };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao gerar snapshot.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, carregarProfissionais, carregarAdiantamentos, carregarDespesas, fechamento]
  );

  const concluir = useCallback(
    async (fechamentoId) => {
      const id = safeStr(fechamentoId);
      if (!id) return { ok: false, message: "ID inválido." };

      setLoading(true);
      limparErro();

      try {
        const resp = await apiFetch(`/financeiro/fechamentos/${id}/concluir`, {
          method: "POST",
          ...headersBase,
        });

        if (resp?.fechamento) setFechamentoAtual(resp.fechamento);

        await carregarProfissionais(id);

        const fi = resp?.fechamento?.periodo_inicio || fechamento?.periodo_inicio;
        const ff = resp?.fechamento?.periodo_fim || fechamento?.periodo_fim;

        if (fi && ff) {
          await carregarAdiantamentos({ dataInicio: fi, dataFim: ff });
          await carregarDespesas({ dataInicio: fi, dataFim: ff });
        }

        return { ok: true, data: resp };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao concluir fechamento.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, carregarProfissionais, carregarAdiantamentos, carregarDespesas, fechamento]
  );

  // =========================================================
  // ADIANTAMENTOS (criar / excluir)
  // =========================================================
  const criarAdiantamento = useCallback(
    async ({ profissionalId, valor, data, descricao }) => {
      setLoading(true);
      limparErro();

      try {
        const row = await apiFetch("/financeiro/adiantamentos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...headersBase,
          body: JSON.stringify({
            profissional_id: profissionalId,
            valor,
            data,
            descricao: descricao || null,
          }),
        });

        const fi = fechamento?.periodo_inicio;
        const ff = fechamento?.periodo_fim;
        if (fi && ff) await carregarAdiantamentos({ dataInicio: fi, dataFim: ff });

        return { ok: true, data: row };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao criar adiantamento.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, fechamento, carregarAdiantamentos]
  );

  const excluirAdiantamento = useCallback(
    async (id) => {
      const aid = safeStr(id);
      if (!aid) return { ok: false, message: "ID do adiantamento é obrigatório." };

      setLoading(true);
      limparErro();

      try {
        await apiFetch(`/financeiro/adiantamentos/${aid}`, {
          method: "DELETE",
          ...headersBase,
        });

        const fi = fechamento?.periodo_inicio;
        const ff = fechamento?.periodo_fim;
        if (fi && ff) await carregarAdiantamentos({ dataInicio: fi, dataFim: ff });

        return { ok: true };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao excluir adiantamento.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, fechamento, carregarAdiantamentos]
  );

  // =========================================================
  // DESPESAS (criar / excluir)
  // =========================================================
  const criarDespesa = useCallback(
    async ({ data, categoria, descricao, valor, forma_pagamento }) => {
      setLoading(true);
      limparErro();

      try {
        const row = await apiFetch("/financeiro/despesas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...headersBase,
          body: JSON.stringify({
            data,
            categoria,
            descricao: descricao || null,
            valor,
            forma_pagamento: forma_pagamento || null,
          }),
        });

        const fi = fechamento?.periodo_inicio;
        const ff = fechamento?.periodo_fim;
        if (fi && ff) await carregarDespesas({ dataInicio: fi, dataFim: ff });

        return { ok: true, data: row };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao criar despesa.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, fechamento, carregarDespesas]
  );

  const excluirDespesa = useCallback(
    async (id) => {
      const did = safeStr(id);
      if (!did) return { ok: false, message: "ID da despesa é obrigatório." };

      setLoading(true);
      limparErro();

      try {
        await apiFetch(`/financeiro/despesas/${did}`, {
          method: "DELETE",
          ...headersBase,
        });

        const fi = fechamento?.periodo_inicio;
        const ff = fechamento?.periodo_fim;
        if (fi && ff) await carregarDespesas({ dataInicio: fi, dataFim: ff });

        return { ok: true };
      } catch (e) {
        const msg = resolveMsg(e, "Erro ao excluir despesa.");
        setErro(msg);
        return { ok: false, message: msg };
      } finally {
        setLoading(false);
      }
    },
    [headersBase, fechamento, carregarDespesas]
  );

  // =========================================================
  // RESET UI
  // =========================================================
  const resetFinanceiro = useCallback(() => {
    setErro("");
    setLoading(false);

    setFechamento(null);
    setProfissionais([]);
    setFechamentoIdManual("");

    setFechamentos([]);

    setAdiantamentos([]);
    setDespesas([]);

    setPrevia(null);
  }, []);

  return {
    loading,
    erro,

    fechamento,
    profissionais,

    fechamentoIdManual,
    setFechamentoIdManual,

    fechamentos,
    listarFechamentos,
    selecionarFechamentoPorId,

    criarFechamento,
    gerarSnapshot,
    concluir,
    carregarProfissionais,

    adiantamentos,
    carregarAdiantamentos,
    criarAdiantamento,
    excluirAdiantamento,

    despesas,
    carregarDespesas,
    criarDespesa,
    excluirDespesa,

    previa,
    gerarPreviaPeriodo,

    resetFinanceiro,
  };
}