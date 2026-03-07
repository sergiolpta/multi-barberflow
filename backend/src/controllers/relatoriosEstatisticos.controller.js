import { supabase } from "../lib/supabase.js";

function getBarbeariaId(req) {
  return String(req?.user?.barbearia_id || "").trim() || null;
}

function respondBarbeariaAusente(res) {
  return res.status(401).json({
    error: "USUARIO_SEM_BARBEARIA",
    message: "Usuário autenticado sem barbearia vinculada.",
  });
}

function isValidDateStr(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(str || ""));
}

/**
 * GET /relatorios/financeiro-diario
 * Query params:
 *   data_inicial=YYYY-MM-DD
 *   data_final=YYYY-MM-DD
 */
export async function financeiroDiario(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { data_inicial, data_final } = req.query || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!data_inicial || !data_final) {
      return res.status(400).json({
        error: "PARAMETROS_INVALIDOS",
        message: "data_inicial e data_final são obrigatórios.",
      });
    }

    if (!isValidDateStr(data_inicial) || !isValidDateStr(data_final)) {
      return res.status(400).json({
        error: "FORMATO_DATA_INVALIDO",
        message: "Use o formato YYYY-MM-DD para data_inicial e data_final.",
      });
    }

    const { data, error } = await supabase
      .from("v_financeiro_diario")
      .select("*")
      .eq("barbearia_id", barbeariaId)
      .gte("data", data_inicial)
      .lte("data", data_final)
      .order("data", { ascending: true });

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: "ERRO_DATABASE",
        message: "Falha ao consultar view v_financeiro_diario.",
      });
    }

    return res.json({
      periodo: { data_inicial, data_final },
      dias: data ?? [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: err.message,
    });
  }
}

/**
 * GET /relatorios/horarios-pico
 * Query params:
 *   data_inicial=YYYY-MM-DD
 *   data_final=YYYY-MM-DD
 */
export async function horariosPico(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { data_inicial, data_final } = req.query || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!data_inicial || !data_final) {
      return res.status(400).json({
        error: "PARAMETROS_INVALIDOS",
        message: "data_inicial e data_final são obrigatórios.",
      });
    }

    if (!isValidDateStr(data_inicial) || !isValidDateStr(data_final)) {
      return res.status(400).json({
        error: "FORMATO_DATA_INVALIDO",
        message: "Use o formato YYYY-MM-DD para data_inicial e data_final.",
      });
    }

    const { data, error } = await supabase
      .from("v_horarios_pico")
      .select("*")
      .eq("barbearia_id", barbeariaId)
      .gte("data", data_inicial)
      .lte("data", data_final);

    if (error) {
      console.error(error);
      return res.status(500).json({
        error: "ERRO_DATABASE",
        message: "Falha ao consultar view v_horarios_pico.",
      });
    }

    const agregPorHora = {};
    const agregPorDia = {};

    for (const linha of data || []) {
      if (!agregPorHora[linha.hora_inicio]) {
        agregPorHora[linha.hora_inicio] = 0;
      }
      agregPorHora[linha.hora_inicio] += Number(linha.atendimentos ?? 0);

      if (!agregPorDia[linha.dia_semana]) {
        agregPorDia[linha.dia_semana] = 0;
      }
      agregPorDia[linha.dia_semana] += Number(linha.atendimentos ?? 0);
    }

    const horarios = Object.entries(agregPorHora)
      .map(([hora, qtd]) => ({ hora, atendimentos: qtd }))
      .sort((a, b) => b.atendimentos - a.atendimentos);

    const diasSemana = Object.entries(agregPorDia)
      .map(([dia, qtd]) => ({
        dia_semana: Number(dia),
        atendimentos: qtd,
      }))
      .sort((a, b) => b.atendimentos - a.atendimentos);

    return res.json({
      periodo: { data_inicial, data_final },
      horarios,
      dias_semana: diasSemana,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: err.message,
    });
  }
}