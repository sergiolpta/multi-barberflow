// backend/src/controllers/clientes.controller.js
import { supabaseAdmin } from "../lib/supabase.js";

function getBarbeariaId(req) {
  return String(req?.user?.barbearia_id || "").trim() || null;
}

function respondBarbeariaAusente(res) {
  return res.status(401).json({
    error: "USUARIO_SEM_BARBEARIA",
    message: "Usuário autenticado sem barbearia vinculada.",
  });
}

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
 * POST /clientes/lookup
 * body: { whatsapp? , nome? }
 * - lookup “exato” (principalmente por whatsapp)
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