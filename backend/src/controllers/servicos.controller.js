// backend/src/controllers/servicos.controller.js
import { supabase } from "../lib/supabase.js";
import { getBarbeariaId, respondBarbeariaAusente } from "../utils/controllerHelpers.js";

// ---------------------------------------------------------------------
// GET /servicos  → lista serviços ativos da barbearia do usuário
// ---------------------------------------------------------------------
export async function getServicos(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const { data, error } = await supabase
      .from("servicos")
      .select("id, nome, duracao_minutos, preco")
      .eq("ativo", true)
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase getServicos:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível listar os serviços.",
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error("Erro inesperado getServicos:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao listar serviços.",
    });
  }
}

// ---------------------------------------------------------------------
// GET /servicos/admin  → admin: lista todos (ativos/inativos)
// ---------------------------------------------------------------------
export async function getServicosAdmin(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const { data, error } = await supabase
      .from("servicos")
      .select("id, nome, duracao_minutos, preco, ativo")
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase getServicosAdmin:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível listar os serviços (admin).",
      });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    console.error("Erro inesperado getServicosAdmin:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao listar serviços (admin).",
    });
  }
}

// ---------------------------------------------------------------------
// POST /servicos  → admin: criar serviço
// body: { nome, duracao_minutos, preco, ativo? }
// ---------------------------------------------------------------------
export async function createServico(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { nome, duracao_minutos, preco, ativo } = req.body || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!nome || duracao_minutos == null || preco == null) {
      return res.status(400).json({
        error: "CAMPOS_OBRIGATORIOS",
        message: "nome, duracao_minutos e preco são obrigatórios.",
      });
    }

    const duracao = Number(duracao_minutos);
    const valorPreco = Number(preco);

    if (!Number.isFinite(duracao) || duracao <= 0) {
      return res.status(400).json({
        error: "DURACAO_INVALIDA",
        message: "A duração do serviço deve ser maior que zero.",
      });
    }

    if (!Number.isFinite(valorPreco) || valorPreco < 0) {
      return res.status(400).json({
        error: "PRECO_INVALIDO",
        message: "O preço do serviço não pode ser negativo.",
      });
    }

    const { data, error } = await supabase
      .from("servicos")
      .insert({
        barbearia_id: barbeariaId,
        nome: String(nome).trim(),
        duracao_minutos: duracao,
        preco: valorPreco,
        ativo: ativo === undefined ? true : !!ativo,
      })
      .select("id, nome, duracao_minutos, preco, ativo")
      .single();

    if (error) {
      console.error("Erro Supabase createServico:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível criar o serviço.",
      });
    }

    return res.status(201).json(data);
  } catch (err) {
    console.error("Erro inesperado createServico:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao criar serviço.",
    });
  }
}

// ---------------------------------------------------------------------
// PUT /servicos/:id  → admin: atualizar serviço
// body (opcional): { nome, duracao_minutos, preco, ativo }
// ---------------------------------------------------------------------
export async function updateServico(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { id } = req.params;
    const { nome, duracao_minutos, preco, ativo } = req.body || {};

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

    if (nome !== undefined) {
      updateData.nome = String(nome).trim();
    }

    if (duracao_minutos !== undefined) {
      const duracao = Number(duracao_minutos);
      if (!Number.isFinite(duracao) || duracao <= 0) {
        return res.status(400).json({
          error: "DURACAO_INVALIDA",
          message: "A duração do serviço deve ser maior que zero.",
        });
      }
      updateData.duracao_minutos = duracao;
    }

    if (preco !== undefined) {
      const valorPreco = Number(preco);
      if (!Number.isFinite(valorPreco) || valorPreco < 0) {
        return res.status(400).json({
          error: "PRECO_INVALIDO",
          message: "O preço do serviço não pode ser negativo.",
        });
      }
      updateData.preco = valorPreco;
    }

    if (ativo !== undefined) {
      updateData.ativo = !!ativo;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: "SEM_CAMPOS_PARA_ATUALIZAR",
        message: "Nenhum campo válido foi enviado para atualização.",
      });
    }

    const { data, error } = await supabase
      .from("servicos")
      .update(updateData)
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, nome, duracao_minutos, preco, ativo")
      .single();

    if (error) {
      console.error("Erro Supabase updateServico:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível atualizar o serviço.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "SERVICO_NAO_ENCONTRADO",
        message: "Serviço não encontrado para esta barbearia.",
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("Erro inesperado updateServico:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao atualizar serviço.",
    });
  }
}

// ---------------------------------------------------------------------
// DELETE /servicos/:id  → admin: soft delete (ativo=false)
// ---------------------------------------------------------------------
export async function deleteServico(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { id } = req.params;

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
      .from("servicos")
      .update({ ativo: false })
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, nome, duracao_minutos, preco, ativo")
      .single();

    if (error) {
      console.error("Erro Supabase deleteServico:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível desativar o serviço.",
      });
    }

    if (!data) {
      return res.status(404).json({
        error: "SERVICO_NAO_ENCONTRADO",
        message: "Serviço não encontrado para esta barbearia.",
      });
    }

    return res.status(200).json({
      message: "Serviço desativado com sucesso.",
      servico: data,
    });
  } catch (err) {
    console.error("Erro inesperado deleteServico:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao desativar serviço.",
    });
  }
}