// backend/src/services/financeiro.service.js
import { supabase } from "../lib/supabase.js";
import { calcularComissaoPacote, calcularComissaoServico } from "./comissoes.service.js";

/**
 * Fechamento por DIA LOCAL (-03:00)
 * (para campos timestamp/timestamptz como created_at e pago_em)
 */
const LOCAL_OFFSET = "-03:00";

function toISOStartLocal(dataYYYYMMDD) {
  return `${dataYYYYMMDD}T00:00:00.000${LOCAL_OFFSET}`;
}

function toISOEndLocal(dataYYYYMMDD) {
  return `${dataYYYYMMDD}T23:59:59.999${LOCAL_OFFSET}`;
}

function sumNumber(list, pick) {
  return (list || []).reduce((acc, item) => acc + Number(pick(item) ?? 0), 0);
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

// ✅ ROBUSTO: lower + trim + remove acentos (concluído → concluido)
function normalizeStatusLoose(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// mantemos o nome antigo para não quebrar o resto do arquivo
function normalizeStatus(s) {
  return normalizeStatusLoose(s);
}

/**
 * Status final do FECHAMENTO (convenção do projeto)
 * - aberto: pode gerar snapshot
 * - confirmado: fechado (não pode gerar snapshot/concluir de novo)
 * - cancelado: bloqueia ações
 */
function isFechamentoFechado(status) {
  const st = normalizeStatusLoose(status);
  return st === "confirmado" || st === "fechado" || st === "concluido";
}

function isStatusConfirmadoLoose(status) {
  return isFechamentoFechado(status);
}

/* =========================================================
 * TRAVA / AUDITORIA (ROBUSTO)
 * ========================================================= */

/**
 * ✅ Busca 1 fechamento que cubra a dataRef (YYYY-MM-DD), SEM filtrar status no banco.
 * Preferência: confirmado > aberto > outros
 */
export async function obterFechamentoQueCobreData({ barbeariaId, dataRefYYYYMMDD }) {
  const dataRef = String(dataRefYYYYMMDD || "").slice(0, 10).trim();
  if (!dataRef) return null;

  const { data: rows, error } = await supabase
    .from("fechamentos")
    .select("id, periodo_inicio, periodo_fim, status, created_at, criado_por_user_id")
    .eq("barbearia_id", barbeariaId)
    .lte("periodo_inicio", dataRef)
    .gte("periodo_fim", dataRef)
    .order("periodo_inicio", { ascending: false });

  if (error) throw new Error(`Erro ao buscar fechamento por data: ${error.message}`);
  if (!Array.isArray(rows) || rows.length === 0) return null;

  // Preferir confirmado (qualquer variação), depois aberto, depois o mais recente
  const confirmado = rows.find((r) => isStatusConfirmadoLoose(r.status));
  if (confirmado) return confirmado;

  const aberto = rows.find((r) => normalizeStatusLoose(r.status) === "aberto");
  if (aberto) return aberto;

  return rows[0];
}

/**
 * Busca 1 fechamento CONFIRMADO que cubra a dataRef (YYYY-MM-DD).
 * (decide no JS, não no filtro eq("status","confirmado") que quebrava com maiúsculas/espaços)
 */
export async function encontrarFechamentoConfirmadoQueCobreData({
  barbeariaId,
  dataRefYYYYMMDD,
}) {
  const f = await obterFechamentoQueCobreData({ barbeariaId, dataRefYYYYMMDD });
  if (!f) return null;
  return isStatusConfirmadoLoose(f.status) ? f : null;
}

/**
 * Garante que NÃO existe fechamento CONFIRMADO cobrindo dataRef.
 * Se existir, lança erro padronizado para controller transformar em 409.
 */
export async function assertPeriodoNaoTravadoPorFechamentoConfirmado({
  barbeariaId,
  dataRefYYYYMMDD,
  motivo = "alteração",
}) {
  const f = await encontrarFechamentoConfirmadoQueCobreData({
    barbeariaId,
    dataRefYYYYMMDD,
  });

  if (f) {
    const dataRef = String(dataRefYYYYMMDD || "").slice(0, 10);
    throw new Error(
      `CONFLITO_FECHAMENTO_CONFIRMADO: Existe um fechamento CONFIRMADO (${f.id}) que cobre a data ${dataRef}. ` +
        `Para manter consistência/auditoria, não é permitido ${motivo} neste período.`
    );
  }
}

/** -------------------- PDV -------------------- **/
function groupByProfissionalForPdv(vendas) {
  // pid -> { profissional_id, comissao_total, lucro_total, bruto_total, qtd_vendas }
  const map = new Map();

  for (const v of vendas || []) {
    const pid = v.profissional_id ?? null;

    if (!map.has(pid)) {
      map.set(pid, {
        profissional_id: pid,
        comissao_total: 0,
        lucro_total: 0,
        bruto_total: 0,
        qtd_vendas: 0,
      });
    }

    const row = map.get(pid);
    row.comissao_total += Number(v.comissao_valor ?? 0);
    row.lucro_total += Number(v.lucro_total ?? 0);
    row.bruto_total += Number(v.total ?? 0);
    row.qtd_vendas += 1;
  }

  return map;
}

/** -------------------- ADIANTAMENTOS -------------------- **/
function groupAdiantamentos(adiant) {
  // pid -> { total, qtd }
  const adMap = new Map();

  for (const a of adiant || []) {
    const pid = a.profissional_id;
    if (!adMap.has(pid)) adMap.set(pid, { total: 0, qtd: 0 });
    const row = adMap.get(pid);
    row.total += Number(a.valor ?? 0);
    row.qtd += 1;
  }

  const totalAdiantamentos = Array.from(adMap.values()).reduce(
    (acc, r) => acc + Number(r.total ?? 0),
    0
  );

  return { adMap, totalAdiantamentos };
}

/** -------------------- PACOTES -------------------- **/
function groupPacotesByProfissional(pagamentos) {
  // pid -> { total, comissao_total, qtd }
  const map = new Map();

  for (const p of pagamentos || []) {
    const pid = p?.pacote?.profissional_id ?? null;
    if (!map.has(pid)) map.set(pid, { total: 0, comissao_total: 0, qtd: 0 });

    const row = map.get(pid);
    row.total += Number(p.valor ?? 0);
    row.comissao_total += Number(p.comissao_valor ?? 0);
    row.qtd += 1;
  }

  return map;
}

/** -------------------- SERVIÇOS (AGENDAMENTOS) -------------------- **/
function groupServicosByProfissional(agendamentos) {
  // pid -> { total, comissao_total, qtd }
  const map = new Map();

  for (const a of agendamentos || []) {
    const pid = a.profissional_id ?? null;
    if (!map.has(pid)) map.set(pid, { total: 0, comissao_total: 0, qtd: 0 });

    const row = map.get(pid);

    // usa preço “resolvido” (preco_aplicado OU servico.preco)
    const preco = Number(a.preco_resolvido ?? a.preco_aplicado ?? a?.servico?.preco ?? 0);

    row.total += preco;
    row.comissao_total += Number(a.comissao_valor ?? 0);
    row.qtd += 1;
  }

  return map;
}

// helper: considera "não calculado" se está null, ou se ficou no padrão 0/0
function precisaRecalcularComissaoServico(a) {
  const pct = Number(a?.comissao_pct_aplicada ?? 0);
  const val = Number(a?.comissao_valor ?? 0);

  // caso 1: não existe (null/undefined)
  if (a?.comissao_valor == null || a?.comissao_pct_aplicada == null) return true;

  // caso 2: gravado “zerado” (0/0) antes das regras existirem
  if (pct === 0 && val === 0) return true;

  return false;
}

/**
 * Fechamento financeiro por período:
 * - SERVIÇOS: agendamentos (status "confirmado") no período (data DATE)
 * - PDV: vendas (created_at timestamptz) no período
 * - PACOTES: pacote_pagamentos (pago_em timestamptz) no período
 * - ADIANTAMENTOS: desconta da comissão bruta do profissional (data DATE)
 *
 * ✅ Importante:
 * - Para RESULTADO do PDV, usamos o LUCRO (lucro_total).
 * - total (bruto) fica como informativo.
 *
 * ✅ CORREÇÃO (2026-03):
 * - Vendas com agendamento_id e itens APENAS de SERVIÇO NÃO são PDV.
 *   Elas são "SERVIÇOS EXTRAS" e devem somar em SERVIÇOS (total e comissão),
 *   para o profissional não ficar no escuro e o snapshot bater com a prévia.
 */
export async function fecharPeriodo({ barbeariaId, dataInicio, dataFim }) {
  const inicioTs = toISOStartLocal(dataInicio);
  const fimTs = toISOEndLocal(dataFim);

  // =========================
  // 0) SERVIÇOS (AGENDAMENTOS)
  // =========================
  const { data: agendsRaw, error: agErr } = await supabase
    .from("agendamentos")
    .select(
      `
      id,
      profissional_id,
      servico_id,
      data,
      status,
      preco_aplicado,
      comissao_pct_aplicada,
      comissao_valor,
      servico:servicos(preco)
    `
    )
    .eq("barbearia_id", barbeariaId)
    .eq("status", "confirmado")
    .gte("data", dataInicio)
    .lte("data", dataFim);

  if (agErr) throw new Error(`Erro ao buscar serviços (agendamentos): ${agErr.message}`);

  for (const a of agendsRaw || []) {
    const precoAplicado = Number(a.preco_aplicado ?? 0);
    const precoServico = Number(a?.servico?.preco ?? 0);
    a.preco_resolvido = precoAplicado > 0 ? precoAplicado : precoServico;
  }

  for (const a of agendsRaw || []) {
    if (!precisaRecalcularComissaoServico(a)) continue;

    const preco = Number(a.preco_resolvido ?? 0);

    if (preco > 0 && a.profissional_id && a.servico_id && a.data) {
      const snap = await calcularComissaoServico({
        barbeariaId,
        profissionalId: a.profissional_id,
        servicoId: a.servico_id,
        dataRefYYYYMMDD: a.data,
        precoAplicado: preco,
      });

      a.comissao_valor = snap.comissao_valor;
      a.comissao_pct_aplicada = snap.comissao_pct_aplicada;
    } else {
      a.comissao_valor = 0;
      a.comissao_pct_aplicada = Number(a.comissao_pct_aplicada ?? 0);
    }
  }

  // base: serviços por profissional (agendamentos)
  const servicosPorProfMap = groupServicosByProfissional(agendsRaw);

  // =========================
  // 1) VENDAS (PDV + EXTRAS)
  // =========================
  const { data: vendasRaw, error: vendasErr } = await supabase
    .from("vendas")
    .select("id,total,lucro_total,profissional_id,comissao_valor,created_at,agendamento_id")
    .eq("barbearia_id", barbeariaId)
    .gte("created_at", inicioTs)
    .lte("created_at", fimTs);

  if (vendasErr) throw new Error(`Erro ao buscar vendas: ${vendasErr.message}`);

  const vendaIds = (vendasRaw || []).map((v) => v.id);

  // =========================
  // 2) Itens das vendas (para classificar PDV x EXTRA)
  // =========================
  let qtdItensPdv = 0;

  // venda_id -> flags
  const vendaInfo = new Map(); // venda_id -> { has_produto, has_servico, qtd_itens_total }
  if (vendaIds.length > 0) {
    const { data: itens, error: itensErr } = await supabase
      .from("venda_itens")
      .select("venda_id, quantidade, item_tipo, produto_id, servico_id")
      .in("venda_id", vendaIds);

    if (itensErr) throw new Error(`Erro ao buscar itens: ${itensErr.message}`);

    for (const it of itens || []) {
      const vid = it.venda_id;
      if (!vendaInfo.has(vid)) {
        vendaInfo.set(vid, { has_produto: false, has_servico: false, qtd_itens_total: 0 });
      }

      const row = vendaInfo.get(vid);

      const tipo = String(it.item_tipo || "").toLowerCase();
      const temProduto = tipo === "produto" || it.produto_id != null;
      const temServico = tipo === "servico" || it.servico_id != null;

      if (temProduto) row.has_produto = true;
      if (temServico) row.has_servico = true;

      row.qtd_itens_total += Number(it.quantidade ?? 0);
    }
  }

  // =========================
  // 3) Separar PDV x EXTRAS (serviços lançados via vendas)
  // =========================
  const vendasExtrasServicos = [];
  const vendasPdv = [];

  for (const v of vendasRaw || []) {
    const info = vendaInfo.get(v.id) || { has_produto: false, has_servico: false, qtd_itens_total: 0 };

    const temAgendamento = v.agendamento_id != null;

    // ✅ extra: vinculado ao agendamento e NÃO tem produto, mas tem serviço
    const ehExtraServico = temAgendamento && info.has_servico && !info.has_produto;

    if (ehExtraServico) {
      vendasExtrasServicos.push(v);
    } else {
      vendasPdv.push(v);
      qtdItensPdv += Number(info.qtd_itens_total ?? 0);
    }
  }

  // =========================
  // 4) Somar extras em SERVIÇOS (por profissional)
  // =========================
  // ✅ CORRIGIDO: soma também comissao_valor do extra (já gravada em vendas)
  let totalExtrasServicos = 0;
  let totalComissaoExtrasServicos = 0;

  for (const v of vendasExtrasServicos) {
    const pid = v.profissional_id ?? null;
    if (!servicosPorProfMap.has(pid)) {
      servicosPorProfMap.set(pid, { total: 0, comissao_total: 0, qtd: 0 });
    }
    const row = servicosPorProfMap.get(pid);

    const valor = Number(v.total ?? 0);
    const com = Number(v.comissao_valor ?? 0);

    row.total += valor;
    row.comissao_total += com; // ✅ aqui estava faltando
    row.qtd += 1;

    totalExtrasServicos += valor;
    totalComissaoExtrasServicos += com;
  }

  // ✅ total de serviços agora inclui extras
  const totalServicos = round2(sumNumber(agendsRaw, (a) => a.preco_resolvido) + totalExtrasServicos);

  const totalComissaoServicos = round2(
    Array.from(servicosPorProfMap.values()).reduce((acc, r) => acc + Number(r.comissao_total ?? 0), 0)
  );

  // =========================
  // 5) PDV (somente vendasPdv)
  // =========================
  const pdvBruto = round2(sumNumber(vendasPdv, (v) => v.total));
  const pdvLucro = round2(sumNumber(vendasPdv, (v) => v.lucro_total));

  const pdvPorProfMap = groupByProfissionalForPdv(vendasPdv);
  const totalComissaoPdv = round2(
    Array.from(pdvPorProfMap.values()).reduce((acc, r) => acc + Number(r.comissao_total ?? 0), 0)
  );

  // =========================
  // 6) PACOTES (pagamentos)
  // =========================
  const { data: pacotePag, error: pacoteErr } = await supabase
    .from("pacote_pagamentos")
    .select(
      "id, valor, competencia, pago_em, pacote_id, comissao_pct_aplicada, comissao_valor, pacote:pacotes(profissional_id)"
    )
    .eq("barbearia_id", barbeariaId)
    .gte("pago_em", inicioTs)
    .lte("pago_em", fimTs);

  if (pacoteErr) throw new Error(`Erro ao buscar pagamentos de pacote: ${pacoteErr.message}`);

  for (const p of pacotePag || []) {
    if (p.comissao_valor == null) {
      const pid = p?.pacote?.profissional_id ?? null;
      if (pid) {
        const snap = await calcularComissaoPacote({
          barbeariaId,
          profissionalId: pid,
          valorPago: Number(p.valor ?? 0),
        });
        p.comissao_valor = snap.comissao_valor;
        p.comissao_pct_aplicada = snap.comissao_pct_aplicada;
      } else {
        p.comissao_valor = 0;
        p.comissao_pct_aplicada = 0;
      }
    }
  }

  const totalPacotes = round2(sumNumber(pacotePag, (p) => p.valor));

  const pacotesPorProfMap = groupPacotesByProfissional(pacotePag);
  const totalComissaoPacotes = round2(
    Array.from(pacotesPorProfMap.values()).reduce((acc, r) => acc + Number(r.comissao_total ?? 0), 0)
  );

  // =========================
  // 7) ADIANTAMENTOS
  // =========================
  const { data: adiantTodos, error: adiantErr } = await supabase
    .from("adiantamentos")
    .select("profissional_id,valor,data,fechamento_id")
    .eq("barbearia_id", barbeariaId)
    .gte("data", dataInicio)
    .lte("data", dataFim);

  if (adiantErr) throw new Error(`Erro ao buscar adiantamentos: ${adiantErr.message}`);

  const adiantPendentes = (adiantTodos || []).filter((a) => !a.fechamento_id);
  const adiantAbatidos = (adiantTodos || []).filter((a) => !!a.fechamento_id);

  const { adMap, totalAdiantamentos } = groupAdiantamentos(adiantPendentes);
  const { totalAdiantamentos: totalAdiantAbatidos } = groupAdiantamentos(adiantAbatidos);

  // =========================
  // 8) Consolidar por profissional
  // =========================
  const allPids = new Set([
    ...Array.from(servicosPorProfMap.keys()),
    ...Array.from(pdvPorProfMap.keys()),
    ...Array.from(pacotesPorProfMap.keys()),
    ...Array.from(adMap.keys()),
  ]);

  const porProfissional = [];

  for (const pid of allPids) {
    const srv = servicosPorProfMap.get(pid) || { total: 0, comissao_total: 0, qtd: 0 };
    const pdv = pdvPorProfMap.get(pid) || {
      profissional_id: pid,
      comissao_total: 0,
      lucro_total: 0,
      bruto_total: 0,
      qtd_vendas: 0,
    };
    const pac = pacotesPorProfMap.get(pid) || { total: 0, comissao_total: 0, qtd: 0 };
    const ad = adMap.get(pid) || { total: 0, qtd: 0 };

    const comSrv = Number(srv.comissao_total ?? 0);
    const comPdv = Number(pdv.comissao_total ?? 0);
    const comPac = Number(pac.comissao_total ?? 0);

    const comBruta = round2(comSrv + comPac + comPdv);
    const liquido = round2(comBruta - Number(ad.total ?? 0));

    porProfissional.push({
      profissional_id: pid,

      servicos: {
        total: round2(Number(srv.total ?? 0)),
        comissao_total: round2(comSrv),
        qtd: Number(srv.qtd ?? 0),
      },

      pdv: {
        comissao_total: round2(comPdv),
        lucro_total: round2(Number(pdv.lucro_total ?? 0)),
        bruto_total: round2(Number(pdv.bruto_total ?? 0)),
        qtd_vendas: Number(pdv.qtd_vendas ?? 0),
      },

      pacotes: {
        total: round2(Number(pac.total ?? 0)),
        comissao_total: round2(comPac),
        qtd: Number(pac.qtd ?? 0),
      },

      total: comBruta,

      adiantamentos: {
        total: round2(Number(ad.total ?? 0)),
        qtd: Number(ad.qtd ?? 0),
      },

      liquido,
    });
  }

  const totalLiquido = round2(sumNumber(porProfissional, (r) => r.liquido));

  const totalFaturamento = round2(Number(totalServicos) + Number(totalPacotes) + Number(pdvBruto));
  const totalResultadoBase = round2(Number(totalServicos) + Number(totalPacotes) + Number(pdvLucro));

  return {
    periodo: { inicio: dataInicio, fim: dataFim },
    barbearia_id: barbeariaId,

    receitas: {
      servicos: {
        total: round2(totalServicos),
        qtd_atendimentos: (agendsRaw?.length ?? 0) + (vendasExtrasServicos?.length ?? 0),
      },
      pdv: {
        bruto: round2(pdvBruto),
        lucro: round2(pdvLucro),
        qtd_vendas: vendasPdv?.length ?? 0,
        qtd_itens: qtdItensPdv,
      },
      pacotes: {
        total: round2(totalPacotes),
        qtd_pagamentos: (pacotePag || []).length,
      },

      totais: {
        faturamento: totalFaturamento,
        resultado_base: totalResultadoBase,
      },
    },

    comissoes: {
      por_profissional: porProfissional,
      total: round2(totalComissaoServicos + totalComissaoPdv + totalComissaoPacotes),
      // ✅ continua sendo SOMENTE pendentes
      total_adiantamentos: round2(totalAdiantamentos),
      total_liquido: round2(totalLiquido),
    },

    // ✅ informativo: abatidos
    adiantamentos_info: {
      pendentes: round2(totalAdiantamentos),
      abatidos: round2(totalAdiantAbatidos),
      total_periodo: round2(totalAdiantamentos + totalAdiantAbatidos),
    },

    // ✅ opcional para debug / UI futura
    extras_servicos_info: {
      qtd_vendas: vendasExtrasServicos?.length ?? 0,
      total: round2(totalExtrasServicos),
      comissao_total: round2(totalComissaoExtrasServicos),
    },
  };
}

export async function criarFechamento({ barbeariaId, dataInicio, dataFim, userId = null }) {
  const { data: fechamento, error } = await supabase
    .from("fechamentos")
    .insert({
      barbearia_id: barbeariaId,
      periodo_inicio: dataInicio,
      periodo_fim: dataFim,
      criado_por_user_id: userId,
      status: "aberto",
    })
    .select("id, barbearia_id, periodo_inicio, periodo_fim, status, created_at")
    .single();

  if (error) throw new Error(`Erro ao criar fechamento: ${error.message}`);
  return fechamento;
}

/**
 * Snapshot congelado em fechamento_profissionais (idempotente por unique (fechamento_id, profissional_id))
 */
export async function gerarSnapshotFechamento({ barbeariaId, fechamentoId }) {
  const { data: fechamento, error: fErr } = await supabase
    .from("fechamentos")
    .select("id, barbearia_id, periodo_inicio, periodo_fim, status")
    .eq("id", fechamentoId)
    .eq("barbearia_id", barbeariaId)
    .single();

  if (fErr || !fechamento) throw new Error("Fechamento não encontrado para esta barbearia.");

  const st = normalizeStatus(fechamento.status);
  if (st === "cancelado") throw new Error("Fechamento cancelado não pode gerar snapshot.");
  if (isFechamentoFechado(st)) throw new Error("Fechamento já está confirmado/fechado.");

  const resumo = await fecharPeriodo({
    barbeariaId,
    dataInicio: fechamento.periodo_inicio,
    dataFim: fechamento.periodo_fim,
  });

  const rows = (resumo?.comissoes?.por_profissional || []).map((p) => {
    const adTotal = Number(p?.adiantamentos?.total ?? 0);

    const srvTotal = Number(p?.servicos?.total ?? 0);
    const srvCom = Number(p?.servicos?.comissao_total ?? 0);

    const pdvCom = Number(p?.pdv?.comissao_total ?? 0);

    const pacTotal = Number(p?.pacotes?.total ?? 0);
    const pacCom = Number(p?.pacotes?.comissao_total ?? 0);

    const total_pdv = round2(Number(p?.pdv?.lucro_total ?? 0));

    const total_servicos = round2(srvTotal);
    const comissao_servicos = round2(srvCom);

    const total_pacotes = round2(pacTotal);
    const comissao_pacotes = round2(pacCom);

    const comissao_pdv = round2(pdvCom);

    const comissao_bruta = round2(comissao_servicos + comissao_pacotes + comissao_pdv);
    const adiantamentos_total = round2(adTotal);
    const comissao_liquida = round2(comissao_bruta - adiantamentos_total);

    return {
      fechamento_id: fechamento.id,
      barbearia_id: fechamento.barbearia_id,
      profissional_id: p.profissional_id,

      total_servicos,
      comissao_servicos,

      total_pacotes,
      comissao_pacotes,

      total_pdv,
      comissao_pdv,

      adiantamentos_total,
      comissao_bruta,
      comissao_liquida,
    };
  });

  if (!rows.length) return { ok: true, fechamento, total_linhas: 0, gravados: 0 };

  const { data: up, error: upErr } = await supabase
    .from("fechamento_profissionais")
    .upsert(rows, { onConflict: "fechamento_id,profissional_id" })
    .select("id, fechamento_id, profissional_id");

  if (upErr) throw new Error(`Erro ao gerar snapshot: ${upErr.message}`);

  return {
    ok: true,
    fechamento,
    total_linhas: rows.length,
    gravados: up?.length ?? rows.length,
  };
}

export async function concluirFechamento({ fechamentoId }) {
  const { data: fechamento, error: fErr } = await supabase
    .from("fechamentos")
    .select("id, barbearia_id, periodo_inicio, periodo_fim, status")
    .eq("id", fechamentoId)
    .single();

  if (fErr) throw new Error(`Erro ao buscar fechamento: ${fErr.message}`);
  if (!fechamento) throw new Error("Fechamento não encontrado.");

  const st = normalizeStatus(fechamento.status);

  if (isFechamentoFechado(st)) {
    return { ok: true, message: "Fechamento já confirmado.", fechamento };
  }
  if (st === "cancelado") throw new Error("Fechamento está cancelado e não pode ser confirmado.");

  const { error: upErr, count } = await supabase
    .from("adiantamentos")
    .update({
      fechamento_id: fechamento.id,
      abatido_em: new Date().toISOString(),
    })
    .eq("barbearia_id", fechamento.barbearia_id)
    .gte("data", fechamento.periodo_inicio)
    .lte("data", fechamento.periodo_fim)
    .is("fechamento_id", null)
    .select("id", { count: "exact", head: true });

  if (upErr) throw new Error(`Erro ao marcar adiantamentos: ${upErr.message}`);

  const { data: fechado, error: closeErr } = await supabase
    .from("fechamentos")
    .update({ status: "confirmado" })
    .eq("id", fechamento.id)
    .select("id, status")
    .single();

  if (closeErr) throw new Error(`Erro ao confirmar fechamento: ${closeErr.message}`);

  return {
    ok: true,
    fechamento: { ...fechamento, ...fechado },
    adiantamentos_marcados: count ?? 0,
  };
}

/* =========================================================
 * DESPESAS
 * ========================================================= */

export async function criarDespesa({
  barbeariaId,
  userId = null,
  data,
  categoria,
  descricao = null,
  formaPagamento = null,
  valor,
}) {
  const dataRef = String(data || "").slice(0, 10);

  await assertPeriodoNaoTravadoPorFechamentoConfirmado({
    barbeariaId,
    dataRefYYYYMMDD: dataRef,
    motivo: "criar despesa",
  });

  const payload = {
    barbearia_id: barbeariaId,
    user_id: userId,
    data: dataRef,
    categoria,
    descricao,
    forma_pagamento: formaPagamento,
    valor: round2(valor),
  };

  const { data: row, error } = await supabase
    .from("despesas")
    .insert(payload)
    .select("id, barbearia_id, data, categoria, descricao, forma_pagamento, valor, user_id, created_at")
    .single();

  if (error) throw new Error(`Erro ao criar despesa: ${error.message}`);
  return row;
}

export async function listarDespesas({ barbeariaId, inicio, fim, categoria = "" }) {
  let q = supabase
    .from("despesas")
    .select("id, data, categoria, descricao, forma_pagamento, valor, user_id, created_at")
    .eq("barbearia_id", barbeariaId)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false })
    .limit(500);

  const cat = String(categoria || "").trim();
  if (cat) q = q.eq("categoria", cat);

  const { data, error } = await q;
  if (error) throw new Error(`Erro ao listar despesas: ${error.message}`);

  return data || [];
}

export async function deletarDespesa({ barbeariaId, despesaId }) {
  const { data: desp, error: dErr } = await supabase
    .from("despesas")
    .select("id, barbearia_id, data")
    .eq("barbearia_id", barbeariaId)
    .eq("id", despesaId)
    .single();

  if (dErr || !desp) {
    throw new Error("Despesa não encontrada para esta barbearia.");
  }

  const dataRef = String(desp.data || "").slice(0, 10);

  await assertPeriodoNaoTravadoPorFechamentoConfirmado({
    barbeariaId,
    dataRefYYYYMMDD: dataRef,
    motivo: "excluir despesa",
  });

  const { error: delErr } = await supabase
    .from("despesas")
    .delete()
    .eq("barbearia_id", barbeariaId)
    .eq("id", despesaId);

  if (delErr) throw new Error(`Erro ao deletar despesa: ${delErr.message}`);

  return { ok: true };
}

/* =========================================================
 * FECHAMENTOS (LISTAGEM) — NOVO
 * ========================================================= */

export async function listarFechamentos({ barbeariaId, inicio = "", fim = "", limit = 50 }) {
  let q = supabase
    .from("fechamentos")
    .select("id, periodo_inicio, periodo_fim, status, created_at, criado_por_user_id")
    .eq("barbearia_id", barbeariaId)
    .order("periodo_inicio", { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 50, 1), 200));

  const i = String(inicio || "").trim();
  const f = String(fim || "").trim();

  // interseção de períodos: periodo_fim >= inicio AND periodo_inicio <= fim
  if (i && f) {
    q = q.gte("periodo_fim", i).lte("periodo_inicio", f);
  } else if (i) {
    q = q.gte("periodo_fim", i);
  } else if (f) {
    q = q.lte("periodo_inicio", f);
  }

  const { data, error } = await q;
  if (error) throw new Error(`Erro ao listar fechamentos: ${error.message}`);

  return data || [];
}
