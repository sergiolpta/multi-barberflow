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

function normalizeHoraInicio(value) {
  const s = String(value || "").trim();
  if (!s) return null;

  // aceita HH:MM ou HH:MM:SS
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;

  return null;
}

function parseDuracao(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseDateOnly(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return s;
}

function sortHorarios(horarios) {
  return [...(horarios || [])].sort((a, b) => {
    const diaA = Number(a?.dia_semana ?? 99);
    const diaB = Number(b?.dia_semana ?? 99);
    if (diaA !== diaB) return diaA - diaB;

    const horaA = String(a?.hora_inicio || "");
    const horaB = String(b?.hora_inicio || "");
    return horaA.localeCompare(horaB);
  });
}

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

function normalizeHorariosInput(horarios) {
  if (!Array.isArray(horarios) || horarios.length === 0) {
    return {
      ok: false,
      error: "HORARIOS_OBRIGATORIOS",
      message: "Envie horarios com pelo menos 1 item.",
    };
  }

  const out = [];
  const seen = new Set();

  for (let i = 0; i < horarios.length; i += 1) {
    const item = horarios[i] || {};

    const diaSemana = parseDiaSemana(item.dia_semana);
    if (diaSemana === null) {
      return {
        ok: false,
        error: "DIA_SEMANA_INVALIDO",
        message: `horarios[${i}].dia_semana deve ser um número de 0 (domingo) a 6 (sábado).`,
      };
    }

    const horaInicio = normalizeHoraInicio(item.hora_inicio);
    if (!horaInicio) {
      return {
        ok: false,
        error: "HORA_INICIO_INVALIDA",
        message: `horarios[${i}].hora_inicio inválida (use HH:MM ou HH:MM:SS).`,
      };
    }

    const duracao = parseDuracao(item.duracao_minutos);
    if (duracao === null) {
      return {
        ok: false,
        error: "DURACAO_INVALIDA",
        message: `horarios[${i}].duracao_minutos deve ser um número maior que zero.`,
      };
    }

    const key = `${diaSemana}|${horaInicio}|${duracao}`;
    if (seen.has(key)) {
      return {
        ok: false,
        error: "HORARIOS_DUPLICADOS",
        message: `Há horários duplicados no payload (dia ${diaSemana}, hora ${horaInicio}, duração ${duracao}).`,
      };
    }
    seen.add(key);

    out.push({
      dia_semana: diaSemana,
      hora_inicio: horaInicio,
      duracao_minutos: duracao,
      ativo: item.ativo === undefined ? true : !!item.ativo,
    });
  }

  return {
    ok: true,
    horarios: sortHorarios(out),
  };
}

function mapPacoteRow(row) {
  const horarios = sortHorarios(
    Array.isArray(row?.horarios)
      ? row.horarios.map((h) => ({
          id: h.id,
          profissional_id: h.profissional_id,
          dia_semana: h.dia_semana,
          hora_inicio: h.hora_inicio,
          duracao_minutos: h.duracao_minutos,
          ativo: h.ativo,
          created_at: h.created_at,
        }))
      : []
  );

  return {
    ...row,
    horarios,
  };
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
      .select(`
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
        profissional:profissionais ( id, nome ),
        horarios:pacote_horarios (
          id,
          profissional_id,
          dia_semana,
          hora_inicio,
          duracao_minutos,
          ativo,
          created_at
        )
      `)
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

    return res.status(200).json((data || []).map(mapPacoteRow));
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
 *
 * Novo payload esperado:
 * {
 *   cliente_id?,
 *   cliente_nome?,
 *   profissional_id,
 *   vigencia_inicio,
 *   vigencia_fim?,
 *   ativo?,
 *   observacoes?,
 *   preco_mensal?,
 *   dia_vencimento?,
 *   cobranca_ativa?,
 *   horarios: [
 *     { dia_semana, hora_inicio, duracao_minutos }
 *   ]
 * }
 *
 * Compatibilidade:
 * se horarios não vier, tenta montar 1 horário a partir de:
 * dia_semana, hora_inicio, duracao_minutos
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
      horarios,
    } = req.body || {};

    if (!profissional_id || !vigencia_inicio) {
      return res.status(400).json({
        error: "CAMPOS_OBRIGATORIOS",
        message: "profissional_id e vigencia_inicio são obrigatórios.",
      });
    }

    const vigInicio = parseDateOnly(vigencia_inicio);
    if (!vigInicio) {
      return res.status(400).json({
        error: "VIGENCIA_INICIO_INVALIDA",
        message: "vigencia_inicio inválida (use formato YYYY-MM-DD).",
      });
    }

    let vigFim = null;
    if (vigencia_fim) {
      vigFim = parseDateOnly(vigencia_fim);
      if (!vigFim) {
        return res.status(400).json({
          error: "VIGENCIA_FIM_INVALIDA",
          message: "vigencia_fim inválida (use formato YYYY-MM-DD).",
        });
      }

      const dIni = new Date(`${vigInicio}T00:00:00`);
      const dFim = new Date(`${vigFim}T00:00:00`);
      if (dFim.getTime() < dIni.getTime()) {
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

    const horariosPayload =
      Array.isArray(horarios) && horarios.length > 0
        ? horarios
        : [
            {
              dia_semana,
              hora_inicio,
              duracao_minutos,
            },
          ];

    const horariosParsed = normalizeHorariosInput(horariosPayload);
    if (!horariosParsed.ok) {
      return res.status(400).json({
        error: horariosParsed.error,
        message: horariosParsed.message,
      });
    }

    const horariosNormalizados = horariosParsed.horarios;
    const primeiroHorario = horariosNormalizados[0];

    const { data: pacoteCriado, error: errorPacote } = await supabase
      .from("pacotes")
      .insert({
        barbearia_id: barbeariaId,
        cliente_id: cliente_id || null,
        cliente_nome: cliente_nome || null,
        profissional_id,
        dia_semana: primeiroHorario.dia_semana,
        hora_inicio: primeiroHorario.hora_inicio,
        duracao_minutos: primeiroHorario.duracao_minutos,
        vigencia_inicio: vigInicio,
        vigencia_fim: vigFim,
        ativo: ativo === undefined ? true : !!ativo,
        observacoes: observacoes || null,
        preco_mensal: precoMensalNum,
        dia_vencimento: diaVenc,
        cobranca_ativa: cobranca_ativa === undefined ? true : !!cobranca_ativa,
      })
      .select(`
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
      `)
      .single();

    if (errorPacote) {
      console.error("Erro Supabase criarPacote:", errorPacote);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível criar o pacote.",
      });
    }

    const horariosInsert = horariosNormalizados.map((h) => ({
      barbearia_id: barbeariaId,
      pacote_id: pacoteCriado.id,
      profissional_id,
      dia_semana: h.dia_semana,
      hora_inicio: h.hora_inicio,
      duracao_minutos: h.duracao_minutos,
      ativo: ativo === undefined ? true : !!ativo,
    }));

    const { data: horariosCriados, error: errorHorarios } = await supabase
      .from("pacote_horarios")
      .insert(horariosInsert)
      .select(`
        id,
        profissional_id,
        dia_semana,
        hora_inicio,
        duracao_minutos,
        ativo,
        created_at
      `);

    if (errorHorarios) {
      console.error("Erro Supabase criar horários do pacote:", errorHorarios);

      // compensação simples para não deixar pacote órfão
      await supabase.from("pacotes").delete().eq("id", pacoteCriado.id).eq("barbearia_id", barbeariaId);

      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível criar os horários do pacote.",
      });
    }

    return res.status(201).json(
      mapPacoteRow({
        ...pacoteCriado,
        horarios: horariosCriados || [],
      })
    );
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
 *
 * Se vier horarios, substitui todos os horários do pacote.
 * Se vier apenas profissional_id (sem horarios), sincroniza o profissional
 * em todos os horários existentes.
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
      horarios,
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

    const { data: pacoteAtual, error: pacoteAtualErr } = await supabase
      .from("pacotes")
      .select(`
        id,
        profissional_id,
        dia_semana,
        hora_inicio,
        duracao_minutos,
        vigencia_inicio,
        vigencia_fim,
        ativo
      `)
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (pacoteAtualErr) {
      console.error("Erro Supabase buscar pacote atual:", pacoteAtualErr);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível carregar o pacote atual.",
      });
    }

    if (!pacoteAtual) {
      return res.status(404).json({
        error: "PACOTE_NAO_ENCONTRADO",
        message: "Pacote não encontrado para esta barbearia.",
      });
    }

    const updateData = {};

    if (cliente_id !== undefined) updateData.cliente_id = cliente_id || null;
    if (cliente_nome !== undefined) updateData.cliente_nome = cliente_nome || null;
    if (observacoes !== undefined) updateData.observacoes = observacoes || null;
    if (ativo !== undefined) updateData.ativo = !!ativo;
    if (cobranca_ativa !== undefined) updateData.cobranca_ativa = !!cobranca_ativa;

    if (profissional_id !== undefined) {
      updateData.profissional_id = profissional_id;
    }

    if (vigencia_inicio !== undefined) {
      const d = parseDateOnly(vigencia_inicio);
      if (!d) {
        return res.status(400).json({
          error: "VIGENCIA_INICIO_INVALIDA",
          message: "vigencia_inicio inválida (use YYYY-MM-DD).",
        });
      }
      updateData.vigencia_inicio = d;
    }

    if (vigencia_fim !== undefined) {
      if (vigencia_fim === null || vigencia_fim === "") {
        updateData.vigencia_fim = null;
      } else {
        const d = parseDateOnly(vigencia_fim);
        if (!d) {
          return res.status(400).json({
            error: "VIGENCIA_FIM_INVALIDA",
            message: "vigencia_fim inválida (use YYYY-MM-DD).",
          });
        }
        updateData.vigencia_fim = d;
      }
    }

    const vigInicioCheck = updateData.vigencia_inicio || pacoteAtual.vigencia_inicio;
    const vigFimCheck =
      updateData.vigencia_fim !== undefined ? updateData.vigencia_fim : pacoteAtual.vigencia_fim;

    if (vigInicioCheck && vigFimCheck) {
      const dIni = new Date(`${vigInicioCheck}T00:00:00`);
      const dFim = new Date(`${vigFimCheck}T00:00:00`);
      if (dFim.getTime() < dIni.getTime()) {
        return res.status(400).json({
          error: "VIGENCIA_INCONSISTENTE",
          message: "vigencia_fim não pode ser anterior a vigencia_inicio.",
        });
      }
    }

    if (preco_mensal !== undefined) {
      if (preco_mensal === null || preco_mensal === "") {
        updateData.preco_mensal = 0;
      } else {
        const n = Number(preco_mensal);
        if (!Number.isFinite(n) || n < 0) {
          return res.status(400).json({
            error: "PRECO_INVALIDO",
            message: "preco_mensal inválido (>= 0).",
          });
        }
        updateData.preco_mensal = n;
      }
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

    // compatibilidade legada:
    // se não vier horarios, ainda aceitamos dia_semana/hora_inicio/duracao_minutos
    let horariosNormalizados = null;

    if (Array.isArray(horarios)) {
      const parsed = normalizeHorariosInput(horarios);
      if (!parsed.ok) {
        return res.status(400).json({
          error: parsed.error,
          message: parsed.message,
        });
      }
      horariosNormalizados = parsed.horarios;
    } else if (
      dia_semana !== undefined ||
      hora_inicio !== undefined ||
      duracao_minutos !== undefined
    ) {
      const parsed = normalizeHorariosInput([
        {
          dia_semana: dia_semana !== undefined ? dia_semana : pacoteAtual.dia_semana,
          hora_inicio: hora_inicio !== undefined ? hora_inicio : pacoteAtual.hora_inicio,
          duracao_minutos:
            duracao_minutos !== undefined ? duracao_minutos : pacoteAtual.duracao_minutos,
        },
      ]);

      if (!parsed.ok) {
        return res.status(400).json({
          error: parsed.error,
          message: parsed.message,
        });
      }
      horariosNormalizados = parsed.horarios;
    }

    // mantém campos legados do pai coerentes com o primeiro horário
    if (horariosNormalizados && horariosNormalizados.length > 0) {
      const primeiroHorario = horariosNormalizados[0];
      updateData.dia_semana = primeiroHorario.dia_semana;
      updateData.hora_inicio = primeiroHorario.hora_inicio;
      updateData.duracao_minutos = primeiroHorario.duracao_minutos;
    }

    if (Object.keys(updateData).length === 0 && horariosNormalizados === null) {
      return res.status(400).json({
        error: "SEM_CAMPOS_PARA_ATUALIZAR",
        message: "Nenhum campo válido foi enviado para atualização.",
      });
    }

    const { data: pacoteAtualizado, error: errorPacote } = await supabase
      .from("pacotes")
      .update(updateData)
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select(`
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
      `)
      .single();

    if (errorPacote) {
      console.error("Erro Supabase atualizarPacote:", errorPacote);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Não foi possível atualizar o pacote.",
      });
    }

    if (!pacoteAtualizado) {
      return res.status(404).json({
        error: "PACOTE_NAO_ENCONTRADO",
        message: "Pacote não encontrado para esta barbearia.",
      });
    }

    const profissionalFinal = pacoteAtualizado.profissional_id;

    if (horariosNormalizados) {
      const { error: deleteErr } = await supabase
        .from("pacote_horarios")
        .delete()
        .eq("pacote_id", id)
        .eq("barbearia_id", barbeariaId);

      if (deleteErr) {
        console.error("Erro Supabase remover horários antigos:", deleteErr);
        return res.status(500).json({
          error: "ERRO_SUPABASE",
          message: "Pacote atualizado, mas não foi possível substituir os horários antigos.",
        });
      }

      const rows = horariosNormalizados.map((h) => ({
        barbearia_id: barbeariaId,
        pacote_id: id,
        profissional_id: profissionalFinal,
        dia_semana: h.dia_semana,
        hora_inicio: h.hora_inicio,
        duracao_minutos: h.duracao_minutos,
        ativo: pacoteAtualizado.ativo,
      }));

      const { data: horariosCriados, error: insertErr } = await supabase
        .from("pacote_horarios")
        .insert(rows)
        .select(`
          id,
          profissional_id,
          dia_semana,
          hora_inicio,
          duracao_minutos,
          ativo,
          created_at
        `);

      if (insertErr) {
        console.error("Erro Supabase recriar horários:", insertErr);
        return res.status(500).json({
          error: "ERRO_SUPABASE",
          message: "Pacote atualizado, mas houve erro ao recriar os horários.",
        });
      }

      return res.status(200).json(
        mapPacoteRow({
          ...pacoteAtualizado,
          horarios: horariosCriados || [],
        })
      );
    }

    // se só mudou profissional/ativo e não veio horarios,
    // sincroniza isso nos horários existentes
    if (profissional_id !== undefined || ativo !== undefined) {
      const horariosPatch = {};
      if (profissional_id !== undefined) horariosPatch.profissional_id = profissionalFinal;
      if (ativo !== undefined) horariosPatch.ativo = !!ativo;

      if (Object.keys(horariosPatch).length > 0) {
        const { error: syncErr } = await supabase
          .from("pacote_horarios")
          .update(horariosPatch)
          .eq("pacote_id", id)
          .eq("barbearia_id", barbeariaId);

        if (syncErr) {
          console.error("Erro Supabase sincronizar horários:", syncErr);
          return res.status(500).json({
            error: "ERRO_SUPABASE",
            message: "Pacote atualizado, mas houve erro ao sincronizar os horários.",
          });
        }
      }
    }

    const { data: horariosAtuais, error: horariosErr } = await supabase
      .from("pacote_horarios")
      .select(`
        id,
        profissional_id,
        dia_semana,
        hora_inicio,
        duracao_minutos,
        ativo,
        created_at
      `)
      .eq("pacote_id", id)
      .eq("barbearia_id", barbeariaId);

    if (horariosErr) {
      console.error("Erro Supabase listar horários atuais:", horariosErr);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Pacote atualizado, mas houve erro ao carregar os horários.",
      });
    }

    return res.status(200).json(
      mapPacoteRow({
        ...pacoteAtualizado,
        horarios: horariosAtuais || [],
      })
    );
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
      .select(`
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
      `)
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

    const { error: horariosErr } = await supabase
      .from("pacote_horarios")
      .update({ ativo: false })
      .eq("pacote_id", id)
      .eq("barbearia_id", barbeariaId);

    if (horariosErr) {
      console.error("Erro Supabase desativar horários do pacote:", horariosErr);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Pacote desativado, mas não foi possível desativar os horários vinculados.",
      });
    }

    const { data: horariosAtuais, error: listarHorariosErr } = await supabase
      .from("pacote_horarios")
      .select(`
        id,
        profissional_id,
        dia_semana,
        hora_inicio,
        duracao_minutos,
        ativo,
        created_at
      `)
      .eq("pacote_id", id)
      .eq("barbearia_id", barbeariaId);

    if (listarHorariosErr) {
      console.error("Erro Supabase listar horários do pacote desativado:", listarHorariosErr);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Pacote desativado, mas houve erro ao carregar os horários.",
      });
    }

    return res.status(200).json({
      message: "Pacote desativado com sucesso.",
      pacote: mapPacoteRow({
        ...data,
        horarios: horariosAtuais || [],
      }),
    });
  } catch (err) {
    console.error("Erro inesperado desativarPacote:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao desativar pacote.",
    });
  }
}

/**
 * GET /pacotes/:id/pagamentos  → admin
 */
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
      .select(`
        id,
        pacote_id,
        competencia,
        valor,
        pago_em,
        forma_pagamento,
        user_id,
        asaas_payment_id,
        created_at,
        comissao_pct_aplicada,
        comissao_valor,
        comissao_calculada_em
      `)
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

/**
 * POST /pacotes/:id/pagamentos  → admin (gestor)
 *
 * Continua usando pacotes.profissional_id para comissão.
 * Isso é proposital nesta fase.
 */
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
      .select(`
        id,
        pacote_id,
        competencia,
        valor,
        pago_em,
        forma_pagamento,
        user_id,
        asaas_payment_id,
        created_at,
        comissao_pct_aplicada,
        comissao_valor,
        comissao_calculada_em
      `)
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