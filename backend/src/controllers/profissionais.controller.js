// backend/src/controllers/profissionais.controller.js
import { supabase } from "../lib/supabase.js";
import { getBarbeariaId as getBarbeariaIdFromUser, respondBarbeariaAusente } from "../utils/controllerHelpers.js";

/** ---------------------------------------------------------------------
 * GET /profissionais  → público/autenticado conforme rota – só profissionais ativos
 * ------------------------------------------------------------------- */
export async function getProfissionais(req, res) {
  try {
    const barbeariaId = getBarbeariaIdFromUser(req);
    if (!barbeariaId) return respondBarbeariaAusente(res);

    const { data, error } = await supabase
      .from("profissionais")
      .select("id, nome, whatsapp")
      .eq("ativo", true)
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase getProfissionais:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível listar os profissionais.",
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error("Erro inesperado getProfissionais:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao listar profissionais.",
    });
  }
}

/** ---------------------------------------------------------------------
 * GET /profissionais/admin  → admin/owner: lista todos (ativos/inativos)
 * ------------------------------------------------------------------- */
export async function getProfissionaisAdmin(req, res) {
  try {
    const barbeariaId = getBarbeariaIdFromUser(req);
    if (!barbeariaId) return respondBarbeariaAusente(res);

    const { data, error } = await supabase
      .from("profissionais")
      .select("id, nome, whatsapp, ativo, comissao_pdv_pct, comissao_pacote_pct")
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase getProfissionaisAdmin:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível listar os profissionais (admin).",
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error("Erro inesperado getProfissionaisAdmin:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao listar profissionais (admin).",
    });
  }
}

/** ---------------------------------------------------------------------
 * POST /profissionais  → admin/owner: criar profissional
 * body: { nome, whatsapp?, ativo?, comissao_pacote_pct?, comissao_pdv_pct? }
 * ------------------------------------------------------------------- */
export async function createProfissional(req, res) {
  try {
    const barbeariaId = getBarbeariaIdFromUser(req);
    const { nome, whatsapp, ativo, comissao_pacote_pct, comissao_pdv_pct } = req.body || {};

    if (!barbeariaId) return respondBarbeariaAusente(res);

    if (!nome || !String(nome).trim()) {
      return res.status(400).json({
        error: "CAMPOS_OBRIGATORIOS",
        message: "nome é obrigatório.",
      });
    }

    const insertData = {
      barbearia_id: barbeariaId,
      nome: String(nome).trim(),
      whatsapp: whatsapp ? String(whatsapp).trim() : null,
      ativo: ativo === undefined ? true : !!ativo,
    };

    if (comissao_pacote_pct !== undefined) {
      const n = Number(comissao_pacote_pct);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({
          error: "VALIDACAO",
          message: "comissao_pacote_pct inválida (0..100).",
        });
      }
      insertData.comissao_pacote_pct = n;
    }

    if (comissao_pdv_pct !== undefined) {
      const n = Number(comissao_pdv_pct);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({
          error: "VALIDACAO",
          message: "comissao_pdv_pct inválida (0..100).",
        });
      }
      insertData.comissao_pdv_pct = n;
    }

    const { data, error } = await supabase
      .from("profissionais")
      .insert(insertData)
      .select("id, nome, whatsapp, ativo, comissao_pdv_pct, comissao_pacote_pct")
      .single();

    if (error) {
      console.error("Erro Supabase createProfissional:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível criar o profissional.",
      });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error("Erro inesperado createProfissional:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao criar profissional.",
    });
  }
}

/** ---------------------------------------------------------------------
 * PUT /profissionais/:id  → admin/owner: atualizar profissional
 * body opcional: { nome, whatsapp, ativo, comissao_pacote_pct, comissao_pdv_pct }
 * ------------------------------------------------------------------- */
export async function updateProfissional(req, res) {
  try {
    const barbeariaId = getBarbeariaIdFromUser(req);
    const { id } = req.params;
    const { nome, whatsapp, ativo, comissao_pacote_pct, comissao_pdv_pct } = req.body || {};

    if (!barbeariaId) return respondBarbeariaAusente(res);

    if (!id) {
      return res.status(400).json({
        error: "ID_OBRIGATORIO",
        message: "Parâmetro id é obrigatório.",
      });
    }

    const updateData = {};

    if (nome !== undefined) updateData.nome = String(nome || "").trim();
    if (whatsapp !== undefined) updateData.whatsapp = whatsapp ? String(whatsapp).trim() : null;
    if (ativo !== undefined) updateData.ativo = !!ativo;

    if (comissao_pacote_pct !== undefined) {
      const n = Number(comissao_pacote_pct);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({
          error: "VALIDACAO",
          message: "comissao_pacote_pct inválida (0..100).",
        });
      }
      updateData.comissao_pacote_pct = n;
    }

    if (comissao_pdv_pct !== undefined) {
      const n = Number(comissao_pdv_pct);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return res.status(400).json({
          error: "VALIDACAO",
          message: "comissao_pdv_pct inválida (0..100).",
        });
      }
      updateData.comissao_pdv_pct = n;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "SEM_CAMPOS_PARA_ATUALIZAR",
        message: "Nenhum campo válido foi enviado para atualização.",
      });
    }

    const { data, error } = await supabase
      .from("profissionais")
      .update(updateData)
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, nome, whatsapp, ativo, comissao_pdv_pct, comissao_pacote_pct")
      .single();

    if (error) {
      console.error("Erro Supabase updateProfissional:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível atualizar o profissional.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "PROFISSIONAL_NAO_ENCONTRADO",
        message: "Profissional não encontrado para esta barbearia.",
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro inesperado updateProfissional:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao atualizar profissional.",
    });
  }
}

/** ---------------------------------------------------------------------
 * DELETE /profissionais/:id  → admin/owner: "excluir" (soft delete: ativo=false)
 * ------------------------------------------------------------------- */
export async function deleteProfissional(req, res) {
  try {
    const barbeariaId = getBarbeariaIdFromUser(req);
    const { id } = req.params;

    if (!barbeariaId) return respondBarbeariaAusente(res);

    if (!id) {
      return res.status(400).json({
        error: "ID_OBRIGATORIO",
        message: "Parâmetro id é obrigatório.",
      });
    }

    const { data, error } = await supabase
      .from("profissionais")
      .update({ ativo: false })
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, nome, whatsapp, ativo, comissao_pdv_pct, comissao_pacote_pct")
      .single();

    if (error) {
      console.error("Erro Supabase deleteProfissional:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível desativar o profissional.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "PROFISSIONAL_NAO_ENCONTRADO",
        message: "Profissional não encontrado para esta barbearia.",
      });
    }

    return res.status(200).json({
      message: "Profissional desativado com sucesso.",
      profissional: data,
    });
  } catch (err) {
    console.error("Erro inesperado deleteProfissional:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao desativar profissional.",
    });
  }
}

/** ---------------------------------------------------------------------
 * GET /profissionais/:id/comissoes-servico → admin/owner
 * Retorna lista de serviços + % vigente (ou 0)
 * ------------------------------------------------------------------- */
export async function getComissoesServicoCtrl(req, res) {
  try {
    const barbeariaId = getBarbeariaIdFromUser(req);
    const { id: profissionalId } = req.params;

    if (!barbeariaId) return respondBarbeariaAusente(res);

    if (!profissionalId) {
      return res.status(400).json({
        error: "ID_OBRIGATORIO",
        message: "profissionalId é obrigatório.",
      });
    }

    const { data: servicos, error: sErr } = await supabase
      .from("servicos")
      .select("id, nome, preco")
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true });

    if (sErr) {
      console.error("Erro servicos:", sErr);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Falha ao listar serviços.",
      });
    }

    const { data: regras, error: rErr } = await supabase
      .from("profissional_servico_comissoes")
      .select("servico_id, comissao_pct, vigencia_inicio, vigencia_fim, ativo")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissionalId)
      .eq("ativo", true)
      .order("vigencia_inicio", { ascending: false });

    if (rErr) {
      console.error("Erro regras:", rErr);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Falha ao buscar regras.",
      });
    }

    const map = new Map();
    for (const r of regras || []) {
      if (!map.has(r.servico_id)) map.set(r.servico_id, r);
    }

    const out = (servicos || []).map((s) => {
      const r = map.get(s.id);
      return {
        servico_id: s.id,
        servico_nome: s.nome,
        preco: s.preco,
        comissao_pct_vigente: r?.comissao_pct ?? 0,
        vigencia_inicio: r?.vigencia_inicio ?? null,
        vigencia_fim: r?.vigencia_fim ?? null,
      };
    });

    return res.status(200).json({
      profissional_id: profissionalId,
      barbearia_id: barbeariaId,
      itens: out,
    });
  } catch (err) {
    console.error("Erro inesperado getComissoesServicoCtrl:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao carregar comissões.",
    });
  }
}

/** ---------------------------------------------------------------------
 * PUT /profissionais/:id/comissoes-servico → admin/owner
 * body: { regras: [{ servico_id, comissao_pct, vigencia_inicio?, vigencia_fim?, ativo? }] }
 * Faz UPSERT por (barbearia_id, profissional_id, servico_id, vigencia_inicio)
 * ------------------------------------------------------------------- */
export async function upsertComissoesServicoCtrl(req, res) {
  try {
    const barbeariaId = getBarbeariaIdFromUser(req);
    const { id: profissionalId } = req.params;
    const { regras } = req.body || {};

    if (!barbeariaId) return respondBarbeariaAusente(res);

    if (!profissionalId) {
      return res.status(400).json({
        error: "ID_OBRIGATORIO",
        message: "profissionalId é obrigatório.",
      });
    }

    if (!Array.isArray(regras) || regras.length === 0) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "Envie regras[] com pelo menos 1 item.",
      });
    }

    const hoje = new Date().toISOString().slice(0, 10);

    const rows = regras.map((r) => {
      const pct = Number(r.comissao_pct);

      if (!r.servico_id) {
        throw new Error("servico_id é obrigatório em todas as regras.");
      }

      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        throw new Error("comissao_pct inválida (0..100).");
      }

      return {
        barbearia_id: barbeariaId,
        profissional_id: profissionalId,
        servico_id: r.servico_id,
        comissao_pct: pct,
        vigencia_inicio: r.vigencia_inicio || hoje,
        vigencia_fim: r.vigencia_fim || null,
        ativo: r.ativo === undefined ? true : !!r.ativo,
      };
    });

    const { data, error } = await supabase
      .from("profissional_servico_comissoes")
      .upsert(rows, {
        onConflict: "barbearia_id,profissional_id,servico_id,vigencia_inicio",
      })
      .select("id, servico_id, comissao_pct, vigencia_inicio, vigencia_fim, ativo");

    if (error) {
      console.error("Erro upsert regras:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: error.message || "Falha ao salvar regras.",
      });
    }

    return res.status(200).json({
      ok: true,
      salvos: data?.length ?? rows.length,
    });
  } catch (err) {
    console.error("Erro inesperado upsertComissoesServicoCtrl:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: err.message || "Erro interno ao salvar.",
    });
  }
}