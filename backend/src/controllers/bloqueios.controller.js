// backend/src/controllers/bloqueios.controller.js
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

// helper simples para validar hora HH:MM:SS
function horaValida(h) {
  return typeof h === "string" && /^\d{2}:\d{2}(:\d{2})?$/.test(h);
}

// ---------------------------------------------------------------------
// POST /bloqueios  → criarBloqueio
// ---------------------------------------------------------------------
export async function criarBloqueio(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { profissional_id, data, hora_inicio, hora_fim, motivo } = req.body || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!profissional_id || !data || !hora_inicio || !hora_fim) {
      return res.status(400).json({
        error: "CAMPOS_OBRIGATORIOS",
        message: "profissional_id, data, hora_inicio e hora_fim são obrigatórios.",
      });
    }

    if (!horaValida(hora_inicio) || !horaValida(hora_fim)) {
      return res.status(400).json({
        error: "HORA_INVALIDA",
        message: "hora_inicio e hora_fim devem estar no formato HH:MM[:SS].",
      });
    }

    const hi = hora_inicio.length === 5 ? `${hora_inicio}:00` : hora_inicio;
    const hf = hora_fim.length === 5 ? `${hora_fim}:00` : hora_fim;

    if (hi >= hf) {
      return res.status(400).json({
        error: "INTERVALO_INVALIDO",
        message: "hora_inicio deve ser menor que hora_fim.",
      });
    }

    const dataInicio = new Date(`${data}T${hi}`);
    if (Number.isNaN(dataInicio.getTime())) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido.",
      });
    }

    const { data: conflitosBloqueio, error: conflitoBloqError } = await supabase
      .from("bloqueios_agenda")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissional_id)
      .eq("data", data)
      .lt("hora_inicio", hf)
      .gt("hora_fim", hi);

    if (conflitoBloqError) {
      console.error("Erro Supabase criarBloqueio (conflito):", conflitoBloqError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar conflitos de bloqueio.",
      });
    }

    if (conflitosBloqueio && conflitosBloqueio.length > 0) {
      return res.status(409).json({
        error: "BLOQUEIO_CONFLITANTE",
        message: "Já existe um bloqueio nessa faixa de horário para este profissional.",
      });
    }

    const { data: novoBloqueio, error: insertError } = await supabase
      .from("bloqueios_agenda")
      .insert({
        barbearia_id: barbeariaId,
        profissional_id,
        data,
        hora_inicio: hi,
        hora_fim: hf,
        motivo: motivo ? String(motivo).trim() : null,
      })
      .select("id, data, hora_inicio, hora_fim, motivo")
      .single();

    if (insertError) {
      console.error("Erro Supabase criarBloqueio (insert):", insertError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao criar bloqueio de agenda.",
      });
    }

    return res.status(201).json(novoBloqueio);
  } catch (err) {
    console.error("Erro inesperado criarBloqueio:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao criar bloqueio.",
    });
  }
}

// ---------------------------------------------------------------------
// GET /bloqueios  → listarBloqueios
// ---------------------------------------------------------------------
export async function listarBloqueios(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { data, profissional_id } = req.query || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    let query = supabase
      .from("bloqueios_agenda")
      .select(
        `
        id,
        data,
        hora_inicio,
        hora_fim,
        motivo,
        profissional:profissionais ( id, nome )
        `
      )
      .eq("barbearia_id", barbeariaId)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (data) {
      query = query.eq("data", data);
    }

    if (profissional_id) {
      query = query.eq("profissional_id", profissional_id);
    }

    const { data: bloqueios, error } = await query;

    if (error) {
      console.error("Erro Supabase listarBloqueios:", error);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao listar bloqueios.",
      });
    }

    return res.status(200).json(bloqueios || []);
  } catch (err) {
    console.error("Erro inesperado listarBloqueios:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao listar bloqueios.",
    });
  }
}