// backend/src/controllers/relatorios.controller.js
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

// helper simples pra validar datas YYYY-MM-DD
function isValidDateStr(str) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(str || ""));
}

/**
 * GET /relatorios/financeiro
 * Query:
 *  - data_inicial=YYYY-MM-DD (obrigatório)
 *  - data_final=YYYY-MM-DD   (obrigatório)
 *  - profissional_id         (opcional)
 *
 * Retorno:
 *  {
 *    periodo: { data_inicial, data_final },
 *    faturamento_total,
 *    total_atendimentos,
 *    ticket_medio,
 *    servicos: [...],
 *    profissionais: [...]
 *  }
 */
export async function getRelatorioFinanceiro(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    let { data_inicial, data_final, profissional_id } = req.query || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!data_inicial || !data_final) {
      return res.status(400).json({
        error: "DATAS_OBRIGATORIAS",
        message: "data_inicial e data_final são obrigatórios no formato YYYY-MM-DD",
      });
    }

    if (!isValidDateStr(data_inicial) || !isValidDateStr(data_final)) {
      return res.status(400).json({
        error: "FORMATO_DATA_INVALIDO",
        message: "Use o formato de data YYYY-MM-DD para data_inicial e data_final",
      });
    }

    let query = supabase
      .from("agendamentos")
      .select(
        `
        id,
        data,
        status,
        servico:servicos (
          id,
          nome,
          preco
        ),
        profissional:profissionais (
          id,
          nome
        )
      `
      )
      .eq("barbearia_id", barbeariaId)
      .gte("data", data_inicial)
      .lte("data", data_final);

    if (profissional_id) {
      query = query.eq("profissional_id", profissional_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao buscar agendamentos para relatório financeiro:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Falha ao buscar dados para o relatório financeiro",
        details: error.message,
      });
    }

    const agendamentos = (data || []).filter(
      (ag) => ag.status === "confirmado" || !ag.status
    );

    let faturamentoTotal = 0;
    let totalAtendimentos = 0;

    const servicosMap = new Map();
    const profissionaisMap = new Map();

    for (const ag of agendamentos) {
      const servico = ag.servico;
      const profissional = ag.profissional;

      if (!servico || typeof servico.preco !== "number") continue;

      const preco = servico.preco;

      faturamentoTotal += preco;
      totalAtendimentos += 1;

      if (servico.id) {
        const atual = servicosMap.get(servico.id) || {
          servico_id: servico.id,
          nome: servico.nome,
          quantidade: 0,
          faturamento: 0,
        };
        atual.quantidade += 1;
        atual.faturamento += preco;
        servicosMap.set(servico.id, atual);
      }

      if (profissional && profissional.id) {
        const atual = profissionaisMap.get(profissional.id) || {
          profissional_id: profissional.id,
          nome: profissional.nome,
          atendimentos: 0,
          faturamento: 0,
        };
        atual.atendimentos += 1;
        atual.faturamento += preco;
        profissionaisMap.set(profissional.id, atual);
      }
    }

    const ticketMedio =
      totalAtendimentos > 0
        ? Number((faturamentoTotal / totalAtendimentos).toFixed(2))
        : 0;

    const servicosArr = Array.from(servicosMap.values()).sort(
      (a, b) => b.quantidade - a.quantidade
    );

    const profissionaisArr = Array.from(profissionaisMap.values()).sort(
      (a, b) => b.faturamento - a.faturamento
    );

    return res.json({
      periodo: {
        data_inicial,
        data_final,
      },
      faturamento_total: Number(faturamentoTotal.toFixed(2)),
      total_atendimentos: totalAtendimentos,
      ticket_medio: ticketMedio,
      servicos: servicosArr,
      profissionais: profissionaisArr,
    });
  } catch (err) {
    console.error("Erro inesperado em getRelatorioFinanceiro:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Ocorreu um erro interno ao gerar o relatório financeiro",
    });
  }
}