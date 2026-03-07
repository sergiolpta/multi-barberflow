// backend/src/controllers/adiantamentos.controller.js
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

function getUserId(req) {
  return req.user?.id || req.auth?.userId || null;
}

// GET /financeiro/adiantamentos?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
export async function listAdiantamentos(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const dataInicio = String(req.query.data_inicio || "").trim();
    const dataFim = String(req.query.data_fim || "").trim();

    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "Informe data_inicio e data_fim (YYYY-MM-DD).",
      });
    }

    const { data, error } = await supabase
      .from("adiantamentos")
      .select(
        `
        id,
        barbearia_id,
        profissional_id,
        valor,
        data,
        descricao,
        user_id,
        fechamento_id,
        abatido_em,
        created_at,
        profissional:profissionais(id,nome)
      `
      )
      .eq("barbearia_id", barbeariaId)
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase listAdiantamentos:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: error.message || "Erro ao listar adiantamentos.",
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error("Erro listAdiantamentos:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno.",
    });
  }
}

// POST /financeiro/adiantamentos
// body: { profissional_id, valor, data, descricao? }
export async function createAdiantamento(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const { profissional_id, valor, data, descricao } = req.body || {};

    if (!profissional_id) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "profissional_id é obrigatório.",
      });
    }

    const nValor = Number(valor);
    if (!Number.isFinite(nValor) || nValor <= 0) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "valor inválido (deve ser > 0).",
      });
    }

    const dataStr = String(data || "").trim();
    if (!dataStr) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data é obrigatória (YYYY-MM-DD).",
      });
    }

    const userId = getUserId(req);

    const { data: row, error } = await supabase
      .from("adiantamentos")
      .insert({
        barbearia_id: barbeariaId,
        profissional_id,
        valor: nValor,
        data: dataStr,
        descricao: descricao ? String(descricao).trim() : null,
        user_id: userId,
        fechamento_id: null,
        abatido_em: null,
      })
      .select(
        `
        id,
        barbearia_id,
        profissional_id,
        valor,
        data,
        descricao,
        user_id,
        fechamento_id,
        abatido_em,
        created_at,
        profissional:profissionais(id,nome)
      `
      )
      .single();

    if (error) {
      console.error("Supabase createAdiantamento:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: error.message || "Erro ao criar adiantamento.",
      });
    }

    return res.status(201).json(row);
  } catch (err) {
    console.error("Erro createAdiantamento:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno.",
    });
  }
}

// DELETE /financeiro/adiantamentos/:id
// Regras: só deixa excluir se ainda NÃO foi abatido (fechamento_id is null)
export async function deleteAdiantamento(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const { id } = req.params;
    if (!id) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "id é obrigatório.",
      });
    }

    const { data: existing, error: getErr } = await supabase
      .from("adiantamentos")
      .select("id, fechamento_id")
      .eq("barbearia_id", barbeariaId)
      .eq("id", id)
      .maybeSingle();

    if (getErr) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: getErr.message,
      });
    }

    if (!existing) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "Adiantamento não encontrado.",
      });
    }

    if (existing.fechamento_id) {
      return res.status(409).json({
        error: "JA_ABATIDO",
        message: "Este adiantamento já foi abatido em um fechamento e não pode ser excluído.",
      });
    }

    const { error: delErr } = await supabase
      .from("adiantamentos")
      .delete()
      .eq("barbearia_id", barbeariaId)
      .eq("id", id);

    if (delErr) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: delErr.message,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Adiantamento excluído com sucesso.",
    });
  } catch (err) {
    console.error("Erro deleteAdiantamento:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno.",
    });
  }
}