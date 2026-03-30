// backend/src/controllers/clientes.controller.js
import { supabaseAdmin } from "../lib/supabase.js";
import { getBarbeariaId, respondBarbeariaAusente } from "../utils/controllerHelpers.js";

function normalizarWhatsapp(input) {
  const raw = String(input || "").trim();
  return raw.replace(/\D/g, "");
}

function isYYYYMMDD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * GET /clientes/search?q=...&limit=10
 * - busca por nome (ilike) e também por whatsapp (digits)
 * - retorna id, nome, whatsapp, nascimento
 */
export async function searchClientes(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 20);

    if (!q || q.length < 2) {
      return res.status(200).json([]);
    }

    const digits = normalizarWhatsapp(q);

    let query = supabaseAdmin
      .from("clientes")
      .select("id, nome, whatsapp, nascimento")
      .eq("barbearia_id", barbeariaId)
      .limit(limit);

    if (digits && digits.length >= 6) {
      query = query.or(`nome.ilike.%${q}%,whatsapp.ilike.%${digits}%`);
    } else {
      query = query.ilike("nome", `%${q}%`);
    }

    const { data, error } = await query.order("nome", { ascending: true });

    if (error) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar clientes.",
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: String(err?.message || err),
    });
  }
}

/**
 * GET /clientes?q=...&limit=50&offset=0
 * lista todos os clientes da barbearia com busca opcional
 */
export async function listarClientes(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) return respondBarbeariaAusente(res);

    const q = String(req.query.q || "").trim();
    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
    const offset = Math.max(Number(req.query.offset || 0), 0);

    let query = supabaseAdmin
      .from("clientes")
      .select("id, nome, whatsapp, documento, nascimento, created_at")
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true })
      .range(offset, offset + limit - 1);

    if (q && q.length >= 2) {
      const digits = normalizarWhatsapp(q);
      if (digits && digits.length >= 6) {
        query = query.or(`nome.ilike.%${q}%,whatsapp.ilike.%${digits}%`);
      } else {
        query = query.ilike("nome", `%${q}%`);
      }
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: "ERRO_SUPABASE", message: "Erro ao listar clientes." });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: "ERRO_INTERNO", message: String(err?.message || err) });
  }
}

/**
 * POST /clientes
 * body: { nome, whatsapp, documento?, nascimento? }
 */
export async function criarCliente(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) return respondBarbeariaAusente(res);

    const nome = String(req.body?.nome || "").trim();
    const whatsappRaw = String(req.body?.whatsapp || "").trim();
    const documento = req.body?.documento ? String(req.body.documento).trim() : null;
    const nascimento =
      req.body?.nascimento && isYYYYMMDD(req.body.nascimento) ? req.body.nascimento : null;

    if (!nome) {
      return res.status(400).json({ error: "CAMPO_OBRIGATORIO", message: "Nome é obrigatório." });
    }
    if (!whatsappRaw) {
      return res.status(400).json({ error: "CAMPO_OBRIGATORIO", message: "WhatsApp é obrigatório." });
    }

    const whatsapp = normalizarWhatsapp(whatsappRaw);
    if (!whatsapp) {
      return res.status(400).json({ error: "WHATSAPP_INVALIDO", message: "WhatsApp inválido." });
    }

    const { data, error } = await supabaseAdmin
      .from("clientes")
      .insert({ barbearia_id: barbeariaId, nome, whatsapp, documento, nascimento })
      .select("id, nome, whatsapp, documento, nascimento, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "WHATSAPP_DUPLICADO",
          message: "Já existe um cliente com este WhatsApp.",
        });
      }
      return res.status(500).json({ error: "ERRO_SUPABASE", message: "Erro ao criar cliente." });
    }

    return res.status(201).json(data);
  } catch (err) {
    return res.status(500).json({ error: "ERRO_INTERNO", message: String(err?.message || err) });
  }
}

/**
 * PUT /clientes/:id
 * body: { nome?, whatsapp?, documento?, nascimento? }
 */
export async function atualizarCliente(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) return respondBarbeariaAusente(res);

    const { id } = req.params;

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from("clientes")
      .select("id")
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: "CLIENTE_NAO_ENCONTRADO", message: "Cliente não encontrado." });
    }

    const updates = {};

    if (req.body?.nome !== undefined) {
      const nome = String(req.body.nome).trim();
      if (!nome) {
        return res.status(400).json({ error: "CAMPO_OBRIGATORIO", message: "Nome não pode ser vazio." });
      }
      updates.nome = nome;
    }
    if (req.body?.whatsapp !== undefined) {
      const whatsapp = normalizarWhatsapp(req.body.whatsapp);
      if (!whatsapp) {
        return res.status(400).json({ error: "WHATSAPP_INVALIDO", message: "WhatsApp inválido." });
      }
      updates.whatsapp = whatsapp;
    }
    if (req.body?.documento !== undefined) {
      updates.documento = req.body.documento ? String(req.body.documento).trim() : null;
    }
    if (req.body?.nascimento !== undefined) {
      updates.nascimento =
        req.body.nascimento && isYYYYMMDD(req.body.nascimento) ? req.body.nascimento : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "SEM_ALTERACOES", message: "Nenhum campo para atualizar." });
    }

    const { data, error } = await supabaseAdmin
      .from("clientes")
      .update(updates)
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, nome, whatsapp, documento, nascimento, created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          error: "WHATSAPP_DUPLICADO",
          message: "Já existe um cliente com este WhatsApp.",
        });
      }
      return res.status(500).json({ error: "ERRO_SUPABASE", message: "Erro ao atualizar cliente." });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "ERRO_INTERNO", message: String(err?.message || err) });
  }
}

/**
 * POST /clientes/lookup
 * body: { whatsapp? , nome? }
 * - lookup "exato" (principalmente por whatsapp)
 */
export async function lookupCliente(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const whatsapp = normalizarWhatsapp(req.body?.whatsapp);
    const nome = String(req.body?.nome || "").trim();

    if (!whatsapp && !nome) {
      return res.status(400).json({
        error: "PARAMS_OBRIGATORIOS",
        message: "Informe whatsapp ou nome para lookup.",
      });
    }

    let query = supabaseAdmin
      .from("clientes")
      .select("id, nome, whatsapp, nascimento")
      .eq("barbearia_id", barbeariaId)
      .limit(1);

    if (whatsapp) {
      query = query.eq("whatsapp", whatsapp);
    } else {
      query = query.ilike("nome", nome);
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao fazer lookup do cliente.",
      });
    }

    const cliente = (data || [])[0] || null;
    return res.status(200).json({ cliente });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: String(err?.message || err),
    });
  }
}