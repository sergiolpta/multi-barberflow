// src/components/admin/AdminFinanceiro.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminFinanceiro } from "../../hooks/useAdminFinanceiro";
import { apiFetch } from "../../config/api";
import { Badge } from "../common/Badge";
import { formatBRL as fmtBRL } from "../../utils/formatters";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
            className={[
              "rounded-xl border px-3 py-2 text-[11px] font-medium transition",
              active
                ? "border-[var(--accent-primary)] bg-[var(--accent-primary-soft)] text-[var(--accent-primary)] shadow-sm"
                : "border-[var(--border-color)] bg-[var(--bg-panel-strong)] text-[var(--text-muted)] hover:bg-[var(--bg-panel)]",
            ].join(" ")}
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
    slate: "border-[var(--border-color)] bg-[var(--bg-panel-strong)]",
    sky: "border-sky-500/20 bg-sky-500/10",
    emerald: "border-emerald-500/20 bg-emerald-500/10",
    amber: "border-amber-500/20 bg-amber-500/10",
    rose: "border-rose-500/20 bg-rose-500/10",
    red: "border-red-500/20 bg-red-500/10",
  };

  const valueTone = {
    slate: "text-[var(--text-app)]",
    sky: "text-sky-700",
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    red: "text-red-700",
  };

  return (
    <div
      className={`rounded-2xl border p-4 shadow-[var(--shadow-soft)] ${toneMap[tone] || toneMap.slate}`}
    >
      <div className="text-[11px] font-medium text-[var(--text-muted)]">{title}</div>
      <div className={`mt-2 text-lg font-bold ${valueTone[tone] || valueTone.slate}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-[var(--text-soft)]">{hint}</div> : null}
    </div>
  );
}

async function loadImageAsDataUrl(url) {
  if (!url) return null;

  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) throw new Error(`Falha ao baixar imagem: ${res.status}`);

    const blob = await res.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Não foi possível carregar logo para o PDF:", err);
    return null;
  }
}

async function addBrandToPdf(doc, { barbeariaNome, barbeariaLogoUrl, titulo, subtitulo }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  let headerTop = 36;
  let textX = 40;

  const logoDataUrl = await loadImageAsDataUrl(barbeariaLogoUrl);

  if (logoDataUrl) {
    try {
      const imgProps = doc.getImageProperties(logoDataUrl);
      const boxW = 54;
      const boxH = 54;

      const ratio = Math.min(boxW / imgProps.width, boxH / imgProps.height);
      const imgW = imgProps.width * ratio;
      const imgH = imgProps.height * ratio;

      const boxX = 40;
      const boxY = 28;
      const imgX = boxX + (boxW - imgW) / 2;
      const imgY = boxY + (boxH - imgH) / 2;

      doc.setDrawColor(220, 220, 220);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(boxX, boxY, boxW, boxH, 8, 8, "FD");
      doc.addImage(logoDataUrl, "JPEG", imgX, imgY, imgW, imgH);

      textX = 108;
      headerTop = 40;
    } catch (err) {
      console.warn("Falha ao inserir logo no PDF:", err);
    }
  }

  doc.setFontSize(16);
  doc.text(barbeariaNome || "Barbearia", textX, headerTop);

  doc.setFontSize(12);
  doc.text(titulo || "Relatório", textX, headerTop + 18);

  if (subtitulo) {
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(subtitulo, textX, headerTop + 34, { maxWidth: pageWidth - textX - 40 });
    doc.setTextColor(0, 0, 0);
  }

  return {
    contentStartY: logoDataUrl ? 110 : 86,
  };
}

async function exportSnapshotPDF({
  barbeariaId,
  barbeariaNome,
  barbeariaLogoUrl,
  fechamento,
  fechamentoId,
  profissionais,
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const id = fechamentoId || fechamento?.id || "—";
  const periodoInicio = String(fechamento?.periodo_inicio || "").slice(0, 10);
  const periodoFim = String(fechamento?.periodo_fim || "").slice(0, 10);
  const status = String(fechamento?.status || "—");
  const geradoEm = new Date().toLocaleString("pt-BR");

  const { contentStartY } = await addBrandToPdf(doc, {
    barbeariaNome,
    barbeariaLogoUrl,
    titulo: "Snapshot de Fechamento",
    subtitulo: "Documento gerado pelo módulo financeiro com dados congelados por profissional.",
  });

  doc.setFontSize(10);
  doc.text(`Barbearia ID: ${barbeariaId || "—"}`, 40, contentStartY);
  doc.text(`Fechamento ID: ${id}`, 40, contentStartY + 16);
  doc.text(`Período: ${periodoInicio || "—"} → ${periodoFim || "—"}`, 40, contentStartY + 32);
  doc.text(`Status: ${status}`, 40, contentStartY + 48);
  doc.text(`Gerado em: ${geradoEm}`, 40, contentStartY + 64);

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
    startY: contentStartY + 88,
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

async function exportPreviaPDF({
  barbeariaId,
  barbeariaNome,
  barbeariaLogoUrl,
  periodoInicio,
  periodoFim,
  titulo,
  kpis,
  tabelaRows,
  detalhes, // { servicos, pdv, pacotes } — presente quando profissional específico selecionado
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const geradoEm = new Date().toLocaleString("pt-BR");

  const { contentStartY } = await addBrandToPdf(doc, {
    barbeariaNome,
    barbeariaLogoUrl,
    titulo: "Prévia Financeira (Não Oficial)",
    subtitulo: "Relatório gerencial para análise do período. Não substitui fechamento oficial.",
  });

  doc.setFontSize(10);
  doc.text(`Barbearia ID: ${barbeariaId || "—"}`, 40, contentStartY);
  doc.text(`Período: ${periodoInicio || "—"} → ${periodoFim || "—"}`, 40, contentStartY + 16);
  doc.text(`Escopo: ${titulo || "—"}`, 40, contentStartY + 32);
  doc.text(`Gerado em: ${geradoEm}`, 40, contentStartY + 48);

  const kStartY = contentStartY + 74;
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

  // --- Detalhes por categoria (somente quando profissional específico selecionado) ---
  if (detalhes) {
    const afterTable = doc.lastAutoTable?.finalY ?? (kStartY + 120);

    // SERVIÇOS
    doc.setFontSize(11);
    doc.text("Serviços realizados", 40, afterTable + 24);

    const servicosRows = (detalhes.servicos || []).map((s) => [
      s.data,
      s.servico_nome,
      fmtBRL(s.preco),
      `${Number(s.comissao_pct || 0).toFixed(1)}%`,
      fmtBRL(s.comissao_valor),
    ]);

    if (servicosRows.length === 0) {
      doc.setFontSize(8);
      doc.text("Nenhum serviço no período.", 40, afterTable + 40);
    } else {
      autoTable(doc, {
        startY: afterTable + 36,
        head: [["Data", "Serviço", "Preço", "Comissão %", "Comissão R$"]],
        body: servicosRows,
        styles: { fontSize: 8 },
        headStyles: { fontSize: 8 },
        margin: { left: 40, right: 40 },
      });
    }

    const afterServicos = doc.lastAutoTable?.finalY ?? (afterTable + 60);

    // PDV
    doc.setFontSize(11);
    doc.text("Vendas PDV", 40, afterServicos + 24);

    const pdvRows = [];
    for (const v of detalhes.pdv || []) {
      const itensDesc = (v.itens || [])
        .map((i) => `${i.nome} x${i.quantidade}`)
        .join(", ") || "—";
      pdvRows.push([v.data, itensDesc, fmtBRL(v.total), fmtBRL(v.lucro_total), fmtBRL(v.comissao_valor)]);
    }

    if (pdvRows.length === 0) {
      doc.setFontSize(8);
      doc.text("Nenhuma venda PDV no período.", 40, afterServicos + 40);
    } else {
      autoTable(doc, {
        startY: afterServicos + 36,
        head: [["Data", "Itens", "Total", "Lucro", "Comissão R$"]],
        body: pdvRows,
        styles: { fontSize: 8 },
        headStyles: { fontSize: 8 },
        columnStyles: { 1: { cellWidth: 200 } },
        margin: { left: 40, right: 40 },
      });
    }

    const afterPdv = doc.lastAutoTable?.finalY ?? (afterServicos + 60);

    // PACOTES
    doc.setFontSize(11);
    doc.text("Pacotes", 40, afterPdv + 24);

    const pacotesRows = (detalhes.pacotes || []).map((p) => [
      p.pago_em,
      p.competencia,
      p.cliente_nome,
      fmtBRL(p.valor),
      `${Number(p.comissao_pct || 0).toFixed(1)}%`,
      fmtBRL(p.comissao_valor),
    ]);

    if (pacotesRows.length === 0) {
      doc.setFontSize(8);
      doc.text("Nenhum pacote no período.", 40, afterPdv + 40);
    } else {
      autoTable(doc, {
        startY: afterPdv + 36,
        head: [["Pago em", "Competência", "Cliente", "Valor", "Comissão %", "Comissão R$"]],
        body: pacotesRows,
        styles: { fontSize: 8 },
        headStyles: { fontSize: 8 },
        margin: { left: 40, right: 40 },
      });
    }
  }

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

function SectionCard({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-[26px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-panel)] backdrop-blur-xl md:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-[var(--text-app)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function AdminFinanceiro({
  accessToken,
  barbeariaId,
  barbeariaNome,
  barbeariaLogoUrl,
  onVoltar,
}) {
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
  } = useAdminFinanceiro({ accessToken });

  const [tab, setTab] = useState("resumo");
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [previaProfId, setPreviaProfId] = useState("");

  useEffect(() => {
    if (dataInicial || dataFinal) return;
    const now = new Date();
    setDataInicial(yyyyMmDd(firstDayOfMonth(now)));
    setDataFinal(yyyyMmDd(lastDayOfMonth(now)));
  }, [dataInicial, dataFinal]);

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
  }, [barbeariaId, fechamentoId, setFechamentoIdManual]);

  const periodoInicio = (dataInicial || "").trim();
  const periodoFim = (dataFinal || "").trim();

  const [profissionaisLista, setProfissionaisLista] = useState([]);

  useEffect(() => {
    let alive = true;

    async function loadProfissionais() {
      if (!accessToken) {
        if (alive) setProfissionaisLista([]);
        return;
      }

      try {
        const list = await apiFetch("/profissionais/admin", {
          method: "GET",
          accessToken,
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
  }, [accessToken]);

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
  }, [
    periodoInicio,
    periodoFim,
    adData,
    dpData,
    carregarAdiantamentos,
    carregarDespesas,
  ]);

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
  }, [
    tab,
    periodoInicio,
    periodoFim,
    fechamentoId,
    barbeariaId,
    selecionarFechamentoPorData,
    setFechamentoIdManual,
  ]);

  const lastLoadedSnapshotIdRef = useRef("");
  useEffect(() => {
    if (tab !== "snapshot") return;
    if (!fechamentoId) return;

    if (lastLoadedSnapshotIdRef.current === fechamentoId) return;
    lastLoadedSnapshotIdRef.current = fechamentoId;

    carregarProfissionais(fechamentoId);
  }, [tab, fechamentoId, carregarProfissionais]);

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
    <div className="min-h-screen bg-[var(--bg-app)] px-4 py-8 text-[var(--text-app)] md:py-10">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-8 overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-500 via-sky-500 to-indigo-500" />
          <div className="flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {barbeariaLogoUrl ? (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/60 bg-white/95 p-3 shadow-xl shadow-black/10">
                  <img
                    src={barbeariaLogoUrl}
                    alt={barbeariaNome || "Logo da barbearia"}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-emerald-500/10 text-3xl">
                  💰
                </div>
              )}

              <div className="min-w-0">
                <div className="mb-2 inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                  Financeiro administrativo
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-[var(--text-app)] md:text-3xl">
                  {barbeariaNome || "Financeiro"}{" "}
                  <span className="text-[var(--text-muted)]">(Owner)</span>
                </h1>

                <p className="mt-2 max-w-3xl text-sm text-[var(--text-muted)] md:text-[15px]">
                  Analise resultado do período, prévias operacionais, snapshot oficial, adiantamentos e despesas da barbearia.
                </p>
              </div>
            </div>

            <button
              onClick={onVoltar}
              className="inline-flex items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-panel)]"
            >
              Voltar ao painel
            </button>
          </div>
        </header>

        {erro ? (
          <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
            {erro}
          </div>
        ) : null}

        <SectionCard
          title="Configuração do período"
          subtitle="Defina o intervalo de análise e escolha se deseja gerar prévia ou criar fechamento oficial."
          actions={
            <>
              <button
                onClick={handleGerarPrevia}
                disabled={loading || !dataInicial || !dataFinal}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Carregando..." : "Gerar prévia"}
              </button>

              <button
                onClick={handleCriarFechamento}
                disabled={loading || !dataInicial || !dataFinal}
                className="rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Criar fechamento oficial
              </button>
            </>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-3 sm:grid-cols-2 max-w-2xl">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                  Data inicial
                </label>
                <input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => setDataInicial(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                  Data final
                </label>
                <input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-start gap-2">
              <Badge tone={nextAction.tone}>Próxima ação</Badge>
              {recoveredFromLS ? <Badge tone="amber">Último fechamento recuperado</Badge> : null}
              <Badge tone={fechamentoExiste ? "emerald" : "slate"}>
                {fechamentoExiste ? "Fechamento detectado" : "Sem fechamento"}
              </Badge>
              {fechamento?.status ? (
                <Badge tone={isConfirmado ? "emerald" : "amber"}>Status: {fechamento.status}</Badge>
              ) : null}
              {isConfirmado ? <Badge tone="slate">Modo leitura</Badge> : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-3 text-sm text-[var(--text-muted)]">
            {nextAction.text}
          </div>
        </SectionCard>

        <div className="my-4 rounded-[22px] border border-[var(--border-color)] bg-[var(--bg-panel)] p-4 shadow-[var(--shadow-panel)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text-app)]">Visão do período</div>
              <div className="mt-1 text-[11px] text-[var(--text-muted)]">
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
        </div>

        {tab === "resumo" ? (
          <SectionCard
            title="Resumo executivo"
            subtitle="DRE simplificada: serviços + pacotes + lucro PDV − comissões − despesas."
          >
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[var(--text-app)]">
                    Prévia por profissional
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--text-muted)]">
                    Selecione um profissional para ver KPIs individuais. A prévia continua sendo não oficial.
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={previaProfId}
                    onChange={(e) => setPreviaProfId(e.target.value)}
                    disabled={!previa}
                    className="min-w-[240px] rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-[var(--accent-primary)] disabled:opacity-60"
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
                    onClick={async () => {
                      if (!previaEscopo) return;

                      const titulo = previaEscopo?.nome || "Todos";
                      const kpis = [
                        {
                          label: "Receitas operacionais (Serviços + Pacotes + Lucro PDV)",
                          value: fmtBRL(previaEscopo.receitasOperacionais),
                        },
                        { label: "Comissão bruta", value: fmtBRL(previaEscopo.comBruta) },
                        {
                          label: "Adiantamentos (pendentes no período)",
                          value: fmtBRL(previaEscopo.ad),
                        },
                        { label: "Comissão líquida", value: fmtBRL(previaEscopo.comLiquida) },
                        {
                          label: "Resultado (antes despesas)",
                          value: fmtBRL(previaEscopo.resultadoAntesDespesas),
                        },
                      ];

                      const rows = (previaPorProfList || []).map((r) => {
                        const nome = nomeProfPorId.get(r.profissional_id) || "—";
                        const serv = Number(r?.servicos?.total ?? 0);
                        const pac = Number(r?.pacotes?.total ?? 0);
                        const pdv = Number(r?.pdv?.lucro_total ?? 0);
                        const com = Number(r?.total ?? 0);
                        const ad = Number(r?.adiantamentos?.total ?? 0);
                        const liq = Number(r?.liquido ?? (com - ad));
                        return [
                          nome,
                          fmtBRL(serv),
                          fmtBRL(pac),
                          fmtBRL(pdv),
                          fmtBRL(com),
                          fmtBRL(ad),
                          fmtBRL(liq),
                        ];
                      });

                      // Busca detalhes individuais quando profissional específico selecionado
                      let detalhes = null;
                      if (previaProfId) {
                        try {
                          detalhes = await apiFetch(
                            `/financeiro/previa/profissional?profissional_id=${previaProfId}&data_inicio=${periodoInicio}&data_fim=${periodoFim}`,
                            { accessToken, method: "GET" }
                          );
                        } catch (err) {
                          console.error("Erro ao buscar detalhes do profissional:", err);
                        }
                      }

                      await exportPreviaPDF({
                        barbeariaId,
                        barbeariaNome,
                        barbeariaLogoUrl,
                        periodoInicio,
                        periodoFim,
                        titulo,
                        kpis,
                        tabelaRows: rows,
                        detalhes,
                      });
                    }}
                    className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Exportar PDF
                  </button>
                </div>
              </div>

              {!previa ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  Nenhuma prévia carregada. Clique em <b>Gerar prévia</b>.
                </div>
              ) : null}

              {previa && previaEscopo ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <KpiCard
                    title="Serviços (total)"
                    value={fmtBRL(previaEscopo.servTotal)}
                    hint={previaEscopo.nome}
                    tone="sky"
                  />
                  <KpiCard
                    title="Pacotes (total)"
                    value={fmtBRL(previaEscopo.pacTotal)}
                    hint="Receita pacote"
                    tone="sky"
                  />
                  <KpiCard
                    title="PDV (lucro)"
                    value={fmtBRL(previaEscopo.pdvLucro)}
                    hint="Base DRE"
                    tone="sky"
                  />
                  <KpiCard
                    title="Comissão bruta"
                    value={fmtBRL(previaEscopo.comBruta)}
                    hint="Custo"
                    tone="amber"
                  />
                  <KpiCard
                    title="Adiantamentos"
                    value={fmtBRL(previaEscopo.ad)}
                    hint="Pendentes no período"
                    tone="rose"
                  />
                  <KpiCard
                    title="Resultado (antes despesas)"
                    value={fmtBRL(previaEscopo.resultadoAntesDespesas)}
                    hint="Receitas − Comissão"
                    tone={previaEscopo.resultadoAntesDespesas >= 0 ? "emerald" : "rose"}
                  />
                </div>
              ) : null}

              {previa && !previaEscopo ? (
                <div className="mt-4 rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                  Não foi possível montar a prévia por profissional.
                </div>
              ) : null}

              {previaResumo ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard
                    title="Receitas operacionais"
                    value={fmtBRL(previaResumo.receitasOperacionais)}
                    hint="Serviços + Pacotes + Lucro PDV"
                    tone="sky"
                  />
                  <KpiCard
                    title="Comissões (custo)"
                    value={fmtBRL(previaResumo.comissaoBruta)}
                    hint="Custo real"
                    tone="amber"
                  />
                  <KpiCard
                    title="Despesas"
                    value={fmtBRL(totalDespesasPeriodo)}
                    hint="Operacional"
                    tone="rose"
                  />
                  <KpiCard
                    title="Resultado (DRE)"
                    value={fmtBRL(resultadoDRE)}
                    hint="Se negativo: rever despesas/comissões"
                    tone={resultadoDRE >= 0 ? "emerald" : "rose"}
                  />
                </div>
              ) : null}
            </div>
          </SectionCard>
        ) : null}

        {tab === "snapshot" ? (
          <div className="space-y-4">
            <SectionCard
              title="Fechamento oficial"
              subtitle="Snapshot congela comissões por profissional. Concluir trava o período."
              actions={
                <>
                  <button
                    onClick={async () => {
                      if (!fechamentoId) return;
                      await gerarSnapshot(fechamentoId);
                      if (barbeariaId) lsSafeSet(lsKeyFechamento(barbeariaId), fechamentoId);
                      lastLoadedSnapshotIdRef.current = "";
                      await carregarProfissionais(fechamentoId);
                    }}
                    disabled={loading || !fechamentoId || isConfirmado}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Concluir fechamento
                  </button>

                  <button
                    type="button"
                    onClick={async () =>
                      await exportSnapshotPDF({
                        barbeariaId,
                        barbeariaNome,
                        barbeariaLogoUrl,
                        fechamento,
                        fechamentoId,
                        profissionais,
                      })
                    }
                    disabled={!profissionais?.length}
                    className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Exportar PDF
                  </button>
                </>
              }
            >
              <details>
                <summary className="cursor-pointer text-[11px] text-[var(--text-muted)] hover:text-[var(--text-app)]">
                  Ferramentas avançadas (carregar fechamento por ID)
                </summary>

                <div className="mt-3 grid items-end gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                      Fechamento ID (manual)
                    </label>
                    <input
                      value={fechamentoIdManual}
                      onChange={(e) => setFechamentoIdManual(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <button
                    onClick={handleCarregarSnapshot}
                    disabled={loading || !fechamentoIdManual}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-2.5 text-sm font-medium text-[var(--text-app)] transition hover:bg-[var(--bg-panel)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Carregar snapshot
                  </button>
                </div>
              </details>
            </SectionCard>

            <SectionCard
              title="Snapshot por profissional"
              subtitle="Ao entrar nessa aba, o sistema tenta recuperar o último fechamento e carregar o snapshot."
              actions={profissionais?.length ? <Badge tone="emerald">{profissionais.length} profissionais</Badge> : null}
            >
              {profissionais?.length ? (
                <div className="overflow-x-auto rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)]">
                  <table className="w-full border-collapse text-[12px]">
                    <thead>
                      <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                        <th className="px-4 py-3 text-left font-medium">Profissional</th>
                        <th className="px-3 py-3 text-right font-medium">Serviços (total)</th>
                        <th className="px-3 py-3 text-right font-medium">Serviços (comissão)</th>
                        <th className="px-3 py-3 text-right font-medium">Pacotes (comissão)</th>
                        <th className="px-3 py-3 text-right font-medium">PDV (comissão)</th>
                        <th className="px-3 py-3 text-right font-medium">Bruta</th>
                        <th className="px-3 py-3 text-right font-medium">Adiant.</th>
                        <th className="px-4 py-3 text-right font-medium">Líquida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profissionais.map((p) => (
                        <tr key={p.profissional_id || p.id} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-panel)]">
                          <td className="px-4 py-3 text-[var(--text-app)]">
                            {p.profissional_nome || p.nome || "—"}
                          </td>
                          <td className="px-3 py-3 text-right">{fmtBRL(p.total_servicos)}</td>
                          <td className="px-3 py-3 text-right">{fmtBRL(p.comissao_servicos)}</td>
                          <td className="px-3 py-3 text-right">{fmtBRL(p.comissao_pacotes)}</td>
                          <td className="px-3 py-3 text-right">{fmtBRL(p.comissao_pdv)}</td>
                          <td className="px-3 py-3 text-right font-semibold">{fmtBRL(p.comissao_bruta)}</td>
                          <td className="px-3 py-3 text-right">{fmtBRL(p.adiantamentos_total)}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">
                            {fmtBRL(p.comissao_liquida)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel-strong)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                  {fechamentoId
                    ? "Snapshot vazio. Gere snapshot ou recarregue o fechamento."
                    : "Nenhum fechamento selecionado para este período."}
                </div>
              )}
            </SectionCard>
          </div>
        ) : null}

        {tab === "adiantamentos" ? (
          <SectionCard
            title="Adiantamentos (caixa)"
            subtitle="Adiantamentos afetam caixa, não entram diretamente na DRE."
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <Badge tone="slate">
                  Pendentes: {adiantamentosPendentes.length} ({fmtBRL(totalAdiantamentosPendentesPeriodo)})
                </Badge>
                <Badge tone="slate">
                  Abatidos: {adiantamentosAbatidos.length} ({fmtBRL(totalAdiantamentosAbatidosPeriodo)})
                </Badge>
                <Badge tone="slate">Total: {fmtBRL(totalAdiantamentosPeriodo)}</Badge>
              </div>
            }
          >
            <div className="grid gap-4 lg:grid-cols-[1.05fr_1.95fr]">
              <form
                onSubmit={handleCriarAdiantamento}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4"
              >
                <div className="mb-4 text-sm font-bold text-[var(--text-app)]">
                  Registrar adiantamento
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                      Profissional
                    </label>
                    <select
                      value={adProfissionalId}
                      onChange={(e) => setAdProfissionalId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-amber-500"
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
                      <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                        Data
                      </label>
                      <input
                        type="date"
                        value={adData}
                        onChange={(e) => setAdData(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                        Valor
                      </label>
                      <input
                        inputMode="decimal"
                        value={adValor}
                        onChange={(e) => setAdValor(e.target.value)}
                        placeholder="Ex.: 50.00"
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                      Descrição (opcional)
                    </label>
                    <input
                      value={adDescricao}
                      onChange={(e) => setAdDescricao(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-amber-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !adProfissionalId || !adData || !adValor || !(periodoInicio && periodoFim)}
                    className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Salvando..." : "Salvar adiantamento"}
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-bold text-[var(--text-app)]">Lançamentos</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (periodoInicio && periodoFim)
                        carregarAdiantamentos({ dataInicio: periodoInicio, dataFim: periodoFim });
                    }}
                    disabled={loading || !(periodoInicio && periodoFim)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Atualizar
                  </button>
                </div>

                {adiantamentos?.length ? (
                  <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--border-color)]">
                    <table className="w-full border-collapse text-[12px]">
                      <thead className="sticky top-0 bg-[var(--bg-panel-strong)]">
                        <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                          <th className="px-4 py-3 text-left font-medium">Data</th>
                          <th className="px-3 py-3 text-left font-medium">Profissional</th>
                          <th className="px-3 py-3 text-right font-medium">Valor</th>
                          <th className="px-3 py-3 text-left font-medium">Status</th>
                          <th className="px-4 py-3 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adiantamentos.map((a) => {
                          const nome = nomeProfPorId.get(a.profissional_id) || "—";
                          const abatido = !!a.fechamento_id;
                          return (
                            <tr key={a.id} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-panel)]">
                              <td className="px-4 py-3">{String(a.data || "").slice(0, 10)}</td>
                              <td className="px-3 py-3">{nome}</td>
                              <td className="px-3 py-3 text-right">{fmtBRL(a.valor)}</td>
                              <td className="px-3 py-3">
                                <Badge tone={abatido ? "emerald" : "amber"}>
                                  {abatido ? "Abatido" : "Pendente"}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-right">
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
                                  className={[
                                    "rounded-xl border px-3 py-1.5 text-[11px] font-medium transition",
                                    abatido
                                      ? "cursor-not-allowed border-[var(--border-color)] text-[var(--text-soft)]"
                                      : "border-red-500/60 text-red-600 hover:bg-red-500/10",
                                  ].join(" ")}
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
                  <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    {periodoInicio && periodoFim
                      ? "Nenhum adiantamento no período."
                      : "Defina um período para listar os adiantamentos."}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        ) : null}

        {tab === "despesas" ? (
          <SectionCard
            title="Despesas operacionais"
            subtitle="Despesas entram na DRE do período e reduzem o resultado final."
            actions={<Badge tone="rose">Total: {fmtBRL(totalDespesasPeriodo)}</Badge>}
          >
            <div className="grid gap-4 lg:grid-cols-[1.05fr_1.95fr]">
              <form
                onSubmit={handleCriarDespesa}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4"
              >
                <div className="mb-4 text-sm font-bold text-[var(--text-app)]">
                  Registrar despesa
                </div>

                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                        Data
                      </label>
                      <input
                        type="date"
                        value={dpData}
                        onChange={(e) => setDpData(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                        Valor
                      </label>
                      <input
                        inputMode="decimal"
                        value={dpValor}
                        onChange={(e) => setDpValor(e.target.value)}
                        placeholder="Ex.: 120.00"
                        className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                      Categoria
                    </label>
                    <input
                      value={dpCategoria}
                      onChange={(e) => setDpCategoria(e.target.value)}
                      placeholder='Ex.: "Aluguel", "Energia", "Produtos"...'
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                      Forma de pagamento (opcional)
                    </label>
                    <input
                      value={dpForma}
                      onChange={(e) => setDpForma(e.target.value)}
                      placeholder='Ex.: "Pix", "Cartão"...'
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-[11px] font-medium text-[var(--text-muted)]">
                      Descrição (opcional)
                    </label>
                    <input
                      value={dpDescricao}
                      onChange={(e) => setDpDescricao(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-input)] px-3 py-2.5 text-sm text-[var(--text-app)] outline-none transition focus:border-rose-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !dpData || !dpCategoria || !dpValor || !(periodoInicio && periodoFim)}
                    className="w-full rounded-xl bg-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Salvando..." : "Salvar despesa"}
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-panel-strong)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-bold text-[var(--text-app)]">Lançamentos</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (periodoInicio && periodoFim)
                        carregarDespesas({ dataInicio: periodoInicio, dataFim: periodoFim });
                    }}
                    disabled={loading || !(periodoInicio && periodoFim)}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-panel)] px-3 py-2 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-app)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Atualizar
                  </button>
                </div>

                {despesas?.length ? (
                  <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-[var(--border-color)]">
                    <table className="w-full border-collapse text-[12px]">
                      <thead className="sticky top-0 bg-[var(--bg-panel-strong)]">
                        <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                          <th className="px-4 py-3 text-left font-medium">Data</th>
                          <th className="px-3 py-3 text-left font-medium">Categoria</th>
                          <th className="px-3 py-3 text-left font-medium">Descrição</th>
                          <th className="px-3 py-3 text-right font-medium">Valor</th>
                          <th className="px-4 py-3 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {despesas.map((d) => (
                          <tr key={d.id} className="border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-panel)]">
                            <td className="px-4 py-3">{String(d.data || "").slice(0, 10)}</td>
                            <td className="px-3 py-3">{d.categoria || "—"}</td>
                            <td className="px-3 py-3 text-[var(--text-muted)]">
                              <div className="max-w-[360px] truncate" title={d.descricao || ""}>
                                {d.descricao || "—"}
                              </div>
                              {d.forma_pagamento ? (
                                <div className="mt-0.5 text-[10px] text-[var(--text-soft)]">
                                  ({d.forma_pagamento})
                                </div>
                              ) : null}
                            </td>
                            <td className="px-3 py-3 text-right font-medium text-rose-700">
                              {fmtBRL(d.valor)}
                            </td>
                            <td className="px-4 py-3 text-right">
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
                                className="rounded-xl border border-red-500/60 px-3 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
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
                  <div className="rounded-xl border border-dashed border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
                    {periodoInicio && periodoFim
                      ? "Nenhuma despesa no período."
                      : "Defina um período para listar as despesas."}
                  </div>
                )}
              </div>
            </div>
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}