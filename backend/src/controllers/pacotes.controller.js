// backend/src/controllers/pacotes.controller.js
import { supabase } from "../lib/supabase.js";
import { calcularComissaoPacote } from "../services/comissoes.service.js";

function getBarbeariaId(req) {
  return String(req?.user?.barbearia_id || "").trim() || null;
}

function respondBarbeariaAusente(res) {
  return res.status(401).json({
    error: "USUARIO_SEM_BARBEARIA",
    message: "Usuário autenticado sem barbearia vinculada.",
  });
}

function parseDiaSemana(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 6) return null;
  return n;
}

// ---------------------------------------------------------------------
// Helpers (pagamentos) — competência = 1º dia do mês
// ---------------------------------------------------------------------
function normalizeCompetencia(input) {
  const s = String(input || "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  return null;
}

function currentCompetenciaISO() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

/**
 * GET /pacotes  (admin)
 */
export async function listarPacotes(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const { profissional_id, ativo } = req.query;

    let query = supabase
      .from("pacotes")
      .select(
        `
        id,
        cliente_id,
        cliente_nome,
        profissional_id,
        dia_semana,
        hora_inicio,
        duracao_minutos,
        vigencia_inicio,
        vigencia_fim,
        ativo,
        observacoes,
        preco_mensal,
        dia_vencimento,
        cobranca_ativa,
        created_at,
        profissional:profissionais ( id, nome )
      `
      )
      .eq("barbearia_id", barbeariaId)
      .order("dia_semana", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (profissional_id) query = query.eq("profissional_id", profissional_id);

    if (ativo === "true") query = query.eq("ativo", true);
    else if (ativo === "false") query = query.eq("ativo", false);

    const { data, error } = await query;

    if (error) {
      console.error("Erro Supabase listarPacotes:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível listar os pacotes.",
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error("Erro inesperado listarPacotes:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao listar pacotes.",
    });
  }
}

/**
 * POST /pacotes  (admin)
 */
export async function criarPacote(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const {
      cliente_id,
      cliente_nome,
      profissional_id,
      dia_semana,
      hora_inicio,
      duracao_minutos,
      vigencia_inicio,
      vigencia_fim,
      ativo,
      observacoes,
      preco_mensal,
      dia_vencimento,
      cobranca_ativa,
    } = req.body || {};

    if (
      !profissional_id ||
      dia_semana === undefined ||
      !hora_inicio ||
      !duracao_minutos ||
      !vigencia_inicio
    ) {
      return res.status(400).json({
        error: "CAMPOS_OBRIGATORIOS",
        message:
          "profissional_id, dia_semana, hora_inicio, duracao_minutos e vigencia_inicio são obrigatórios.",
      });
    }

    const diaSemanaParsed = parseDiaSemana(dia_semana);
    if (diaSemanaParsed === null) {
      return res.status(400).json({
        error: "DIA_SEMANA_INVALIDO",
        message: "dia_semana deve ser um número de 0 (domingo) a 6 (sábado).",
      });
    }

    const duracao = Number(duracao_minutos);
    if (!Number.isFinite(duracao) || duracao <= 0) {
      return res.status(400).json({
        error: "DURACAO_INVALIDA",
        message: "duracao_minutos deve ser um número maior que zero.",
      });
    }

    const vigInicio = new Date(`${vigencia_inicio}T00:00:00`);
    if (Number.isNaN(vigInicio.getTime())) {
      return res.status(400).json({
        error: "VIGENCIA_INICIO_INVALIDA",
        message: "vigencia_inicio inválida (use formato YYYY-MM-DD).",
      });
    }

    if (vigencia_fim) {
      const vigFim = new Date(`${vigencia_fim}T00:00:00`);
      if (Number.isNaN(vigFim.getTime())) {
        return res.status(400).json({
          error: "VIGENCIA_FIM_INVALIDA",
          message: "vigencia_fim inválida (use formato YYYY-MM-DD).",
        });
      }
      if (vigFim.getTime() < vigInicio.getTime()) {
        return res.status(400).json({
          error: "VIGENCIA_INCONSISTENTE",
          message: "vigencia_fim não pode ser anterior a vigencia_inicio.",
        });
      }
    }

    const precoMensalNum =
      preco_mensal === undefined || preco_mensal === null || preco_mensal === ""
        ? 0
        : Number(preco_mensal);

    if (!Number.isFinite(precoMensalNum) || precoMensalNum < 0) {
      return res.status(400).json({
        error: "PRECO_INVALIDO",
        message: "preco_mensal inválido (>= 0).",
      });
    }

    const diaVenc =
      dia_vencimento === undefined || dia_vencimento === null || dia_vencimento === ""
        ? null
        : Number(dia_vencimento);

    if (diaVenc !== null && (!Number.isInteger(diaVenc) || diaVenc < 1 || diaVenc > 31)) {
      return res.status(400).json({
        error: "DIA_VENCIMENTO_INVALIDO",
        message: "dia_vencimento inválido (1..31) ou null.",
      });
    }

    const { data, error } = await supabase
      .from("pacotes")
      .insert({
        barbearia_id: barbeariaId,
        cliente_id: cliente_id || null,
        cliente_nome: cliente_nome || null,
        profissional_id,
        dia_semana: diaSemanaParsed,
        hora_inicio,
        duracao_minutos: duracao,
        vigencia_inicio,
        vigencia_fim: vigencia_fim || null,
        ativo: ativo === undefined ? true : !!ativo,
        observacoes: observacoes || null,
        preco_mensal: precoMensalNum,
        dia_vencimento: diaVenc,
        cobranca_ativa: cobranca_ativa === undefined ? true : !!cobranca_ativa,
      })
      .select(
        "id, cliente_id, cliente_nome, profissional_id, dia_semana, hora_inicio, duracao_minutos, vigencia_inicio, vigencia_fim, ativo, observacoes, preco_mensal, dia_vencimento, cobranca_ativa"
      )
      .single();

    if (error) {
      console.error("Erro Supabase criarPacote:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível criar o pacote.",
      });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error("Erro inesperado criarPacote:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao criar pacote.",
    });
  }
}

/**
 * PUT /pacotes/:id  (admin)
 */
export async function atualizarPacote(req, res) {
  try {
    const { id } = req.params;
    const {
      cliente_id,
      cliente_nome,
      profissional_id,
      dia_semana,
      hora_inicio,
      duracao_minutos,
      vigencia_inicio,
      vigencia_fim,
      ativo,
      observacoes,
      preco_mensal,
      dia_vencimento,
      cobranca_ativa,
    } = req.body || {};

    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!id) {
      return res.status(400).json({
        error: "ID_OBRIGATORIO",
        message: "Parâmetro id é obrigatório.",
      });
    }

    const updateData = {};

    if (cliente_id !== undefined) updateData.cliente_id = cliente_id || null;
    if (cliente_nome !== undefined) updateData.cliente_nome = cliente_nome || null;
    if (profissional_id !== undefined) updateData.profissional_id = profissional_id;
    if (hora_inicio !== undefined) updateData.hora_inicio = hora_inicio;
    if (observacoes !== undefined) updateData.observacoes = observacoes || null;

    if (dia_semana !== undefined) {
      const diaParsed = parseDiaSemana(dia_semana);
      if (diaParsed === null) {
        return res.status(400).json({
          error: "DIA_SEMANA_INVALIDO",
          message: "dia_semana deve ser um número de 0 (domingo) a 6 (sábado).",
        });
      }
      updateData.dia_semana = diaParsed;
    }

    if (duracao_minutos !== undefined) {
      const dur = Number(duracao_minutos);
      if (!Number.isFinite(dur) || dur <= 0) {
        return res.status(400).json({
          error: "DURACAO_INVALIDA",
          message: "duracao_minutos deve ser um número maior que zero.",
        });
      }
      updateData.duracao_minutos = dur;
    }

    if (vigencia_inicio !== undefined) {
      const d = new Date(`${vigencia_inicio}T00:00:00`);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({
          error: "VIGENCIA_INICIO_INVALIDA",
          message: "vigencia_inicio inválida (use YYYY-MM-DD).",
        });
      }
      updateData.vigencia_inicio = vigencia_inicio;
    }

    if (vigencia_fim !== undefined) {
      if (vigencia_fim === null) {
        updateData.vigencia_fim = null;
      } else {
        const df = new Date(`${vigencia_fim}T00:00:00`);
        if (Number.isNaN(df.getTime())) {
          return res.status(400).json({
            error: "VIGENCIA_FIM_INVALIDA",
            message: "vigencia_fim inválida (use YYYY-MM-DD).",
          });
        }
        updateData.vigencia_fim = vigencia_fim;
      }
    }

    if (ativo !== undefined) updateData.ativo = !!ativo;

    if (preco_mensal !== undefined) {
      const n = Number(preco_mensal);
      if (!Number.isFinite(n) || n < 0) {
        return res.status(400).json({
          error: "PRECO_INVALIDO",
          message: "preco_mensal inválido (>= 0).",
        });
      }
      updateData.preco_mensal = n;
    }

    if (dia_vencimento !== undefined) {
      if (dia_vencimento === null || dia_vencimento === "") {
        updateData.dia_vencimento = null;
      } else {
        const n = Number(dia_vencimento);
        if (!Number.isInteger(n) || n < 1 || n > 31) {
          return res.status(400).json({
            error: "DIA_VENCIMENTO_INVALIDO",
            message: "dia_vencimento inválido (1..31) ou null.",
          });
        }
        updateData.dia_vencimento = n;
      }
    }

    if (cobranca_ativa !== undefined) updateData.cobranca_ativa = !!cobranca_ativa;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "SEM_CAMPOS_PARA_ATUALIZAR",
        message: "Nenhum campo válido foi enviado para atualização.",
      });
    }

    const { data, error } = await supabase
      .from("pacotes")
      .update(updateData)
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select(
        "id, cliente_id, cliente_nome, profissional_id, dia_semana, hora_inicio, duracao_minutos, vigencia_inicio, vigencia_fim, ativo, observacoes, preco_mensal, dia_vencimento, cobranca_ativa"
      )
      .single();

    if (error) {
      console.error("Erro Supabase atualizarPacote:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível atualizar o pacote.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "PACOTE_NAO_ENCONTRADO",
        message: "Pacote não encontrado para esta barbearia.",
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro inesperado atualizarPacote:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao atualizar pacote.",
    });
  }
}

/**
 * DELETE /pacotes/:id  (admin) → soft delete
 */
export async function desativarPacote(req, res) {
  try {
    const { id } = req.params;

    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!id) {
      return res.status(400).json({
        error: "ID_OBRIGATORIO",
        message: "Parâmetro id é obrigatório.",
      });
    }

    const { data, error } = await supabase
      .from("pacotes")
      .update({ ativo: false })
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select(
        "id, cliente_id, cliente_nome, profissional_id, dia_semana, hora_inicio, duracao_minutos, vigencia_inicio, vigencia_fim, ativo, preco_mensal, dia_vencimento, cobranca_ativa"
      )
      .single();

    if (error) {
      console.error("Erro Supabase desativarPacote:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível desativar o pacote.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "PACOTE_NAO_ENCONTRADO",
        message: "Pacote não encontrado para esta barbearia.",
      });
    }

    return res.status(200).json({
      message: "Pacote desativado com sucesso.",
      pacote: data,
    });
  } catch (err) {
    console.error("Erro inesperado desativarPacote:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao desativar pacote.",
    });
  }
}

// ---------------------------------------------------------------------
// GET /pacotes/:id/pagamentos  → admin
// ---------------------------------------------------------------------
export async function listarPagamentosPacote(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const pacoteId = String(req.params?.id || "").trim();
    const limit = Math.min(Math.max(Number(req.query?.limit ?? 24), 1), 120);

    if (!pacoteId) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "id do pacote é obrigatório.",
      });
    }

    const { data: pacote, error: pErr } = await supabase
      .from("pacotes")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("id", pacoteId)
      .single();

    if (pErr) {
      console.error("Erro Supabase validar pacote (listarPagamentosPacote):", pErr);
      return res.status(500).json({
        error: "ERRO_PACOTES",
        message: pErr.message,
      });
    }

    if (!pacote) {
      return res.status(404).json({
        error: "NAO_ENCONTRADO",
        message: "Pacote não encontrado.",
      });
    }

    const { data, error } = await supabase
      .from("pacote_pagamentos")
      .select(
        "id, pacote_id, competencia, valor, pago_em, forma_pagamento, user_id, asaas_payment_id, created_at, comissao_pct_aplicada, comissao_valor, comissao_calculada_em"
      )
      .eq("barbearia_id", barbeariaId)
      .eq("pacote_id", pacoteId)
      .order("competencia", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Erro Supabase listarPagamentosPacote:", error);
      return res.status(500).json({
        error: "ERRO_PAGAMENTOS_PACOTE",
        message: error.message,
      });
    }

    return res.status(200).json({ pagamentos: data || [] });
  } catch (err) {
    console.error("Erro listarPagamentosPacote:", err);
    return res.status(500).json({
      error: "ERRO_PAGAMENTOS_PACOTE",
      message: String(err?.message || err),
    });
  }
}

// ---------------------------------------------------------------------
// POST /pacotes/:id/pagamentos  → admin (gestor)
// ---------------------------------------------------------------------
export async function registrarPagamentoPacote(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const userId = req.user?.id || req.auth?.userId || null;
    if (!userId) {
      return res.status(401).json({
        error: "NAO_AUTENTICADO",
        message: "Usuário não autenticado.",
      });
    }

    const pacoteId = String(req.params?.id || "").trim();
    if (!pacoteId) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "id do pacote é obrigatório.",
      });
    }

    const competencia = normalizeCompetencia(req.body?.competencia) || currentCompetenciaISO();
    const forma_pagamento = req.body?.forma_pagamento
      ? String(req.body.forma_pagamento).trim()
      : null;
    const asaas_payment_id = req.body?.asaas_payment_id
      ? String(req.body.asaas_payment_id).trim()
      : null;

    const { data: pacote, error: pErr } = await supabase
      .from("pacotes")
      .select("id, ativo, preco_mensal, cobranca_ativa, profissional_id")
      .eq("barbearia_id", barbeariaId)
      .eq("id", pacoteId)
      .single();

    if (pErr) {
      console.error("Erro Supabase buscar pacote (registrarPagamentoPacote):", pErr);
      return res.status(500).json({
        error: "ERRO_PACOTES",
        message: pErr.message,
      });
    }

    if (!pacote) {
      return res.status(404).json({
        error: "NAO_ENCONTRADO",
        message: "Pacote não encontrado.",
      });
    }

    if (pacote.ativo === false) {
      return res.status(400).json({
        error: "PACOTE_INATIVO",
        message: "Pacote está inativo.",
      });
    }

    if (pacote.cobranca_ativa === false) {
      return res.status(400).json({
        error: "COBRANCA_PAUSADA",
        message: "Cobrança do pacote está pausada.",
      });
    }

    if (!pacote.profissional_id) {
      return res.status(400).json({
        error: "PACOTE_SEM_PROFISSIONAL",
        message: "Pacote sem profissional vinculado.",
      });
    }

    const valorBody = req.body?.valor;
    const valor =
      valorBody === undefined || valorBody === null || valorBody === ""
        ? Number(pacote.preco_mensal ?? 0)
        : Number(valorBody);

    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "valor inválido (>= 0).",
      });
    }

    const { data: existente, error: exErr } = await supabase
      .from("pacote_pagamentos")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("pacote_id", pacoteId)
      .eq("competencia", competencia)
      .maybeSingle();

    if (exErr) {
      console.error("Erro Supabase verificar pagamento existente:", exErr);
      return res.status(500).json({
        error: "ERRO_PAGAMENTO_PACOTE",
        message: exErr.message,
      });
    }

    if (existente?.id) {
      return res.status(409).json({
        error: "PAGAMENTO_JA_REGISTRADO",
        message: "Já existe pagamento para este pacote nesta competência.",
      });
    }

    const { data: prof, error: prErr } = await supabase
      .from("profissionais")
      .select("id, comissao_pacote_pct")
      .eq("barbearia_id", barbeariaId)
      .eq("id", pacote.profissional_id)
      .single();

    if (prErr) {
      console.error("Erro Supabase buscar profissional (registrarPagamentoPacote):", prErr);
      return res.status(500).json({
        error: "ERRO_PROFISSIONAL",
        message: prErr.message,
      });
    }

    if (!prof) {
      return res.status(404).json({
        error: "PROFISSIONAL_NAO_ENCONTRADO",
        message: "Profissional não encontrado.",
      });
    }

    const snapshot = await calcularComissaoPacote({
      barbeariaId,
      profissionalId: prof.id,
      valorPago: valor,
    });

    const payload = {
      barbearia_id: barbeariaId,
      pacote_id: pacoteId,
      competencia,
      valor,
      forma_pagamento,
      user_id: userId,
      asaas_payment_id,
      comissao_pct_aplicada: snapshot.comissao_pct_aplicada,
      comissao_valor: snapshot.comissao_valor,
      comissao_calculada_em: new Date().toISOString(),
    };

    const { data: pagamento, error } = await supabase
      .from("pacote_pagamentos")
      .insert(payload)
      .select(
        "id, pacote_id, competencia, valor, pago_em, forma_pagamento, user_id, asaas_payment_id, created_at, comissao_pct_aplicada, comissao_valor, comissao_calculada_em"
      )
      .single();

    if (error) {
      console.error("Erro Supabase registrarPagamentoPacote:", error);

      const msg = String(error?.message || "").toLowerCase();
      if (msg.includes("duplicate") || msg.includes("unique")) {
        return res.status(409).json({
          error: "PAGAMENTO_JA_REGISTRADO",
          message: "Já existe pagamento para este pacote nesta competência.",
        });
      }

      return res.status(500).json({
        error: "ERRO_PAGAMENTO_PACOTE",
        message: error.message,
      });
    }

    return res.status(201).json({ pagamento });
  } catch (err) {
    console.error("Erro registrarPagamentoPacote:", err);
    return res.status(500).json({
      error: "ERRO_PAGAMENTO_PACOTE",
      message: String(err?.message || err),
    });
  }
}