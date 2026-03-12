// backend/src/services/comissoes.service.js
import { supabase } from "../lib/supabase.js";

/** Arredondamento monetário */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function normalizePct(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return n;
}

/**
 * Busca a comissão vigente (profissional x serviço) para uma data (YYYY-MM-DD).
 */
export async function getComissaoPctVigente({
  barbeariaId,
  profissionalId,
  servicoId,
  dataRefYYYYMMDD,
}) {
  const dataRef = String(dataRefYYYYMMDD || "").slice(0, 10);

  const { data, error } = await supabase
    .from("profissional_servico_comissoes")
    .select(
      "id, barbearia_id, profissional_id, servico_id, comissao_pct, vigencia_inicio, vigencia_fim, ativo"
    )
    .eq("barbearia_id", barbeariaId)
    .eq("profissional_id", profissionalId)
    .eq("servico_id", servicoId)
    .eq("ativo", true)
    .lte("vigencia_inicio", dataRef)
    .or(`vigencia_fim.is.null,vigencia_fim.gte.${dataRef}`)
    .order("vigencia_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar comissão vigente do serviço: ${error.message}`);
  }

  return data ? normalizePct(data.comissao_pct) : null;
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
  const preco = Number(precoAplicado ?? 0);

  if (!Number.isFinite(preco) || preco < 0) {
    return {
      comissao_pct_aplicada: 0,
      comissao_valor: 0,
    };
  }

  const pct = await getComissaoPctVigente({
    barbeariaId,
    profissionalId,
    servicoId,
    dataRefYYYYMMDD,
  });

  const pctAplicada = pct == null ? 0 : normalizePct(pct);
  const valor = round2((preco * pctAplicada) / 100);

  return {
    comissao_pct_aplicada: pctAplicada,
    comissao_valor: valor,
  };
}

/**
 * Busca % de comissão de pacote direto do profissional
 */
export async function getComissaoPctPacoteProfissional({ barbeariaId, profissionalId }) {
  if (!barbeariaId || !profissionalId) {
    return 0;
  }

  const { data, error } = await supabase
    .from("profissionais")
    .select("comissao_pacote_pct")
    .eq("barbearia_id", barbeariaId)
    .eq("id", profissionalId)
    .single();

  if (error) {
    throw new Error(`Erro ao buscar comissão de pacote do profissional: ${error.message}`);
  }

  return normalizePct(data?.comissao_pacote_pct);
}

/**
 * Snapshot da comissão do pacote (por pagamento mensal)
 */
export async function calcularComissaoPacote({
  barbeariaId,
  profissionalId,
  valorPago,
}) {
  const valorBase = Number(valorPago ?? 0);

  if (!Number.isFinite(valorBase) || valorBase < 0) {
    return {
      comissao_pct_aplicada: 0,
      comissao_valor: 0,
    };
  }

  const pct = await getComissaoPctPacoteProfissional({
    barbeariaId,
    profissionalId,
  });

  const pctAplicada = normalizePct(pct);
  const valor = round2((valorBase * pctAplicada) / 100);

  return {
    comissao_pct_aplicada: pctAplicada,
    comissao_valor: valor,
  };
}