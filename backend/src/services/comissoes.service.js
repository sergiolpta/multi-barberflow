// src/services/comissoes.service.js
import { supabase } from "../lib/supabase.js";

/**
 * Busca a comissão vigente (profissional x serviço) para uma data (YYYY-MM-DD).
 */
export async function getComissaoPctVigente({
  barbeariaId,
  profissionalId,
  servicoId,
  dataRefYYYYMMDD,
}) {
  const { data, error } = await supabase
    .from("profissional_servico_comissoes")
    .select("comissao_pct, vigencia_inicio, vigencia_fim")
    .eq("barbearia_id", barbeariaId)
    .eq("profissional_id", profissionalId)
    .eq("servico_id", servicoId)
    .eq("ativo", true)
    .lte("vigencia_inicio", dataRefYYYYMMDD)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${dataRefYYYYMMDD}`)
    .order("vigencia_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.comissao_pct ?? null;
}

/** Arredondamento monetário */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Snapshot da comissão de serviço
 */
export async function calcularComissaoServico({
  barbeariaId,
  profissionalId,
  servicoId,
  dataRefYYYYMMDD,
  precoAplicado,
}) {
  const pct = await getComissaoPctVigente({
    barbeariaId,
    profissionalId,
    servicoId,
    dataRefYYYYMMDD,
  });

  const pctAplicada = pct ?? 0;
  const valor = round2((Number(precoAplicado) * Number(pctAplicada)) / 100);

  return {
    comissao_pct_aplicada: pctAplicada,
    comissao_valor: valor,
  };
}

/**
 * Busca % de comissão de pacote direto do profissional
 */
export async function getComissaoPctPacoteProfissional({ barbeariaId, profissionalId }) {
  const { data, error } = await supabase
    .from("profissionais")
    .select("comissao_pacote_pct")
    .eq("barbearia_id", barbeariaId)
    .eq("id", profissionalId)
    .single();

  if (error) throw error;
  // fallback: 0
  return Number(data?.comissao_pacote_pct ?? 0);
}

/**
 * Snapshot da comissão do pacote (por pagamento mensal)
 */
export async function calcularComissaoPacote({
  barbeariaId,
  profissionalId,
  valorPago,
}) {
  const pct = await getComissaoPctPacoteProfissional({ barbeariaId, profissionalId });

  const pctAplicada = Number.isFinite(Number(pct)) ? Number(pct) : 0;
  const valor = round2((Number(valorPago) * pctAplicada) / 100);

  return {
    comissao_pct_aplicada: pctAplicada,
    comissao_valor: valor,
  };
}

