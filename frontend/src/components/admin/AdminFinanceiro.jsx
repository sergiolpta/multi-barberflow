// src/components/admin/AdminFinanceiro.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminFinanceiro } from "../../hooks/useAdminFinanceiro";
import { apiFetch } from "../../config/api";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function fmtBRL(v) {
  const n = Number(v ?? 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toInputDateBR(d) {
  if (!d) return "";
  return String(d).slice(0, 10);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function yyyyMmDd(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

function firstDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function lastDayOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function Badge({ tone = "slate", children }) {
  const map = {
    slate: "bg-slate-800/70 border-slate-700 text-slate-200",
    sky: "bg-sky-500/10 border-sky-500/40 text-sky-200",
    emerald: "bg-emerald-500/10 border-emerald-500/40 text-emerald-200",
    amber: "bg-amber-500/10 border-amber-500/40 text-amber-200",
    rose: "bg-rose-500/10 border-rose-500/40 text-rose-200",
    red: "bg-red-500/10 border-red-500/40 text-red-200",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border ${
        map[tone] || map.slate
      }`}
    >
      {children}
    </span>
  );
}

function Tabs({ value, onChange, items }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={
              "text-[11px] px-3 py-1 rounded-lg border transition " +
              (active
                ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                : "border-slate-700 text-slate-300 hover:bg-slate-800/40")
            }
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function KpiCard({ title, value, hint, tone = "slate" }) {
  const toneMap = {
    slate: "border-slate-700/50",
    sky: "border-sky-500/30",
    emerald: "border-emerald-500/30",
    amber: "border-amber-500/30",
    rose: "border-rose-500/30",
    red: "border-red-500/30",
  };

  return (
    <div className={`bg-slate-900/30 border ${toneMap[tone] || toneMap.slate} rounded-xl p-3`}>
      <div className="text-[11px] text-slate-400">{title}</div>
      <div className="text-sm font-semibold mt-1">{value}</div>
      {hint ? <div className="text-[11px] text-slate-500 mt-1">{hint}</div> : null}
    </div>
  );
}

function exportSnapshotPDF({ barbeariaId, fechamento, fechamentoId, profissionais }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const id = fechamentoId || fechamento?.id || "—";
  const periodoInicio = String(fechamento?.periodo_inicio || "").slice(0, 10);
  const periodoFim = String(fechamento?.periodo_fim || "").slice(0, 10);
  const status = String(fechamento?.status || "—");
  const geradoEm = new Date().toLocaleString("pt-BR");

  doc.setFontSize(14);
  doc.text("BarberFlow — Snapshot de Fechamento", 40, 40);

  doc.setFontSize(10);
  doc.text(`Barbearia: ${barbeariaId || "—"}`, 40, 62);
  doc.text(`Fechamento ID: ${id}`, 40, 78);
  doc.text(`Período: ${periodoInicio || "—"} → ${periodoFim || "—"}`, 40, 94);
  doc.text(`Status: ${status}`, 40, 110);
  doc.text(`Gerado em: ${geradoEm}`, 40, 126);

  const rows = (profissionais || []).map((p) => [
    p.profissional_nome || p.nome || "—",
    fmtBRL(p.total_servicos),
    fmtBRL(p.comissao_servicos),
    fmtBRL(p.comissao_pacotes),
    fmtBRL(p.comissao_pdv),
    fmtBRL(p.comissao_bruta),
    fmtBRL(p.adiantamentos_total),
    fmtBRL(p.comissao_liquida),
  ]);

  autoTable(doc, {
    startY: 150,
    head: [
      [
        "Profissional",
        "Serviços (total)",
        "Serviços (comissão)",
        "Pacotes (comissão)",
        "PDV (comissão)",
        "Bruta",
        "Adiant.",
        "Líquida",
      ],
    ],
    body: rows,
    styles: { fontSize: 8 },
    headStyles: { fontSize: 8 },
    margin: { left: 40, right: 40 },
  });

  const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "fechamento";
  doc.save(`snapshot-${safe}.pdf`);
}

function exportPreviaPDF({
  barbeariaId,
  periodoInicio,
  periodoFim,
  titulo,
  kpis,
  tabelaRows,
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const geradoEm = new Date().toLocaleString("pt-BR");

  doc.setFontSize(14);
  doc.text("BarberFlow — Prévia Financeira (Não Oficial)", 40, 40);

  doc.setFontSize(10);
  doc.text(`Barbearia: ${barbeariaId || "—"}`, 40, 62);
  doc.text(`Período: ${periodoInicio || "—"} → ${periodoFim || "—"}`, 40, 78);
  doc.text(`Escopo: ${titulo || "—"}`, 40, 94);
  doc.text(`Gerado em: ${geradoEm}`, 40, 110);

  const kStartY = 132;
  doc.setFontSize(11);
  doc.text("Resumo", 40, kStartY);

  doc.setFontSize(9);
  const lines = (kpis || []).map((k) => `${k.label}: ${k.value}`);
  doc.text(lines, 40, kStartY + 16, { maxWidth: 515 });

  autoTable(doc, {
    startY: kStartY + 60,
    head: [["Profissional", "Serviços", "Pacotes", "PDV (Lucro)", "Comissão Bruta", "Adiant.", "Líquida"]],
    body: tabelaRows || [],
    styles: { fontSize: 8 },
    headStyles: { fontSize: 8 },
    margin: { left: 40, right: 40 },
  });

  const safe = String(titulo || "previa").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "previa";
  doc.save(`previa-${safe}.pdf`);
}

function lsKeyFechamento(barbeariaId) {
  return `bf:last_fechamento_id:${String(barbeariaId || "na").trim()}`;
}
function lsSafeGet(key) {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function lsSafeSet(key, value) {
  try {
    if (!key) return;
    if (!value) return;
    window.localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

export function AdminFinanceiro({ accessToken, barbeariaId, onVoltar }) {
  const {
    loading,
    erro,
    fechamento,
    profissionais,
    fechamentoIdManual,
    setFechamentoIdManual,

    criarFechamento,
    gerarSnapshot,
    concluir,
    carregarProfissionais,

    adiantamentos,
    carregarAdiantamentos,
    criarAdiantamento,
    excluirAdiantamento,

    previa,
    gerarPreviaPeriodo,

    despesas,
    carregarDespesas,
    criarDespesa,
    excluirDespesa,

    selecionarFechamentoPorData,
  } = useAdminFinanceiro({ accessToken, barbeariaId });

  const [tab, setTab] = useState("resumo");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [previaProfId, setPreviaProfId] = useState("");

  useEffect(() => {
    if (dataInicial || dataFinal) return;
    const now = new Date();
    setDataInicial(yyyyMmDd(firstDayOfMonth(now)));
    setDataFinal(yyyyMmDd(lastDayOfMonth(now)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!fechamento?.periodo_inicio || !fechamento?.periodo_fim) return;
    setDataInicial(String(fechamento.periodo_inicio).slice(0, 10));
    setDataFinal(String(fechamento.periodo_fim).slice(0, 10));
  }, [fechamento?.periodo_inicio, fechamento?.periodo_fim]);

  const [fechamentoIdPersistido, setFechamentoIdPersistido] = useState("");
  useEffect(() => {
    if (fechamento?.id) setFechamentoIdPersistido(fechamento.id);
  }, [fechamento?.id]);

  const fechamentoId = (fechamento?.id || fechamentoIdManual || fechamentoIdPersistido || "").trim();

  const [recoveredFromLS, setRecoveredFromLS] = useState(false);
  useEffect(() => {
    if (!barbeariaId) return;
    if (!fechamentoId) return;
    lsSafeSet(lsKeyFechamento(barbeariaId), fechamentoId);
    setRecoveredFromLS(false);
  }, [barbeariaId, fechamentoId]);

  const didRestoreRef = useRef(false);
  useEffect(() => {
    if (!barbeariaId) return;
    if (didRestoreRef.current) return;
    didRestoreRef.current = true;

    if (fechamentoId) return;

    const saved = lsSafeGet(lsKeyFechamento(barbeariaId)).trim();
    if (saved) {
      setFechamentoIdManual(saved);
      setRecoveredFromLS(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barbeariaId]);

  const periodoInicio = (dataInicial || "").trim();
  const periodoFim = (dataFinal || "").trim();

  const [profissionaisLista, setProfissionaisLista] = useState([]);

  useEffect(() => {
    let alive = true;

    async function loadProfissionais() {
      if (!accessToken || !barbeariaId) {
        if (alive) setProfissionaisLista([]);
        return;
      }

      try {
        const list = await apiFetch("/profissionais/admin", {
          method: "GET",
          accessToken,
          barbeariaId,
        });

        const arr = Array.isArray(list) ? list : [];
        const norm = arr
          .map((p) => ({
            id: p.id || p.profissional_id || "",
            nome: p.nome || p.profissional_nome || "",
            ativo: p.ativo,
          }))
          .filter((p) => p.id && p.nome)
          .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));

        if (alive) setProfissionaisLista(norm);
      } catch (e) {
        console.error("Erro ao carregar profissionais do financeiro:", e);
        if (alive) setProfissionaisLista([]);
      }
    }

    loadProfissionais();

    return () => {
      alive = false;
    };
  }, [accessToken, barbeariaId]);

  const optionsProfissionais = useMemo(() => {
    if (Array.isArray(profissionaisLista) && profissionaisLista.length) {
      return profissionaisLista
        .filter((p) => p.ativo !== false)
        .map((p) => ({ id: p.id, nome: p.nome }));
    }

    const list = Array.isArray(profissionais) ? profissionais : [];
    return list
      .map((p) => ({
        id: p.profissional_id || p.id,
        nome: p.profissional_nome || p.nome || "—",
      }))
      .filter((p) => p.id && p.nome && p.nome !== "—")
      .sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  }, [profissionaisLista, profissionais]);

  const nomeProfPorId = useMemo(() => {
    const map = new Map();
    for (const p of optionsProfissionais) map.set(p.id, p.nome);
    return map;
  }, [optionsProfissionais]);

  const [adProfissionalId, setAdProfissionalId] = useState("");
  const [adValor, setAdValor] = useState("");
  const [adData, setAdData] = useState("");
  const [adDescricao, setAdDescricao] = useState("");

  const [dpData, setDpData] = useState("");
  const [dpCategoria, setDpCategoria] = useState("");
  const [dpValor, setDpValor] = useState("");
  const [dpDescricao, setDpDescricao] = useState("");
  const [dpForma, setDpForma] = useState("");

  useEffect(() => {
    if (!periodoInicio || !periodoFim) return;

    carregarAdiantamentos({ dataInicio: periodoInicio, dataFim: periodoFim });
    carregarDespesas({ dataInicio: periodoInicio, dataFim: periodoFim });

    if (!adData) setAdData(toInputDateBR(periodoInicio));
    if (!dpData) setDpData(toInputDateBR(periodoInicio));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoInicio, periodoFim]);

  const triedAutoSelectRef = useRef("");
  useEffect(() => {
    if (tab !== "snapshot") return;
    if (!periodoFim) return;
    if (fechamentoId) return;
    if (typeof selecionarFechamentoPorData !== "function") return;

    const key = `${barbeariaId || ""}|${periodoInicio}|${periodoFim}`;
    if (triedAutoSelectRef.current === key) return;
    triedAutoSelectRef.current = key;

    (async () => {
      try {
        const ret = await selecionarFechamentoPorData(periodoFim);

        const maybeId =
          (typeof ret === "string" ? ret : "") ||
          (ret && typeof ret === "object" && (ret.id || ret.fechamento_id)) ||
          "";

        if (maybeId && !fechamentoId) {
          setFechamentoIdManual(String(maybeId));
        }
      } catch (e) {
        console.warn("Auto-seleção de fechamento falhou:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, periodoInicio, periodoFim, fechamentoId, barbeariaId, selecionarFechamentoPorData]);

  const lastLoadedSnapshotIdRef = useRef("");
  useEffect(() => {
    if (tab !== "snapshot") return;
    if (!fechamentoId) return;

    if (lastLoadedSnapshotIdRef.current === fechamentoId) return;
    lastLoadedSnapshotIdRef.current = fechamentoId;

    carregarProfissionais(fechamentoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, fechamentoId]);

  async function handleCriarFechamento() {
    if (!dataInicial || !dataFinal) return;
    await criarFechamento({ dataInicial, dataFinal });
    setTab("snapshot");
  }

  async function handleGerarPrevia() {
    if (!dataInicial || !dataFinal) return;

    await gerarPreviaPeriodo({ dataInicio: dataInicial, dataFim: dataFinal });

    if (dataInicial && dataFinal) {
      await carregarAdiantamentos({ dataInicio: dataInicial, dataFim: dataFinal });
      await carregarDespesas({ dataInicio: dataInicial, dataFim: dataFinal });
    }

    setTab("resumo");
  }

  async function handleCarregarSnapshot() {
    const id = String(fechamentoIdManual || "").trim();
    if (!id) return;

    if (barbeariaId) lsSafeSet(lsKeyFechamento(barbeariaId), id);

    lastLoadedSnapshotIdRef.current = "";
    await carregarProfissionais(id);

    const fi = periodoInicio;
    const ff = periodoFim;
    if (fi && ff) {
      await carregarAdiantamentos({ dataInicio: fi, dataFim: ff });
      await carregarDespesas({ dataInicio: fi, dataFim: ff });
    }

    setTab("snapshot");
  }

  async function handleCriarAdiantamento(e) {
    e.preventDefault();

    const pid = String(adProfissionalId || "").trim();
    const v = Number(adValor);

    if (!pid) return;
    if (!Number.isFinite(v) || v <= 0) return;
    if (!adData) return;

    const resp = await criarAdiantamento({
      profissionalId: pid,
      valor: v,
      data: adData,
      descricao: adDescricao,
    });

    if (resp?.ok) {
      setAdValor("");
      setAdDescricao("");

      if (periodoInicio && periodoFim) {
        await carregarAdiantamentos({ dataInicio: periodoInicio, dataFim: periodoFim });
      }
    }
  }

  async function handleCriarDespesa(e) {
    e.preventDefault();

    const data = String(dpData || "").trim();
    const categoria = String(dpCategoria || "").trim();
    const valor = Number(dpValor);

    if (!data) return;
    if (!categoria) return;
    if (!Number.isFinite(valor) || valor <= 0) return;

    const resp = await criarDespesa({
      data,
      categoria,
      descricao: dpDescricao,
      valor,
      forma_pagamento: dpForma,
    });

    if (resp?.ok) {
      setDpValor("");
      setDpDescricao("");

      if (periodoInicio && periodoFim) {
        await carregarDespesas({ dataInicio: periodoInicio, dataFim: periodoFim });
      }
    }
  }

  const adiantamentosPendentes = useMemo(
    () => (adiantamentos || []).filter((a) => !a?.fechamento_id),
    [adiantamentos]
  );
  const adiantamentosAbatidos = useMemo(
    () => (adiantamentos || []).filter((a) => !!a?.fechamento_id),
    [adiantamentos]
  );

  const totalAdiantamentosPendentesPeriodo = useMemo(() => {
    return (adiantamentosPendentes || []).reduce((acc, a) => acc + Number(a.valor ?? 0), 0);
  }, [adiantamentosPendentes]);

  const totalAdiantamentosAbatidosPeriodo = useMemo(() => {
    return (adiantamentosAbatidos || []).reduce((acc, a) => acc + Number(a.valor ?? 0), 0);
  }, [adiantamentosAbatidos]);

  const totalAdiantamentosPeriodo = useMemo(() => {
    return Number(totalAdiantamentosPendentesPeriodo) + Number(totalAdiantamentosAbatidosPeriodo);
  }, [totalAdiantamentosPendentesPeriodo, totalAdiantamentosAbatidosPeriodo]);

  const totalDespesasPeriodo = useMemo(() => {
    return (despesas || []).reduce((acc, d) => acc + Number(d.valor ?? 0), 0);
  }, [despesas]);

  const previaPorProfList = useMemo(() => {
    const arr = previa?.comissoes?.por_profissional;
    return Array.isArray(arr) ? arr : [];
  }, [previa]);

  const previaProfRow = useMemo(() => {
    if (!previaPorProfList.length) return null;
    const id = String(previaProfId || "").trim();
    if (!id) return null;
    return (
      previaPorProfList.find((r) => String(r.profissional_id || "").trim() === id) || null
    );
  }, [previaPorProfList, previaProfId]);

  const previaTodosConsolidado = useMemo(() => {
    if (!previaPorProfList.length) return null;

    const sum = (pick) =>
      previaPorProfList.reduce((acc, r) => acc + Number(pick(r) ?? 0), 0);

    const servTotal = sum((r) => r?.servicos?.total);
    const servCom = sum((r) => r?.servicos?.comissao_total);

    const pacTotal = sum((r) => r?.pacotes?.total);
    const pacCom = sum((r) => r?.pacotes?.comissao_total);

    const pdvLucro = sum((r) => r?.pdv?.lucro_total);
    const pdvCom = sum((r) => r?.pdv?.comissao_total);

    const adTotal = sum((r) => r?.adiantamentos?.total);

    const comBruta = servCom + pacCom + pdvCom;
    const comLiquida = comBruta - adTotal;

    return {
      profissional_id: "",
      servicos: { total: servTotal, comissao_total: servCom },
      pacotes: { total: pacTotal, comissao_total: pacCom },
      pdv: { lucro_total: pdvLucro, comissao_total: pdvCom },
      adiantamentos: { total: adTotal },
      total: comBruta,
      liquido: comLiquida,
    };
  }, [previaPorProfList]);

  const previaEscopo = useMemo(() => {
    if (!previa) return null;

    const row = previaProfRow || previaTodosConsolidado;
    if (!row) return null;

    const nome =
      previaProfRow
        ? (nomeProfPorId.get(previaProfRow.profissional_id) || "Profissional")
        : "Todos os profissionais";

    const servTotal = Number(row?.servicos?.total ?? 0);
    const pacTotal = Number(row?.pacotes?.total ?? 0);
    const pdvLucro = Number(row?.pdv?.lucro_total ?? 0);

    const comSrv = Number(row?.servicos?.comissao_total ?? 0);
    const comPac = Number(row?.pacotes?.comissao_total ?? 0);
    const comPdv = Number(row?.pdv?.comissao_total ?? 0);

    const comBruta = Number(row?.total ?? (comSrv + comPac + comPdv));
    const ad = Number(row?.adiantamentos?.total ?? 0);
    const comLiquida = Number(row?.liquido ?? (comBruta - ad));

    const receitasOperacionais = servTotal + pacTotal + pdvLucro;
    const resultadoAntesDespesas = receitasOperacionais - comBruta;

    return {
      nome,
      row,
      servTotal,
      pacTotal,
      pdvLucro,
      comBruta,
      ad,
      comLiquida,
      receitasOperacionais,
      resultadoAntesDespesas,
    };
  }, [previa, previaProfRow, previaTodosConsolidado, nomeProfPorId]);

  const previaResumo = useMemo(() => {
    if (!previa) return null;

    const receitas = previa.receitas || {};
    const com = previa.comissoes || {};

    const servicosTotal = Number(receitas?.servicos?.total ?? 0);
    const pacotesTotal = Number(receitas?.pacotes?.total ?? 0);

    const pdvLucro =
      Number(receitas?.pdv?.lucro ?? 0) ||
      Number(receitas?.pdv?.lucro_total ?? 0) ||
      0;

    const comissaoBruta = Number(com?.total ?? 0);
    const resultadoBaseBackend = Number(receitas?.totais?.resultado_base ?? 0);

    const receitasOperacionais = resultadoBaseBackend || servicosTotal + pacotesTotal + pdvLucro;

    return {
      receitasOperacionais,
      comissaoBruta,
    };
  }, [previa]);

  const resultadoDRE = useMemo(() => {
    if (!previaResumo) return 0;
    return (
      Number(previaResumo.receitasOperacionais) -
      Number(previaResumo.comissaoBruta) -
      Number(totalDespesasPeriodo)
    );
  }, [previaResumo, totalDespesasPeriodo]);

  const fechamentoStatus = String(fechamento?.status || "").toLowerCase();
  const fechamentoExiste = !!fechamentoId;
  const isConfirmado = fechamentoStatus === "confirmado";

  const nextAction = useMemo(() => {
    if (!fechamentoExiste) {
      return {
        tone: "sky",
        text: "Sem fechamento oficial para este período. Crie um ou ajuste o período para visualizar o existente.",
      };
    }
    if (isConfirmado) {
      return { tone: "emerald", text: "Período confirmado. Snapshot e relatórios disponíveis em modo leitura." };
    }
    return {
      tone: "amber",
      text: "Gere o snapshot para congelar números por profissional. Depois, conclua o fechamento para travar o período.",
    };
  }, [fechamentoExiste, isConfirmado]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 px-4 py-6">
      <div className="w-full max-w-6xl mx-auto">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-50">Financeiro (Owner)</h1>
            <p className="text-sm text-slate-400 mt-1">
              Prévia = retrato do período. Fechamento = oficial (snapshot e conclusão).
            </p>
          </div>

          <button
            onClick={onVoltar}
            className="text-xs px-3 py-1 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 transition"
          >
            Voltar ao painel
          </button>
        </header>

        {erro ? (
          <div className="bg-red-900/40 border border-red-700 text-red-100 text-xs px-3 py-2 rounded-lg mb-4">
            {erro}
          </div>
        ) : null}

        <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 mb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2 lg:w-[520px]">
              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Data inicial</label>
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-sm"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Data final</label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGerarPrevia}
                disabled={loading || !dataInicial || !dataFinal}
                className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {loading ? "Carregando..." : "Gerar prévia"}
              </button>

              <button
                onClick={handleCriarFechamento}
                disabled={loading || !dataInicial || !dataFinal}
                className="text-xs px-3 py-2 rounded-lg border border-sky-600 text-sky-200 hover:bg-sky-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                Criar fechamento (oficial)
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-start justify-between gap-3 flex-wrap">
            <div className="text-[11px] text-slate-500 leading-relaxed">
              <div className="mb-1">
                <Badge tone={nextAction.tone}>Próxima ação</Badge>
                {recoveredFromLS ? (
                  <span className="ml-2">
                    <Badge tone="amber">Recarregado do último fechamento</Badge>
                  </span>
                ) : null}
              </div>
              {nextAction.text}
            </div>

            <div className="flex items-center gap-2">
              <Badge tone={fechamentoExiste ? "emerald" : "slate"}>
                {fechamentoExiste ? "Fechamento detectado" : "Sem fechamento"}
              </Badge>
              {fechamento?.status ? (
                <Badge tone={isConfirmado ? "emerald" : "amber"}>Status: {fechamento.status}</Badge>
              ) : null}
              {isConfirmado ? <Badge tone="slate">Modo leitura</Badge> : null}
            </div>
          </div>
        </section>

        <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold text-slate-100">Visão do período</div>
              <div className="text-[11px] text-slate-500">
                {periodoInicio || "—"} → {periodoFim || "—"}
              </div>
            </div>

            <Tabs
              value={tab}
              onChange={(v) => {
                setTab(v);
                if (v === "snapshot") {
                  lastLoadedSnapshotIdRef.current = "";
                }
              }}
              items={[
                { value: "resumo", label: "Resumo" },
                { value: "snapshot", label: "Snapshot" },
                { value: "adiantamentos", label: "Adiantamentos" },
                { value: "despesas", label: "Despesas" },
              ]}
            />
          </div>
        </section>

        {tab === "resumo" ? (
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 mb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-100">Resumo executivo</div>
                <div className="text-[11px] text-slate-500">
                  DRE simplificada: (Serviços + Pacotes + <b>Lucro PDV</b>) − Comissões − Despesas
                </div>
              </div>
              <div className="text-[11px] text-slate-400">Dica: gere prévia sempre que mudar o período.</div>
            </div>

            <div className="mt-3 bg-slate-900/30 border border-slate-700/50 rounded-xl p-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs font-semibold text-slate-100">Prévia por profissional</div>
                  <div className="text-[11px] text-slate-500">
                    Selecione um profissional para ver KPIs dele (a prévia continua sendo “não oficial”).
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={previaProfId}
                    onChange={(e) => setPreviaProfId(e.target.value)}
                    disabled={!previa}
                    className="bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm min-w-[240px] disabled:opacity-60"
                    title={!previa ? "Gere a prévia para habilitar" : ""}
                  >
                    <option value="">Todos os profissionais</option>
                    {optionsProfissionais.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    disabled={!previa}
                    onClick={() => {
                      if (!previaEscopo) return;

                      const titulo = previaEscopo?.nome || "Todos";
                      const kpis = [
                        { label: "Receitas operacionais (Serviços + Pacotes + Lucro PDV)", value: fmtBRL(previaEscopo.receitasOperacionais) },
                        { label: "Comissão bruta", value: fmtBRL(previaEscopo.comBruta) },
                        { label: "Adiantamentos (pendentes no período)", value: fmtBRL(previaEscopo.ad) },
                        { label: "Comissão líquida", value: fmtBRL(previaEscopo.comLiquida) },
                        { label: "Resultado (antes despesas)", value: fmtBRL(previaEscopo.resultadoAntesDespesas) },
                      ];

                      const rows =
                        (previaPorProfList || []).map((r) => {
                          const nome = nomeProfPorId.get(r.profissional_id) || "—";
                          const serv = Number(r?.servicos?.total ?? 0);
                          const pac = Number(r?.pacotes?.total ?? 0);
                          const pdv = Number(r?.pdv?.lucro_total ?? 0);
                          const com = Number(r?.total ?? 0);
                          const ad = Number(r?.adiantamentos?.total ?? 0);
                          const liq = Number(r?.liquido ?? (com - ad));
                          return [nome, fmtBRL(serv), fmtBRL(pac), fmtBRL(pdv), fmtBRL(com), fmtBRL(ad), fmtBRL(liq)];
                        });

                      exportPreviaPDF({
                        barbeariaId,
                        periodoInicio,
                        periodoFim,
                        titulo,
                        kpis,
                        tabelaRows: rows,
                      });
                    }}
                    className="text-xs px-3 py-2 rounded-lg border border-emerald-600 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    title={!previa ? "Gere a prévia para habilitar" : "Exporta PDF da prévia atual"}
                  >
                    Exportar PDF (prévia)
                  </button>
                </div>
              </div>

              {!previa ? (
                <div className="text-[11px] text-slate-500 mt-2">
                  Para habilitar: clique em <b>Gerar prévia</b>.
                </div>
              ) : null}

              {previa && previaEscopo ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <KpiCard title="Serviços (total)" value={fmtBRL(previaEscopo.servTotal)} hint={previaEscopo.nome} tone="sky" />
                  <KpiCard title="Pacotes (total)" value={fmtBRL(previaEscopo.pacTotal)} hint="Receita pacote" tone="sky" />
                  <KpiCard title="PDV (lucro)" value={fmtBRL(previaEscopo.pdvLucro)} hint="Base DRE" tone="sky" />
                  <KpiCard title="Comissão bruta" value={fmtBRL(previaEscopo.comBruta)} hint="Custo" tone="amber" />
                  <KpiCard title="Adiantamentos" value={fmtBRL(previaEscopo.ad)} hint="Pendentes no período" tone="rose" />
                  <KpiCard
                    title="Resultado (antes despesas)"
                    value={fmtBRL(previaEscopo.resultadoAntesDespesas)}
                    hint="Receitas − Comissão"
                    tone={previaEscopo.resultadoAntesDespesas >= 0 ? "emerald" : "rose"}
                  />
                </div>
              ) : null}

              {previa && !previaEscopo ? (
                <div className="text-[11px] text-slate-500 mt-2">
                  Não foi possível montar a prévia por profissional (verifique se a prévia retornou <code>comissoes.por_profissional</code>).
                </div>
              ) : null}
            </div>

            {previaResumo ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard
                  title="Receitas operacionais"
                  value={fmtBRL(previaResumo.receitasOperacionais)}
                  hint="Serviços + Pacotes + Lucro PDV"
                  tone="sky"
                />
                <KpiCard title="Comissões (custo)" value={fmtBRL(previaResumo.comissaoBruta)} hint="Custo real" tone="amber" />
                <KpiCard title="Despesas" value={fmtBRL(totalDespesasPeriodo)} hint="Operacional" tone="rose" />
                <KpiCard
                  title="Resultado (DRE)"
                  value={fmtBRL(resultadoDRE)}
                  hint="Se negativo: rever despesas/comissões"
                  tone={resultadoDRE >= 0 ? "emerald" : "rose"}
                />
              </div>
            ) : (
              <div className="text-sm text-slate-400 mt-2">
                Nenhuma prévia carregada. Clique em <b>Gerar prévia</b>.
              </div>
            )}
          </section>
        ) : null}

        {tab === "snapshot" ? (
          <>
            <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 mb-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Fechamento oficial</div>
                  <div className="text-[11px] text-slate-500">
                    Snapshot congela comissões por profissional. Concluir trava o período. PDF documenta o snapshot.
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!fechamentoId) return;
                      await gerarSnapshot(fechamentoId);
                      if (barbeariaId) lsSafeSet(lsKeyFechamento(barbeariaId), fechamentoId);
                      lastLoadedSnapshotIdRef.current = "";
                      await carregarProfissionais(fechamentoId);
                    }}
                    disabled={loading || !fechamentoId || isConfirmado}
                    className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    title={isConfirmado ? "Confirmado: modo leitura" : ""}
                  >
                    Gerar snapshot
                  </button>

                  <button
                    onClick={async () => {
                      if (!fechamentoId) return;
                      await concluir(fechamentoId);
                      if (barbeariaId) lsSafeSet(lsKeyFechamento(barbeariaId), fechamentoId);
                      lastLoadedSnapshotIdRef.current = "";
                      await carregarProfissionais(fechamentoId);
                    }}
                    disabled={loading || !fechamentoId || isConfirmado}
                    className="text-xs px-3 py-2 rounded-lg border border-sky-600 text-sky-200 hover:bg-sky-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    Concluir fechamento
                  </button>

                  <button
                    type="button"
                    onClick={() => exportSnapshotPDF({ barbeariaId, fechamento, fechamentoId, profissionais })}
                    disabled={!profissionais?.length}
                    className="text-xs px-3 py-2 rounded-lg border border-emerald-600 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                    title={!profissionais?.length ? "Carregue um snapshot primeiro" : ""}
                  >
                    Exportar PDF
                  </button>
                </div>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">
                  Ferramentas avançadas (carregar fechamento por ID)
                </summary>

                <div className="mt-2 grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Fechamento ID (manual)</label>
                    <input
                      value={fechamentoIdManual}
                      onChange={(e) => setFechamentoIdManual(e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                  <button
                    onClick={handleCarregarSnapshot}
                    disabled={loading || !fechamentoIdManual}
                    className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    Carregar snapshot
                  </button>
                </div>
              </details>
            </section>

            <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
                <div>
                  <div className="text-sm font-semibold text-slate-100">Snapshot por profissional</div>
                  <div className="text-[11px] text-slate-500">
                    Ao entrar nessa aba, o sistema tenta recuperar o último fechamento (refresh) e carregar o snapshot.
                  </div>
                </div>

                {profissionais?.length ? <Badge tone="emerald">{profissionais.length} profissionais</Badge> : null}
              </div>

              {profissionais?.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-700/60">
                        <th className="text-left py-2 pr-2 font-medium">Profissional</th>
                        <th className="text-right py-2 px-2 font-medium">Serviços (total)</th>
                        <th className="text-right py-2 px-2 font-medium">Serviços (comissão)</th>
                        <th className="text-right py-2 px-2 font-medium">Pacotes (comissão)</th>
                        <th className="text-right py-2 px-2 font-medium">PDV (comissão)</th>
                        <th className="text-right py-2 px-2 font-medium">Bruta</th>
                        <th className="text-right py-2 px-2 font-medium">Adiant.</th>
                        <th className="text-right py-2 pl-2 font-medium">Líquida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profissionais.map((p) => (
                        <tr key={p.profissional_id || p.id} className="border-b border-slate-800/60">
                          <td className="py-2 pr-2 text-slate-100">{p.profissional_nome || p.nome || "—"}</td>
                          <td className="py-2 px-2 text-right">{fmtBRL(p.total_servicos)}</td>
                          <td className="py-2 px-2 text-right">{fmtBRL(p.comissao_servicos)}</td>
                          <td className="py-2 px-2 text-right">{fmtBRL(p.comissao_pacotes)}</td>
                          <td className="py-2 px-2 text-right">{fmtBRL(p.comissao_pdv)}</td>
                          <td className="py-2 px-2 text-right font-semibold">{fmtBRL(p.comissao_bruta)}</td>
                          <td className="py-2 px-2 text-right">{fmtBRL(p.adiantamentos_total)}</td>
                          <td className="py-2 pl-2 text-right font-semibold text-emerald-300">
                            {fmtBRL(p.comissao_liquida)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="text-[11px] text-slate-500 mt-3">
                    Regra: serviços entram no fechamento quando <code>agendamentos.status</code> = <code>"confirmado"</code>.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  {fechamentoId
                    ? "Snapshot vazio. Gere snapshot (se não confirmado) ou recarregue."
                    : "Nenhum fechamento selecionado para este período."}
                </div>
              )}
            </section>
          </>
        ) : null}

        {tab === "adiantamentos" ? (
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-100">Adiantamentos (caixa)</div>
                <div className="text-[11px] text-slate-500">Afeta caixa, não DRE.</div>
              </div>

              <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                <Badge tone="slate">
                  Pendentes: {adiantamentosPendentes.length} ({fmtBRL(totalAdiantamentosPendentesPeriodo)})
                </Badge>
                <Badge tone="slate">
                  Abatidos: {adiantamentosAbatidos.length} ({fmtBRL(totalAdiantamentosAbatidosPeriodo)})
                </Badge>
                <Badge tone="slate">Total: {fmtBRL(totalAdiantamentosPeriodo)}</Badge>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
              <form
                onSubmit={handleCriarAdiantamento}
                className="bg-slate-900/30 border border-slate-700/50 rounded-xl p-3 space-y-3"
              >
                <div className="text-xs font-semibold text-slate-100">Registrar adiantamento</div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Profissional</label>
                  <select
                    value={adProfissionalId}
                    onChange={(e) => setAdProfissionalId(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {optionsProfissionais.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Data</label>
                    <input
                      type="date"
                      value={adData}
                      onChange={(e) => setAdData(e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Valor</label>
                    <input
                      inputMode="decimal"
                      value={adValor}
                      onChange={(e) => setAdValor(e.target.value)}
                      placeholder="Ex.: 50.00"
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Descrição (opcional)</label>
                  <input
                    value={adDescricao}
                    onChange={(e) => setAdDescricao(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !adProfissionalId || !adData || !adValor || !(periodoInicio && periodoFim)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-amber-500 text-amber-200 hover:bg-amber-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {loading ? "Salvando..." : "Salvar adiantamento"}
                </button>
              </form>

              <div className="bg-slate-900/30 border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-100">Lançamentos</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (periodoInicio && periodoFim)
                        carregarAdiantamentos({ dataInicio: periodoInicio, dataFim: periodoFim });
                    }}
                    disabled={loading || !(periodoInicio && periodoFim)}
                    className="text-[11px] px-2 py-1 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    Atualizar
                  </button>
                </div>

                {adiantamentos?.length ? (
                  <div className="max-h-[360px] overflow-y-auto pr-1">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="sticky top-0 bg-slate-900/90 backdrop-blur">
                        <tr className="text-slate-400 border-b border-slate-700/60">
                          <th className="text-left py-2 pr-2 font-medium">Data</th>
                          <th className="text-left py-2 px-2 font-medium">Profissional</th>
                          <th className="text-right py-2 px-2 font-medium">Valor</th>
                          <th className="text-left py-2 px-2 font-medium">Status</th>
                          <th className="text-right py-2 pl-2 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adiantamentos.map((a) => {
                          const nome = nomeProfPorId.get(a.profissional_id) || "—";
                          const abatido = !!a.fechamento_id;
                          return (
                            <tr key={a.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                              <td className="py-2 pr-2">{String(a.data || "").slice(0, 10)}</td>
                              <td className="py-2 px-2">{nome}</td>
                              <td className="py-2 px-2 text-right">{fmtBRL(a.valor)}</td>
                              <td className="py-2 px-2">
                                <Badge tone={abatido ? "emerald" : "amber"}>{abatido ? "Abatido" : "Pendente"}</Badge>
                              </td>
                              <td className="py-2 pl-2 text-right">
                                <button
                                  type="button"
                                  disabled={loading || abatido}
                                  onClick={async () => {
                                    const resp = await excluirAdiantamento(a.id);
                                    if (!resp?.ok) alert(resp?.message || "Erro ao excluir adiantamento.");
                                    if (periodoInicio && periodoFim) {
                                      await carregarAdiantamentos({ dataInicio: periodoInicio, dataFim: periodoFim });
                                    }
                                  }}
                                  className={
                                    "text-[11px] px-2 py-1 rounded-lg border transition " +
                                    (abatido
                                      ? "border-slate-700 text-slate-500 cursor-not-allowed"
                                      : "border-red-600 text-red-200 hover:bg-red-500/10")
                                  }
                                >
                                  Excluir
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    {periodoInicio && periodoFim
                      ? "Nenhum adiantamento no período."
                      : "Defina um período para listar os adiantamentos."}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "despesas" ? (
          <section className="bg-slate-900/40 border border-slate-700/60 rounded-2xl p-4 mb-4">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div>
                <div className="text-sm font-semibold text-slate-100">Despesas (operacional)</div>
                <div className="text-[11px] text-slate-500">Entram na DRE do período.</div>
              </div>

              <div className="text-xs text-slate-300">
                Total no período: <span className="font-semibold text-rose-200">{fmtBRL(totalDespesasPeriodo)}</span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
              <form
                onSubmit={handleCriarDespesa}
                className="bg-slate-900/30 border border-slate-700/50 rounded-xl p-3 space-y-3"
              >
                <div className="text-xs font-semibold text-slate-100">Registrar despesa</div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Data</label>
                    <input
                      type="date"
                      value={dpData}
                      onChange={(e) => setDpData(e.target.value)}
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 mb-1 block">Valor</label>
                    <input
                      inputMode="decimal"
                      value={dpValor}
                      onChange={(e) => setDpValor(e.target.value)}
                      placeholder="Ex.: 120.00"
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Categoria</label>
                  <input
                    value={dpCategoria}
                    onChange={(e) => setDpCategoria(e.target.value)}
                    placeholder='Ex.: "Aluguel", "Energia", "Produtos"...'
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Forma de pagamento (opcional)</label>
                  <input
                    value={dpForma}
                    onChange={(e) => setDpForma(e.target.value)}
                    placeholder='Ex.: "Pix", "Cartão"...'
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Descrição (opcional)</label>
                  <input
                    value={dpDescricao}
                    onChange={(e) => setDpDescricao(e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-2 py-2 text-slate-100 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !dpData || !dpCategoria || !dpValor || !(periodoInicio && periodoFim)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-rose-500 text-rose-200 hover:bg-rose-500/10 disabled:opacity-60 disabled:cursor-not-allowed transition"
                >
                  {loading ? "Salvando..." : "Salvar despesa"}
                </button>
              </form>

              <div className="bg-slate-900/30 border border-slate-700/50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-100">Lançamentos</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (periodoInicio && periodoFim)
                        carregarDespesas({ dataInicio: periodoInicio, dataFim: periodoFim });
                    }}
                    disabled={loading || !(periodoInicio && periodoFim)}
                    className="text-[11px] px-2 py-1 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    Atualizar
                  </button>
                </div>

                {despesas?.length ? (
                  <div className="max-h-[360px] overflow-y-auto pr-1">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="sticky top-0 bg-slate-900/90 backdrop-blur">
                        <tr className="text-slate-400 border-b border-slate-700/60">
                          <th className="text-left py-2 pr-2 font-medium">Data</th>
                          <th className="text-left py-2 px-2 font-medium">Categoria</th>
                          <th className="text-left py-2 px-2 font-medium">Descrição</th>
                          <th className="text-right py-2 px-2 font-medium">Valor</th>
                          <th className="text-right py-2 pl-2 font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {despesas.map((d) => (
                          <tr key={d.id} className="border-b border-slate-800/60 hover:bg-slate-800/30">
                            <td className="py-2 pr-2">{String(d.data || "").slice(0, 10)}</td>
                            <td className="py-2 px-2">{d.categoria || "—"}</td>
                            <td className="py-2 px-2 text-slate-300">
                              <div className="truncate max-w-[360px]" title={d.descricao || ""}>
                                {d.descricao || "—"}
                              </div>
                              {d.forma_pagamento ? (
                                <div className="text-[10px] text-slate-500">({d.forma_pagamento})</div>
                              ) : null}
                            </td>
                            <td className="py-2 px-2 text-right text-rose-200">{fmtBRL(d.valor)}</td>
                            <td className="py-2 pl-2 text-right">
                              <button
                                type="button"
                                disabled={loading}
                                onClick={async () => {
                                  const resp = await excluirDespesa(d.id);
                                  if (!resp?.ok) alert(resp?.message || "Erro ao excluir despesa.");
                                  if (periodoInicio && periodoFim) {
                                    await carregarDespesas({ dataInicio: periodoInicio, dataFim: periodoFim });
                                  }
                                }}
                                className="text-[11px] px-2 py-1 rounded-lg border border-red-600 text-red-200 hover:bg-red-500/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400">
                    {periodoInicio && periodoFim ? "Nenhuma despesa no período." : "Defina um período para listar as despesas."}
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}