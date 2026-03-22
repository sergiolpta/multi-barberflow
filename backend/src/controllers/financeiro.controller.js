// backend/src/controllers/financeiro.controller.js
import { supabase } from "../lib/supabase.js";
import {
  criarFechamento,
  fecharPeriodo,
  gerarSnapshotFechamento,
  concluirFechamento,

  // ✅ DESPESAS
  criarDespesa,
  listarDespesas,
  deletarDespesa,

  // ✅ TRAVA / LISTAGEM (NOVO)
  assertPeriodoNaoTravadoPorFechamentoConfirmado,
  listarFechamentos,
  obterFechamentoQueCobreData,

  // ✅ PRÉVIA DETALHADA POR PROFISSIONAL
  obterDetalhesPreviaProfissional,
} from "../services/financeiro.service.js";

/**
 * GET /financeiro/previa?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 * Prévia dinâmica (não cria fechamento / não congela snapshot)
 */
export async function obterPreviaPeriodoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;

    // aceita ambos os padrões
    const dataInicio = String(req.query?.data_inicio || req.query?.inicio || "").trim();
    const dataFim = String(req.query?.data_fim || req.query?.fim || "").trim();

    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data_inicio e data_fim são obrigatórios (YYYY-MM-DD).",
      });
    }

    if (dataInicio > dataFim) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data_inicio não pode ser maior que data_fim.",
      });
    }

    const resumo = await fecharPeriodo({
      barbeariaId,
      dataInicio,
      dataFim,
    });

    return res.json({
      periodo: { inicio: dataInicio, fim: dataFim },
      resumo,
    });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_PREVIA",
      message: String(err?.message || err),
    });
  }
}

/**
 * GET /financeiro/fechamentos?inicio=YYYY-MM-DD&fim=YYYY-MM-DD&limit=50
 * ✅ NOVO: lista fechamentos (para revisitar sem ID)
 */
export async function listarFechamentosCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;

    const inicio = String(req.query?.inicio || req.query?.data_inicio || "").trim();
    const fim = String(req.query?.fim || req.query?.data_fim || "").trim();
    const limit = Number(req.query?.limit ?? 50);

    const rows = await listarFechamentos({ barbeariaId, inicio, fim, limit });
    return res.json(rows || []);
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_LISTAR_FECHAMENTOS",
      message: String(err?.message || err),
    });
  }
}

/**
 * GET /financeiro/fechamentos/por-data?data=YYYY-MM-DD
 * ✅ NOVO: pega o fechamento que cobre UMA data (sem precisar do id)
 */
export async function obterFechamentoPorDataCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const dataRef = String(req.query?.data || "").slice(0, 10).trim();

    if (!dataRef) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data é obrigatória (YYYY-MM-DD).",
      });
    }

    const fechamento = await obterFechamentoQueCobreData({ barbeariaId, dataRefYYYYMMDD: dataRef });

    if (!fechamento) {
      return res.status(404).json({
        error: "NAO_ENCONTRADO",
        message: `Nenhum fechamento cobre a data ${dataRef}.`,
      });
    }

    return res.json({ fechamento });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_FECHAMENTO_POR_DATA",
      message: String(err?.message || err),
    });
  }
}

/**
 * POST /financeiro/fechamentos
 * body: { data_inicio: "YYYY-MM-DD", data_fim: "YYYY-MM-DD" }
 */
export async function criarFechamentoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const userId = req.user?.id || req.auth?.userId || null;

    const dataInicio = String(req.body?.data_inicio || "").trim();
    const dataFim = String(req.body?.data_fim || "").trim();

    if (!dataInicio || !dataFim) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data_inicio e data_fim são obrigatórios (YYYY-MM-DD).",
      });
    }

    if (dataInicio > dataFim) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data_inicio não pode ser maior que data_fim.",
      });
    }

    const fechamento = await criarFechamento({
      barbeariaId,
      dataInicio,
      dataFim,
      userId,
    });

    return res.status(201).json({ fechamento });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_FECHAMENTO",
      message: String(err?.message || err),
    });
  }
}

/**
 * GET /financeiro/fechamentos/:id/resumo
 * ⚠️ Prévia dinâmica (não congelada) baseada no fechamento salvo
 */
export async function obterResumoFechamentoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const fechamentoId = String(req.params?.id || "").trim();

    if (!fechamentoId) {
      return res.status(400).json({ error: "VALIDACAO", message: "id inválido." });
    }

    const { data: fechamento, error } = await supabase
      .from("fechamentos")
      .select("id, barbearia_id, periodo_inicio, periodo_fim, status")
      .eq("id", fechamentoId)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (error || !fechamento) {
      return res.status(404).json({
        error: "NAO_ENCONTRADO",
        message: "Fechamento não encontrado para esta barbearia.",
      });
    }

    const resumo = await fecharPeriodo({
      barbeariaId,
      dataInicio: fechamento.periodo_inicio,
      dataFim: fechamento.periodo_fim,
    });

    return res.json({ fechamento, resumo });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_FINANCEIRO",
      message: String(err?.message || err),
    });
  }
}

/**
 * GET /financeiro/fechamentos/:id/profissionais
 * Snapshot congelado (usado pelo frontend)
 */
export async function listarProfissionaisDoFechamentoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const fechamentoId = String(req.params?.id || "").trim();

    if (!fechamentoId) {
      return res.status(400).json({ error: "VALIDACAO", message: "id inválido." });
    }

    const { data: fechamento, error: fErr } = await supabase
      .from("fechamentos")
      .select("id, status, periodo_inicio, periodo_fim, barbearia_id")
      .eq("id", fechamentoId)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (fErr || !fechamento) {
      return res.status(404).json({
        error: "NAO_ENCONTRADO",
        message: "Fechamento não encontrado para esta barbearia.",
      });
    }

    const { data: rows, error: snapErr } = await supabase
      .from("fechamento_profissionais")
      .select(
        [
          "id",
          "fechamento_id",
          "profissional_id",
          "total_servicos",
          "comissao_servicos",
          "total_pacotes",
          "comissao_pacotes",
          "total_pdv",
          "comissao_pdv",
          "adiantamentos_total",
          "comissao_bruta",
          "comissao_liquida",
        ].join(",")
      )
      .eq("barbearia_id", barbeariaId)
      .eq("fechamento_id", fechamentoId)
      .order("comissao_liquida", { ascending: false });

    if (snapErr) {
      return res.status(500).json({
        error: "ERRO_LISTAR_SNAPSHOT",
        message: snapErr.message,
      });
    }

    const profissionalIds = Array.from(
      new Set((rows || []).map((r) => r.profissional_id).filter(Boolean))
    );

    let nomesMap = {};
    if (profissionalIds.length) {
      const { data: profs, error: profErr } = await supabase
        .from("profissionais")
        .select("id, nome")
        .eq("barbearia_id", barbeariaId)
        .in("id", profissionalIds);

      if (profErr) {
        return res.status(500).json({
          error: "ERRO_PROFISSIONAIS",
          message: profErr.message,
        });
      }

      nomesMap = (profs || []).reduce((acc, p) => {
        acc[p.id] = p.nome ?? null;
        return acc;
      }, {});
    }

    return res.json({
      fechamento,
      profissionais: (rows || []).map((r) => ({
        ...r,
        profissional_nome: nomesMap[r.profissional_id] ?? null,
      })),
    });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_LISTAR_SNAPSHOT",
      message: String(err?.message || err),
    });
  }
}

/**
 * POST /financeiro/fechamentos/:id/gerar-snapshot
 */
export async function gerarSnapshotFechamentoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const fechamentoId = String(req.params?.id || "").trim();

    if (!fechamentoId) {
      return res.status(400).json({ error: "VALIDACAO", message: "id inválido." });
    }

    const result = await gerarSnapshotFechamento({ barbeariaId, fechamentoId });
    return res.json(result);
  } catch (err) {
    return res.status(400).json({
      error: "ERRO_SNAPSHOT",
      message: String(err?.message || err),
    });
  }
}

/**
 * POST /financeiro/fechamentos/:id/concluir
 */
export async function concluirFechamentoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const fechamentoId = String(req.params?.id || "").trim();

    if (!fechamentoId) {
      return res.status(400).json({ error: "VALIDACAO", message: "id inválido." });
    }

    const { data: fechamento, error } = await supabase
      .from("fechamentos")
      .select("id, barbearia_id")
      .eq("id", fechamentoId)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (error || !fechamento) {
      return res.status(404).json({
        error: "NAO_ENCONTRADO",
        message: "Fechamento não encontrado para esta barbearia.",
      });
    }

    const { count, error: snapErr } = await supabase
      .from("fechamento_profissionais")
      .select("id", { count: "exact", head: true })
      .eq("barbearia_id", barbeariaId)
      .eq("fechamento_id", fechamentoId);

    if (snapErr) {
      return res.status(500).json({
        error: "ERRO_SNAPSHOT",
        message: snapErr.message,
      });
    }

    if ((count ?? 0) === 0) {
      return res.status(409).json({
        error: "SNAPSHOT_OBRIGATORIO",
        message: "Gere o snapshot antes de concluir o fechamento.",
      });
    }

    const result = await concluirFechamento({ fechamentoId });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_CONCLUIR",
      message: String(err?.message || err),
    });
  }
}

/**
 * POST /financeiro/adiantamentos
 * ✅ NOVO: trava se houver fechamento CONFIRMADO cobrindo a data.
 */
export async function criarAdiantamentoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const userId = req.user?.id || req.auth?.userId || null;

    const profissionalId = String(req.body?.profissional_id || "").trim();
    const valor = Number(req.body?.valor ?? 0);
    const data = String(req.body?.data || "").trim();
    const descricao = req.body?.descricao == null ? null : String(req.body.descricao);

    if (!profissionalId) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "profissional_id é obrigatório.",
      });
    }

    if (!Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "valor deve ser maior que zero.",
      });
    }

    if (!data) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data é obrigatória (YYYY-MM-DD).",
      });
    }

    // ✅ trava por auditoria
    await assertPeriodoNaoTravadoPorFechamentoConfirmado({
      barbeariaId,
      dataRefYYYYMMDD: String(data).slice(0, 10),
      motivo: "criar adiantamento",
    });

    const { data: prof, error: profErr } = await supabase
      .from("profissionais")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("id", profissionalId)
      .single();

    if (profErr || !prof) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "Profissional não encontrado ou não pertence à barbearia.",
      });
    }

    const payload = {
      barbearia_id: barbeariaId,
      profissional_id: profissionalId,
      valor,
      descricao,
      user_id: userId,
      data: String(data).slice(0, 10),
    };

    const { data: adiant, error: insErr } = await supabase
      .from("adiantamentos")
      .insert(payload)
      .select(
        "id, barbearia_id, profissional_id, valor, data, descricao, user_id, fechamento_id, abatido_em, created_at"
      )
      .single();

    if (insErr) {
      return res.status(500).json({
        error: "ERRO_ADIANTAMENTO",
        message: insErr.message,
      });
    }

    return res.status(201).json({ adiantamento: adiant });
  } catch (err) {
    const msg = String(err?.message || err);

    if (msg.startsWith("CONFLITO_FECHAMENTO_CONFIRMADO:")) {
      return res.status(409).json({
        error: "FECHAMENTO_CONFIRMADO",
        message: msg.replace("CONFLITO_FECHAMENTO_CONFIRMADO:", "").trim(),
      });
    }

    return res.status(500).json({
      error: "ERRO_ADIANTAMENTO",
      message: msg,
    });
  }
}

/**
 * GET /financeiro/adiantamentos
 * Aceita:
 * - data_inicio / data_fim
 * - inicio / fim
 *
 * Retorna ARRAY puro.
 */
export async function listarAdiantamentosCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;

    const inicio = String(req.query?.data_inicio || req.query?.inicio || "").trim();
    const fim = String(req.query?.data_fim || req.query?.fim || "").trim();
    const profissionalId = String(req.query?.profissional_id || "").trim();

    let q = supabase
      .from("adiantamentos")
      .select("id, profissional_id, valor, data, descricao, fechamento_id, abatido_em, created_at")
      .eq("barbearia_id", barbeariaId)
      .order("data", { ascending: false })
      .limit(200);

    if (inicio) q = q.gte("data", inicio);
    if (fim) q = q.lte("data", fim);
    if (profissionalId) q = q.eq("profissional_id", profissionalId);

    const { data, error } = await q;

    if (error) {
      return res.status(500).json({
        error: "ERRO_LISTAR_ADIANT",
        message: error.message,
      });
    }

    return res.json(data || []);
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_LISTAR_ADIANT",
      message: String(err?.message || err),
    });
  }
}

/**
 * DELETE /financeiro/adiantamentos/:id
 * Regra: não permitir excluir se já estiver abatido (fechamento_id != null).
 * ✅ NOVO: se por algum motivo existir fechamento confirmado cobrindo a data, também bloqueia.
 */
export async function deletarAdiantamentoCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const adiantamentoId = String(req.params?.id || "").trim();

    if (!adiantamentoId) {
      return res.status(400).json({ error: "VALIDACAO", message: "id inválido." });
    }

    // 1) valida ownership + status (abatido) + pega data
    const { data: row, error: findErr } = await supabase
      .from("adiantamentos")
      .select("id, barbearia_id, fechamento_id, data")
      .eq("id", adiantamentoId)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (findErr || !row) {
      return res.status(404).json({
        error: "NAO_ENCONTRADO",
        message: "Adiantamento não encontrado para esta barbearia.",
      });
    }

    if (row.fechamento_id) {
      return res.status(409).json({
        error: "ADIANTAMENTO_ABATIDO",
        message: "Não é possível excluir: adiantamento já está abatido em um fechamento.",
      });
    }

    // ✅ trava por auditoria (defesa extra)
    await assertPeriodoNaoTravadoPorFechamentoConfirmado({
      barbeariaId,
      dataRefYYYYMMDD: String(row.data || "").slice(0, 10),
      motivo: "excluir adiantamento",
    });

    // 2) delete
    const { error: delErr } = await supabase
      .from("adiantamentos")
      .delete()
      .eq("id", adiantamentoId)
      .eq("barbearia_id", barbeariaId);

    if (delErr) {
      return res.status(500).json({
        error: "ERRO_DELETAR_ADIANTAMENTO",
        message: delErr.message,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    const msg = String(err?.message || err);

    if (msg.startsWith("CONFLITO_FECHAMENTO_CONFIRMADO:")) {
      return res.status(409).json({
        error: "FECHAMENTO_CONFIRMADO",
        message: msg.replace("CONFLITO_FECHAMENTO_CONFIRMADO:", "").trim(),
      });
    }

    return res.status(500).json({
      error: "ERRO_DELETAR_ADIANTAMENTO",
      message: msg,
    });
  }
}

/**
 * POST /financeiro/despesas
 */
export async function criarDespesaCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const userId = req.user?.id || req.auth?.userId || null;

    const data = String(req.body?.data || "").trim();
    const categoria = String(req.body?.categoria || "").trim();
    const descricao = req.body?.descricao == null ? null : String(req.body.descricao);
    const formaPagamento =
      req.body?.forma_pagamento == null ? null : String(req.body.forma_pagamento);
    const valor = Number(req.body?.valor ?? 0);

    if (!data) {
      return res
        .status(400)
        .json({ error: "VALIDACAO", message: "data é obrigatória (YYYY-MM-DD)." });
    }
    if (!categoria) {
      return res.status(400).json({ error: "VALIDACAO", message: "categoria é obrigatória." });
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      return res.status(400).json({ error: "VALIDACAO", message: "valor deve ser maior que zero." });
    }

    const despesa = await criarDespesa({
      barbeariaId,
      userId,
      data,
      categoria,
      descricao,
      formaPagamento,
      valor,
    });

    return res.status(201).json({ despesa });
  } catch (err) {
    const msg = String(err?.message || err);

    if (msg.startsWith("CONFLITO_FECHAMENTO_CONFIRMADO:")) {
      return res.status(409).json({
        error: "FECHAMENTO_CONFIRMADO",
        message: msg.replace("CONFLITO_FECHAMENTO_CONFIRMADO:", "").trim(),
      });
    }

    return res.status(500).json({
      error: "ERRO_DESPESA",
      message: msg,
    });
  }
}

/**
 * GET /financeiro/despesas?data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD&categoria=...
 */
export async function listarDespesasCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;

    const inicio = String(req.query?.data_inicio || req.query?.inicio || "").trim();
    const fim = String(req.query?.data_fim || req.query?.fim || "").trim();
    const categoria = String(req.query?.categoria || "").trim();

    if (!inicio || !fim) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data_inicio e data_fim são obrigatórios (YYYY-MM-DD).",
      });
    }
    if (inicio > fim) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "data_inicio não pode ser maior que data_fim.",
      });
    }

    const rows = await listarDespesas({ barbeariaId, inicio, fim, categoria });
    return res.json(rows || []);
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_LISTAR_DESPESAS",
      message: String(err?.message || err),
    });
  }
}

/**
 * DELETE /financeiro/despesas/:id
 */
export async function deletarDespesaCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const despesaId = String(req.params?.id || "").trim();

    if (!despesaId) {
      return res.status(400).json({ error: "VALIDACAO", message: "id inválido." });
    }

    const result = await deletarDespesa({ barbeariaId, despesaId });
    return res.json(result);
  } catch (err) {
    const msg = String(err?.message || err);

    if (msg.startsWith("CONFLITO_FECHAMENTO_CONFIRMADO:")) {
      return res.status(409).json({
        error: "FECHAMENTO_CONFIRMADO",
        message: msg.replace("CONFLITO_FECHAMENTO_CONFIRMADO:", "").trim(),
      });
    }

    return res.status(500).json({
      error: "ERRO_DELETAR_DESPESA",
      message: msg,
    });
  }
}


/**
 * GET /financeiro/previa/profissional?profissional_id=X&data_inicio=Y&data_fim=Z
 * Retorna itens detalhados (serviços, PDV, pacotes) de um profissional no período.
 */
export async function obterDetalhesPreviaProfissionalCtrl(req, res) {
  try {
    const barbeariaId = req.barbeariaId;
    const profissionalId = String(req.query?.profissional_id || "").trim();
    const dataInicio = String(req.query?.data_inicio || "").trim();
    const dataFim = String(req.query?.data_fim || "").trim();

    if (!profissionalId) {
      return res.status(400).json({ error: "VALIDACAO", message: "profissional_id é obrigatório." });
    }
    if (!dataInicio || !dataFim) {
      return res.status(400).json({ error: "VALIDACAO", message: "data_inicio e data_fim são obrigatórios." });
    }

    const detalhes = await obterDetalhesPreviaProfissional({ barbeariaId, profissionalId, dataInicio, dataFim });
    return res.json(detalhes);
  } catch (err) {
    return res.status(500).json({ error: "ERRO_DETALHES_PREVIA", message: String(err?.message || err) });
  }
}
