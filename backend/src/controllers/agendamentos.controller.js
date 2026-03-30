import { supabaseAdmin } from "../lib/supabase.js";
import { calcularComissaoServico } from "../services/comissoes.service.js";
import { config } from "../config/index.js";
import { getBarbeariaId, respondBarbeariaAusente } from "../utils/controllerHelpers.js";
import { parseDateOnly, normalizeHora, getNowInBusinessTimeZone } from "../utils/datetime.js";

const ADMIN_RETRO_TOLERANCE_MINUTES = config.business.adminRetroToleranceMinutes;

function adicionarMinutos(horaStr, minutos) {
  const [h, m] = String(horaStr || "00:00")
    .slice(0, 5)
    .split(":")
    .map(Number);

  const total = h * 60 + m + Number(minutos || 0);
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function calcularDiffHoras(dataISO, horaInicio) {
  const dataHoraAgendamento = new Date(`${dataISO}T${horaInicio}`);
  const agora = new Date();
  const diffMs = dataHoraAgendamento.getTime() - agora.getTime();
  return diffMs / (1000 * 60 * 60);
}

function validarJanelaReagendamentoCancelamento({ dataISO, horaInicio, isAdmin }) {
  if (isAdmin) return { ok: true };

  const diffHoras = calcularDiffHoras(dataISO, horaInicio);

  if (diffHoras < 2) {
    return {
      ok: false,
      code: "MENOS_2H",
      message:
        "Reagendamentos e cancelamentos só podem ser feitos com pelo menos 2 horas de antecedência.",
    };
  }

  if (diffHoras < 24) {
    return {
      ok: false,
      code: "CLIENTE_MENOS_24H",
      message:
        "Para reagendar ou cancelar com menos de 24 horas, entre em contato diretamente com a barbearia.",
    };
  }

  return { ok: true };
}

function normalizarWhatsapp(input) {
  const raw = String(input || "").trim();
  return raw.replace(/\D/g, "");
}

function parsePositiveInt(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

function toComparableDateTime(dateISO, timeValue) {
  const data = String(dateISO || "").trim();
  const hora = normalizeHora(timeValue);

  if (!parseDateOnly(data) || !hora) return null;

  return Date.parse(`${data}T${hora}Z`);
}

function diffDaysBetweenISO(fromDateISO, toDateISO) {
  const from = Date.parse(`${fromDateISO}T00:00:00Z`);
  const to = Date.parse(`${toDateISO}T00:00:00Z`);
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function isSameISODate(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

async function findOrCreateCliente({
  barbeariaId,
  cliente_id,
  cliente_nome,
  cliente_whatsapp,
  cliente_nascimento,
}) {
  if (cliente_id) {
    return {
      clienteId: cliente_id,
      clienteNome: null,
      clienteWhatsapp: null,
      clienteNascimento: null,
    };
  }

  const whatsappNorm = normalizarWhatsapp(cliente_whatsapp);

  if (!whatsappNorm) {
    return {
      error: {
        status: 400,
        code: "WHATSAPP_OBRIGATORIO",
        message: "Campo cliente_whatsapp é obrigatório.",
      },
    };
  }

  let nascimentoISO = null;
  if (cliente_nascimento != null && String(cliente_nascimento).trim() !== "") {
    const s = String(cliente_nascimento).trim();
    const dt = new Date(`${s}T00:00:00`);
    if (Number.isNaN(dt.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return {
        error: {
          status: 400,
          code: "NASCIMENTO_INVALIDO",
          message: "cliente_nascimento deve estar no formato YYYY-MM-DD.",
        },
      };
    }
    nascimentoISO = s;
  }

  const { data: clientes, error: findError } = await supabaseAdmin
    .from("clientes")
    .select("id, nome, whatsapp, nascimento")
    .eq("barbearia_id", barbeariaId)
    .eq("whatsapp", whatsappNorm)
    .limit(1);

  if (findError) {
    return {
      error: {
        status: 500,
        code: "ERRO_SUPABASE",
        message: "Erro ao buscar cliente.",
      },
    };
  }

  if (clientes && clientes.length > 0) {
    const c = clientes[0];

    if (nascimentoISO && !c.nascimento) {
      const { error: upErr } = await supabaseAdmin
        .from("clientes")
        .update({ nascimento: nascimentoISO })
        .eq("id", c.id)
        .eq("barbearia_id", barbeariaId);

      if (upErr) {
        return {
          error: {
            status: 500,
            code: "ERRO_SUPABASE",
            message: "Erro ao atualizar nascimento do cliente.",
          },
        };
      }

      return {
        clienteId: c.id,
        clienteNome: c.nome,
        clienteWhatsapp: c.whatsapp,
        clienteNascimento: nascimentoISO,
      };
    }

    return {
      clienteId: c.id,
      clienteNome: c.nome,
      clienteWhatsapp: c.whatsapp,
      clienteNascimento: c.nascimento || null,
    };
  }

  const nome = String(cliente_nome || "").trim();
  if (!nome) {
    return {
      error: {
        status: 400,
        code: "NOME_OBRIGATORIO",
        message: "Nome é obrigatório para criar novo cliente.",
      },
    };
  }

  const { data: novoCliente, error: insertError } = await supabaseAdmin
    .from("clientes")
    .insert({
      barbearia_id: barbeariaId,
      nome,
      whatsapp: whatsappNorm,
      documento: null,
      nascimento: nascimentoISO,
    })
    .select("id, nome, whatsapp, nascimento")
    .single();

  if (insertError) {
    return {
      error: {
        status: 500,
        code: "ERRO_SUPABASE",
        message: "Erro ao criar novo cliente.",
      },
    };
  }

  return {
    clienteId: novoCliente.id,
    clienteNome: novoCliente.nome,
    clienteWhatsapp: novoCliente.whatsapp,
    clienteNascimento: novoCliente.nascimento || null,
  };
}

async function buscarOcorrenciaPacoteBase({
  barbeariaId,
  pacoteId,
  pacoteHorarioId,
  dataOriginal,
}) {
  const { data, error } = await supabaseAdmin
    .from("pacote_horarios")
    .select(`
      id,
      pacote_id,
      barbearia_id,
      profissional_id,
      dia_semana,
      hora_inicio,
      duracao_minutos,
      ativo,
      pacote:pacotes (
        id,
        barbearia_id,
        profissional_id,
        vigencia_inicio,
        vigencia_fim,
        ativo
      )
    `)
    .eq("barbearia_id", barbeariaId)
    .eq("id", pacoteHorarioId)
    .eq("pacote_id", pacoteId)
    .single();

  if (error) {
    return {
      error: {
        status: 500,
        code: "ERRO_SUPABASE",
        message: "Erro ao buscar ocorrência do pacote.",
      },
    };
  }

  if (!data || !data.pacote) {
    return {
      error: {
        status: 404,
        code: "PACOTE_OCORRENCIA_NAO_ENCONTRADA",
        message: "Ocorrência do pacote não encontrada.",
      },
    };
  }

  if (data.ativo !== true || data.pacote.ativo !== true) {
    return {
      error: {
        status: 400,
        code: "PACOTE_INATIVO",
        message: "O pacote ou horário recorrente está inativo.",
      },
    };
  }

  const inicio = data.pacote.vigencia_inicio;
  const fim = data.pacote.vigencia_fim;

  if (!inicio || dataOriginal < inicio || (fim && dataOriginal > fim)) {
    return {
      error: {
        status: 400,
        code: "DATA_FORA_VIGENCIA",
        message: "A data informada está fora da vigência do pacote.",
      },
    };
  }

  const diaSemanaOriginal = new Date(`${dataOriginal}T00:00:00`).getDay();
  if (Number(data.dia_semana) !== diaSemanaOriginal) {
    return {
      error: {
        status: 400,
        code: "DATA_NAO_CORRESPONDE_A_OCORRENCIA",
        message: "A data original não corresponde ao dia recorrente desse horário de pacote.",
      },
    };
  }

  return { ocorrencia: data };
}

export async function adicionarExtrasAgendamento(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { id: agendamentoId } = req.params;
    const { itens, profissional_id: profissionalIdBody, user_id: userIdBody } = req.body || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!agendamentoId) {
      return res.status(400).json({
        error: "AGENDAMENTO_ID_OBRIGATORIO",
        message: "Parâmetro :id do agendamento é obrigatório.",
      });
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return res.status(400).json({
        error: "ITENS_OBRIGATORIOS",
        message: "Informe ao menos 1 item de serviço em 'itens'.",
      });
    }

    const { data: ag, error: agErr } = await supabaseAdmin
      .from("agendamentos")
      .select("id, status, barbearia_id, profissional_id, data, hora_inicio")
      .eq("id", agendamentoId)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (agErr) {
      return res.status(500).json({
        error: "ERRO_BUSCA_AGENDAMENTO",
        message: "Erro ao buscar agendamento para lançar extras.",
      });
    }

    if (!ag) {
      return res.status(404).json({
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento não encontrado.",
      });
    }

    const barbeariaIdFinal = String(ag.barbearia_id || "").trim();
    if (!barbeariaIdFinal) {
      return res.status(500).json({
        error: "AGENDAMENTO_SEM_BARBEARIA",
        message: "Agendamento não possui barbearia_id. Não é possível lançar extras.",
      });
    }

    if (ag.status === "cancelado") {
      return res.status(400).json({
        error: "AGENDAMENTO_CANCELADO",
        message: "Não é possível lançar extras em um agendamento cancelado.",
      });
    }

    const userId =
      req.user?.id ||
      req.auth?.userId ||
      (userIdBody ? String(userIdBody) : null);

    if (!userId) {
      return res.status(400).json({
        error: "USER_ID_OBRIGATORIO",
        message: "Não foi possível identificar o usuário (auth). Informe user_id no body ou autentique.",
      });
    }

    const profissionalIdFinal = profissionalIdBody || ag.profissional_id || null;

    if (!profissionalIdFinal) {
      return res.status(400).json({
        error: "PROFISSIONAL_ID_OBRIGATORIO",
        message: "Não foi possível identificar o profissional do extra (profissional_id).",
      });
    }

    const servicoIds = itens
      .map((i) => i?.servico_id)
      .filter(Boolean)
      .map(String);

    const uniqueServicoIds = Array.from(new Set(servicoIds));

    const { data: servicos, error: servErr } = await supabaseAdmin
      .from("servicos")
      .select("id, nome, preco, ativo")
      .eq("barbearia_id", barbeariaIdFinal)
      .in("id", uniqueServicoIds);

    if (servErr) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar serviços para lançar extras.",
      });
    }

    const servicoMap = new Map((servicos || []).map((s) => [String(s.id), s]));

    const itensNorm = [];
    let total = 0;
    let lucroTotal = 0;

    for (const item of itens) {
      const servico_id = String(item?.servico_id || "").trim();
      const quantidade = Number(item?.quantidade ?? 1);

      if (!servico_id) {
        return res.status(400).json({
          error: "SERVICO_ID_OBRIGATORIO",
          message: "Cada item precisa de servico_id.",
        });
      }

      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return res.status(400).json({
          error: "QUANTIDADE_INVALIDA",
          message: "Quantidade deve ser um número > 0.",
        });
      }

      const servico = servicoMap.get(servico_id);

      if (!servico) {
        return res.status(404).json({
          error: "SERVICO_NAO_ENCONTRADO",
          message: `Serviço ${servico_id} não encontrado.`,
        });
      }

      if (servico.ativo === false) {
        return res.status(400).json({
          error: "SERVICO_INATIVO",
          message: `Serviço ${servico.nome || servico_id} está inativo.`,
        });
      }

      const precoVendaUnit =
        item?.preco_venda_unit != null
          ? Number(item.preco_venda_unit)
          : Number(servico.preco ?? 0);

      if (!Number.isFinite(precoVendaUnit) || precoVendaUnit < 0) {
        return res.status(400).json({
          error: "PRECO_INVALIDO",
          message: "preco_venda_unit deve ser um número >= 0.",
        });
      }

      const precoCustoUnit =
        item?.preco_custo_unit != null ? Number(item.preco_custo_unit) : 0;

      if (!Number.isFinite(precoCustoUnit) || precoCustoUnit < 0) {
        return res.status(400).json({
          error: "CUSTO_INVALIDO",
          message: "preco_custo_unit deve ser um número >= 0.",
        });
      }

      const subtotal = Number((precoVendaUnit * quantidade).toFixed(2));
      const custoSubtotal = Number((precoCustoUnit * quantidade).toFixed(2));
      const lucro = Number((subtotal - custoSubtotal).toFixed(2));

      total = Number((total + subtotal).toFixed(2));
      lucroTotal = Number((lucroTotal + lucro).toFixed(2));

      itensNorm.push({
        item_tipo: "servico",
        servico_id,
        produto_id: null,
        quantidade,
        preco_venda_unit: precoVendaUnit,
        preco_custo_unit: precoCustoUnit,
        subtotal,
      });
    }

    let comissaoTotal = 0;

    for (const it of itensNorm) {
      const snap = await calcularComissaoServico({
        barbeariaId: barbeariaIdFinal,
        profissionalId: profissionalIdFinal,
        servicoId: it.servico_id,
        dataRefYYYYMMDD: String(ag.data).slice(0, 10),
        precoAplicado: Number(it.subtotal ?? 0),
      });

      comissaoTotal = Number(
        (comissaoTotal + Number(snap.comissao_valor ?? 0)).toFixed(2)
      );
    }

    const comissaoPctEfetiva =
      total > 0 ? Number(((comissaoTotal / total) * 100).toFixed(2)) : 0;

    const { data: venda, error: vendaErr } = await supabaseAdmin
      .from("vendas")
      .insert({
        barbearia_id: barbeariaIdFinal,
        user_id: userId,
        profissional_id: profissionalIdFinal,
        agendamento_id: agendamentoId,
        total,
        lucro_total: lucroTotal,
        comissao_pct_aplicada: comissaoPctEfetiva,
        comissao_valor: comissaoTotal,
        comissao_calculada_em: new Date().toISOString(),
      })
      .select(
        "id, total, lucro_total, profissional_id, comissao_valor, comissao_pct_aplicada, created_at, agendamento_id"
      )
      .single();

    if (vendaErr) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao criar venda para extras do agendamento.",
      });
    }

    const itensToInsert = itensNorm.map((i) => ({
      venda_id: venda.id,
      produto_id: i.produto_id,
      servico_id: i.servico_id,
      item_tipo: i.item_tipo,
      quantidade: i.quantidade,
      preco_venda_unit: i.preco_venda_unit,
      preco_custo_unit: i.preco_custo_unit,
      subtotal: i.subtotal,
    }));

    const { data: itensInseridos, error: itensErr } = await supabaseAdmin
      .from("venda_itens")
      .insert(itensToInsert)
      .select(
        "id, venda_id, item_tipo, produto_id, servico_id, quantidade, preco_venda_unit, preco_custo_unit, subtotal"
      );

    if (itensErr) {
      await supabaseAdmin.from("vendas").delete().eq("id", venda.id);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao inserir itens da venda extra do agendamento.",
      });
    }

    return res.status(201).json({
      venda,
      itens: itensInseridos || [],
      message: "Extras lançados no financeiro sem alterar a agenda.",
    });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: String(err?.message || err),
    });
  }
}

export async function criarAgendamento(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const {
      cliente_id,
      cliente_nome,
      cliente_whatsapp,
      cliente_nascimento,
      profissional_id,
      servico_id,
      data,
      hora,
      pago,
    } = req.body || {};

    const pagoFinal = pago !== false;

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const dataISO = parseDateOnly(data);
    const horaNormalizada = normalizeHora(hora);

    if (!dataISO) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido.",
      });
    }

    if (!horaNormalizada) {
      return res.status(400).json({
        error: "HORA_INVALIDA",
        message: "Formato de hora inválido.",
      });
    }

    const clienteResolve = await findOrCreateCliente({
      barbeariaId,
      cliente_id,
      cliente_nome,
      cliente_whatsapp,
      cliente_nascimento,
    });

    if (clienteResolve?.error) {
      return res.status(clienteResolve.error.status).json({
        error: clienteResolve.error.code,
        message: clienteResolve.error.message,
      });
    }

    const clienteIdFinal = clienteResolve.clienteId;

    const agoraBiz = getNowInBusinessTimeZone();
    const hojeBiz = agoraBiz.date;

    if (dataISO < hojeBiz) {
      return res.status(400).json({
        error: "DATA_PASSADA",
        message: "Não é permitido agendar para datas que já passaram.",
      });
    }

    const agendamentoComparable = toComparableDateTime(dataISO, horaNormalizada);
    const agoraComparable = toComparableDateTime(agoraBiz.date, agoraBiz.time);

    if (agendamentoComparable == null || agoraComparable == null) {
      return res.status(400).json({
        error: "DATA_HORA_INVALIDA",
        message: "Não foi possível interpretar a data/hora do agendamento.",
      });
    }

    const mesmaData = isSameISODate(dataISO, hojeBiz);

    if (mesmaData) {
      const limiteRetroativo = agoraComparable - ADMIN_RETRO_TOLERANCE_MINUTES * 60 * 1000;

      if (agendamentoComparable < limiteRetroativo) {
        return res.status(400).json({
          error: "HORA_PASSADA",
          message: `Para lançamento interno, só é permitido registrar horários de até ${ADMIN_RETRO_TOLERANCE_MINUTES} minutos atrás.`,
        });
      }
    }

    const diffDias = diffDaysBetweenISO(hojeBiz, dataISO);

    if (diffDias > 7) {
      return res.status(400).json({
        error: "DATA_MUITO_DISTANTE",
        message: "Você só pode agendar dentro dos próximos 7 dias.",
      });
    }

    const { data: servico, error: servicoError } = await supabaseAdmin
      .from("servicos")
      .select("id, nome, duracao_minutos, preco")
      .eq("id", servico_id)
      .eq("barbearia_id", barbeariaId)
      .eq("ativo", true)
      .single();

    if (servicoError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar serviço",
      });
    }

    if (!servico) {
      return res.status(404).json({
        error: "SERVICO_NAO_ENCONTRADO",
        message: "Serviço não encontrado",
      });
    }

    const horaInicioHHMM = horaNormalizada.slice(0, 5);
    const hora_fim = adicionarMinutos(horaInicioHHMM, servico.duracao_minutos);

    const { data: bloqueios, error: bloqueioError } = await supabaseAdmin
      .from("bloqueios_agenda")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissional_id)
      .eq("data", dataISO)
      .lt("hora_inicio", hora_fim)
      .gt("hora_fim", horaNormalizada);

    if (bloqueioError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar bloqueios de agenda",
      });
    }

    if (bloqueios && bloqueios.length > 0) {
      return res.status(409).json({
        error: "HORARIO_BLOQUEADO",
        message: "Este horário está bloqueado na agenda do profissional.",
      });
    }

    const { data: conflitos, error: conflitoError } = await supabaseAdmin
      .from("agendamentos")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissional_id)
      .eq("data", dataISO)
      .eq("status", "confirmado")
      .lt("hora_inicio", hora_fim)
      .gt("hora_fim", horaNormalizada);

    if (conflitoError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar conflitos de agenda",
      });
    }

    if (conflitos && conflitos.length > 0) {
      return res.status(409).json({
        error: "HORARIO_INDISPONIVEL",
        message: "Já existe um agendamento nesse horário para este profissional",
      });
    }

    const precoAplicado = Number(servico.preco ?? 0);

    const { data: novoAgendamento, error: insertError } = await supabaseAdmin
      .from("agendamentos")
      .insert({
        barbearia_id: barbeariaId,
        cliente_id: clienteIdFinal,
        profissional_id,
        servico_id,
        data: dataISO,
        hora_inicio: horaNormalizada,
        hora_fim,
        status: "confirmado",
        preco_aplicado: precoAplicado,
        comissao_pct_aplicada: 0,
        comissao_valor: 0,
        comissao_calculada_em: null,
        pago: pagoFinal,
        pago_em: pagoFinal ? new Date().toISOString() : null,
      })
      .select("id, data, hora_inicio, hora_fim, status, preco_aplicado, comissao_valor, pago, pago_em")
      .single();

    if (insertError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao criar agendamento",
      });
    }

    return res.status(201).json({
      ...novoAgendamento,
      duracao_minutos: servico.duracao_minutos,
      cliente_id: clienteIdFinal,
      cliente_nome: clienteResolve.clienteNome ?? cliente_nome ?? null,
      cliente_whatsapp:
        clienteResolve.clienteWhatsapp ??
        normalizarWhatsapp(cliente_whatsapp) ??
        null,
      cliente_nascimento:
        clienteResolve.clienteNascimento ?? cliente_nascimento ?? null,
    });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao criar agendamento",
    });
  }
}

export async function listarAgendamentos(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { data, profissional_id } = req.query || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!data) {
      return res.status(400).json({
        error: "DATA_OBRIGATORIA",
        message: "Parâmetro data (YYYY-MM-DD) é obrigatório",
      });
    }

    let query = supabaseAdmin
      .from("agendamentos")
      .select(
        `
        id,
        data,
        hora_inicio,
        hora_fim,
        status,
        preco_aplicado,
        comissao_valor,
        cliente:clientes ( id, nome, whatsapp ),
        profissional:profissionais ( id, nome ),
        servico:servicos ( id, nome, preco )
        `
      )
      .eq("barbearia_id", barbeariaId)
      .eq("data", data)
      .eq("status", "confirmado");

    if (profissional_id) query = query.eq("profissional_id", profissional_id);

    const { data: agendamentos, error: errorAg } = await query;

    if (errorAg) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao listar agendamentos",
      });
    }

    const agendamentosNormais = agendamentos || [];

    async function aplicarExtrasNosAgendamentos(lista) {
      if (!Array.isArray(lista) || lista.length === 0) return lista;

      const agIds = lista.map((a) => a.id).filter(Boolean);
      if (agIds.length === 0) return lista;

      const { data: vendas, error: vErr } = await supabaseAdmin
        .from("vendas")
        .select("id, agendamento_id")
        .eq("barbearia_id", barbeariaId)
        .in("agendamento_id", agIds);

      if (vErr) {
        return lista.map((a) => ({
          ...a,
          extras_total: 0,
          extras_count: 0,
          extras_resumo: null,
        }));
      }

      const vendasList = vendas || [];
      if (vendasList.length === 0) {
        return lista.map((a) => ({
          ...a,
          extras_total: 0,
          extras_count: 0,
          extras_resumo: null,
        }));
      }

      const vendaIdToAgId = new Map(
        vendasList.map((v) => [String(v.id), String(v.agendamento_id)])
      );

      const vendaIds = vendasList.map((v) => v.id).filter(Boolean);
      if (vendaIds.length === 0) return lista;

      const { data: itens, error: itErr } = await supabaseAdmin
        .from("venda_itens")
        .select(
          `
          id,
          venda_id,
          item_tipo,
          servico_id,
          quantidade,
          preco_venda_unit,
          subtotal,
          servico:servicos ( nome )
          `
        )
        .in("venda_id", vendaIds)
        .eq("item_tipo", "servico");

      if (itErr) {
        return lista.map((a) => ({
          ...a,
          extras_total: 0,
          extras_count: 0,
          extras_resumo: null,
        }));
      }

      const itensList = itens || [];
      const agg = new Map();

      for (const it of itensList) {
        const vendaId = String(it.venda_id || "");
        const agId = vendaIdToAgId.get(vendaId);
        if (!agId) continue;

        const qtd = Number(it.quantidade ?? 1);
        const subtotal = it.subtotal != null ? Number(it.subtotal) : null;

        const ss = Number.isFinite(subtotal)
          ? subtotal
          : Number(it.preco_venda_unit ?? 0) * (Number.isFinite(qtd) ? qtd : 1);

        const nome = it?.servico?.nome || "Extra";

        if (!agg.has(agId)) {
          agg.set(agId, {
            total: 0,
            count: 0,
            resumoMap: new Map(),
          });
        }

        const r = agg.get(agId);
        r.total = Number((r.total + (Number.isFinite(ss) ? ss : 0)).toFixed(2));
        r.count = r.count + (Number.isFinite(qtd) ? qtd : 1);

        const prevQtd = r.resumoMap.get(nome) || 0;
        r.resumoMap.set(nome, prevQtd + (Number.isFinite(qtd) ? qtd : 1));
      }

      return lista.map((a) => {
        const agId = String(a.id);
        const r = agg.get(agId);

        if (!r) {
          return {
            ...a,
            extras_total: 0,
            extras_count: 0,
            extras_resumo: null,
          };
        }

        const parts = [];
        for (const [nome, qtd] of r.resumoMap.entries()) {
          parts.push(`${nome} (${qtd})`);
        }

        return {
          ...a,
          extras_total: r.total,
          extras_count: r.count,
          extras_resumo: parts.length > 0 ? parts.join(", ") : null,
        };
      });
    }

    const agendamentosComExtras = await aplicarExtrasNosAgendamentos(agendamentosNormais);
    const diaSemana = new Date(`${data}T00:00:00`).getDay();

    let pacotesQuery = supabaseAdmin
      .from("pacote_horarios")
      .select(
        `
        id,
        pacote_id,
        profissional_id,
        dia_semana,
        hora_inicio,
        duracao_minutos,
        ativo,
        pacote:pacotes (
          id,
          barbearia_id,
          cliente_id,
          cliente_nome,
          profissional_id,
          vigencia_inicio,
          vigencia_fim,
          ativo,
          observacoes,
          cliente:clientes ( id, nome, whatsapp )
        ),
        profissional:profissionais ( id, nome )
        `
      )
      .eq("barbearia_id", barbeariaId)
      .eq("ativo", true)
      .eq("dia_semana", diaSemana);

    if (profissional_id) {
      pacotesQuery = pacotesQuery.eq("profissional_id", profissional_id);
    }

    const { data: pacotesHorariosRaw, error: errorPac } = await pacotesQuery;

    if (errorPac) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao listar pacotes fixos",
      });
    }

    const pacotesHorarios = (pacotesHorariosRaw || []).filter((ph) => {
      const pacote = ph.pacote;
      if (!pacote) return false;
      if (pacote.ativo !== true) return false;

      const inicio = pacote.vigencia_inicio;
      const fim = pacote.vigencia_fim;

      if (!inicio) return false;
      if (data < inicio) return false;
      if (fim && data > fim) return false;

      return true;
    });

    const { data: excecoesRaw, error: excecoesError } = await supabaseAdmin
      .from("pacote_excecoes")
      .select(`
        id,
        pacote_id,
        pacote_horario_id,
        data_original,
        acao,
        nova_data,
        nova_hora_inicio,
        nova_duracao_minutos,
        observacoes,
        created_at
      `)
      .eq("barbearia_id", barbeariaId)
      .or(`data_original.eq.${data},nova_data.eq.${data}`);

    if (excecoesError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao listar exceções de pacote",
      });
    }

    const excecoes = excecoesRaw || [];

    const excecaoPorOcorrenciaOriginal = new Map();
    for (const ex of excecoes) {
      const key = `${ex.pacote_horario_id}|${ex.data_original}`;
      excecaoPorOcorrenciaOriginal.set(key, ex);
    }

    const instanciasPacotesBase = pacotesHorarios
      .filter((ph) => {
        const key = `${ph.id}|${data}`;
        return !excecaoPorOcorrenciaOriginal.has(key);
      })
      .map((ph) => {
        const pacote = ph.pacote || {};
        const horaInicioStr = (ph.hora_inicio && String(ph.hora_inicio).slice(0, 5)) || "00:00";
        const horaFimBase = adicionarMinutos(horaInicioStr, ph.duracao_minutos);
        const horaFimStr = horaFimBase.length === 5 ? `${horaFimBase}:00` : horaFimBase;

        return {
          id: `pacote-${pacote.id}-${ph.id}`,
          data,
          hora_inicio: `${horaInicioStr}:00`,
          hora_fim: horaFimStr,
          status: "pacote",
          preco_aplicado: null,
          comissao_valor: null,
          extras_total: 0,
          extras_count: 0,
          extras_resumo: null,
          cliente: {
            id: pacote.cliente?.id || pacote.cliente_id || null,
            nome: pacote.cliente?.nome || pacote.cliente_nome || "Cliente pacote",
            whatsapp: pacote.cliente?.whatsapp || "",
          },
          profissional: {
            id: ph.profissional?.id || ph.profissional_id || pacote.profissional_id || null,
            nome: ph.profissional?.nome || "Profissional",
          },
          servico: {
            id: null,
            nome: pacote.observacoes || "Pacote fixo",
            preco: null,
          },
          pacote_id: pacote.id,
          pacote_horario_id: ph.id,
        };
      });

    const excecoesRemarcadasDoDia = excecoes.filter(
      (ex) => ex.acao === "remarcado" && ex.nova_data === data
    );

    let remarcadosQueryResult = [];
    if (excecoesRemarcadasDoDia.length > 0) {
      const horarioIds = Array.from(
        new Set(excecoesRemarcadasDoDia.map((ex) => ex.pacote_horario_id).filter(Boolean))
      );

      const { data: horariosRemarcados, error: horariosRemarcadosErr } = await supabaseAdmin
        .from("pacote_horarios")
        .select(`
          id,
          pacote_id,
          profissional_id,
          dia_semana,
          hora_inicio,
          duracao_minutos,
          ativo,
          pacote:pacotes (
            id,
            barbearia_id,
            cliente_id,
            cliente_nome,
            profissional_id,
            vigencia_inicio,
            vigencia_fim,
            ativo,
            observacoes,
            cliente:clientes ( id, nome, whatsapp )
          ),
          profissional:profissionais ( id, nome )
        `)
        .eq("barbearia_id", barbeariaId)
        .in("id", horarioIds);

      if (horariosRemarcadosErr) {
        return res.status(500).json({
          error: "ERRO_SUPABASE",
          message: "Erro ao carregar horários remarcados de pacote",
        });
      }

      const horarioMap = new Map((horariosRemarcados || []).map((h) => [String(h.id), h]));

      remarcadosQueryResult = excecoesRemarcadasDoDia
        .map((ex) => {
          const ph = horarioMap.get(String(ex.pacote_horario_id));
          if (!ph) return null;

          const pacote = ph.pacote || {};
          if (ph.ativo !== true || pacote.ativo !== true) return null;

          const profissionalIdEx =
            ph.profissional?.id || ph.profissional_id || pacote.profissional_id || null;

          if (profissional_id && String(profissionalIdEx) !== String(profissional_id)) {
            return null;
          }

          const horaIni = String(ex.nova_hora_inicio || "").slice(0, 5);
          const dur = Number(ex.nova_duracao_minutos || ph.duracao_minutos || 0);
          const horaFimBase = adicionarMinutos(horaIni, dur);
          const horaFimStr = horaFimBase.length === 5 ? `${horaFimBase}:00` : horaFimBase;

          return {
            id: `pacote-remarcado-${pacote.id}-${ph.id}-${ex.id}`,
            data,
            hora_inicio: `${horaIni}:00`,
            hora_fim: horaFimStr,
            status: "pacote_remarcado",
            preco_aplicado: null,
            comissao_valor: null,
            extras_total: 0,
            extras_count: 0,
            extras_resumo: null,
            cliente: {
              id: pacote.cliente?.id || pacote.cliente_id || null,
              nome: pacote.cliente?.nome || pacote.cliente_nome || "Cliente pacote",
              whatsapp: pacote.cliente?.whatsapp || "",
            },
            profissional: {
              id: profissionalIdEx,
              nome: ph.profissional?.nome || "Profissional",
            },
            servico: {
              id: null,
              nome: ex.observacoes || pacote.observacoes || "Pacote remarcado",
              preco: null,
            },
            pacote_id: pacote.id,
            pacote_horario_id: ph.id,
            excecao_id: ex.id,
            data_original: ex.data_original,
            duracao_minutos: dur,
          };
        })
        .filter(Boolean);
    }

    const tudo = [...agendamentosComExtras, ...instanciasPacotesBase, ...remarcadosQueryResult].sort(
      (a, b) => {
        const ha = (a.hora_inicio || "").slice(0, 5);
        const hb = (b.hora_inicio || "").slice(0, 5);
        return ha.localeCompare(hb);
      }
    );

    return res.status(200).json(tudo);
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: String(err?.message || "Erro interno ao listar agendamentos"),
    });
  }
}

export async function cancelarOcorrenciaPacote(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { pacote_id, pacote_horario_id, data_original, observacoes } = req.body || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const pacoteId = String(pacote_id || "").trim();
    const pacoteHorarioId = String(pacote_horario_id || "").trim();
    const dataOriginal = parseDateOnly(data_original);

    if (!pacoteId || !pacoteHorarioId || !dataOriginal) {
      return res.status(400).json({
        error: "CAMPOS_OBRIGATORIOS",
        message: "pacote_id, pacote_horario_id e data_original são obrigatórios.",
      });
    }

    const found = await buscarOcorrenciaPacoteBase({
      barbeariaId,
      pacoteId,
      pacoteHorarioId,
      dataOriginal,
    });

    if (found.error) {
      return res.status(found.error.status).json({
        error: found.error.code,
        message: found.error.message,
      });
    }

    const payload = {
      barbearia_id: barbeariaId,
      pacote_id: pacoteId,
      pacote_horario_id: pacoteHorarioId,
      data_original: dataOriginal,
      acao: "cancelado",
      nova_data: null,
      nova_hora_inicio: null,
      nova_duracao_minutos: null,
      observacoes: observacoes ? String(observacoes).trim() : null,
    };

    const { data, error } = await supabaseAdmin
      .from("pacote_excecoes")
      .upsert(payload, {
        onConflict: "pacote_horario_id,data_original",
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: error.message || "Erro ao cancelar ocorrência do pacote.",
      });
    }

    return res.status(200).json({
      message: "Ocorrência do pacote cancelada com sucesso.",
      excecao: data,
    });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: String(err?.message || err),
    });
  }
}

export async function remarcarOcorrenciaPacote(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const {
      pacote_id,
      pacote_horario_id,
      data_original,
      nova_data,
      nova_hora_inicio,
      nova_duracao_minutos,
      observacoes,
    } = req.body || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const pacoteId = String(pacote_id || "").trim();
    const pacoteHorarioId = String(pacote_horario_id || "").trim();
    const dataOriginal = parseDateOnly(data_original);
    const novaData = parseDateOnly(nova_data);
    const novaHora = normalizeHora(nova_hora_inicio);

    if (!pacoteId || !pacoteHorarioId || !dataOriginal || !novaData || !novaHora) {
      return res.status(400).json({
        error: "CAMPOS_OBRIGATORIOS",
        message:
          "pacote_id, pacote_horario_id, data_original, nova_data e nova_hora_inicio são obrigatórios.",
      });
    }

    const found = await buscarOcorrenciaPacoteBase({
      barbeariaId,
      pacoteId,
      pacoteHorarioId,
      dataOriginal,
    });

    if (found.error) {
      return res.status(found.error.status).json({
        error: found.error.code,
        message: found.error.message,
      });
    }

    const ocorrencia = found.ocorrencia;
    const profissionalId = ocorrencia.profissional_id || ocorrencia.pacote?.profissional_id || null;
    const duracao =
      nova_duracao_minutos === undefined || nova_duracao_minutos === null || nova_duracao_minutos === ""
        ? Number(ocorrencia.duracao_minutos)
        : parsePositiveInt(nova_duracao_minutos);

    if (!profissionalId) {
      return res.status(400).json({
        error: "PROFISSIONAL_NAO_ENCONTRADO",
        message: "Não foi possível identificar o profissional da ocorrência.",
      });
    }

    if (!duracao) {
      return res.status(400).json({
        error: "DURACAO_INVALIDA",
        message: "nova_duracao_minutos deve ser um número inteiro maior que zero.",
      });
    }

    const novaHoraFim = adicionarMinutos(novaHora.slice(0, 5), duracao);

    const { data: bloqueios, error: bloqueioError } = await supabaseAdmin
      .from("bloqueios_agenda")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissionalId)
      .eq("data", novaData)
      .lt("hora_inicio", novaHoraFim)
      .gt("hora_fim", novaHora);

    if (bloqueioError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar bloqueios da nova data/hora.",
      });
    }

    if (bloqueios && bloqueios.length > 0) {
      return res.status(409).json({
        error: "HORARIO_BLOQUEADO",
        message: "A nova data/hora está bloqueada na agenda do profissional.",
      });
    }

    const { data: conflitosAg, error: conflitoAgError } = await supabaseAdmin
      .from("agendamentos")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissionalId)
      .eq("data", novaData)
      .eq("status", "confirmado")
      .lt("hora_inicio", novaHoraFim)
      .gt("hora_fim", novaHora);

    if (conflitoAgError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar conflitos com agendamentos.",
      });
    }

    if (conflitosAg && conflitosAg.length > 0) {
      return res.status(409).json({
        error: "HORARIO_INDISPONIVEL",
        message: "Já existe agendamento confirmado nesse horário.",
      });
    }

    const novoDiaSemana = new Date(`${novaData}T00:00:00`).getDay();

    const { data: conflitosPacoteHorario, error: conflitoPacError } = await supabaseAdmin
      .from("pacote_horarios")
      .select(`
        id,
        pacote_id,
        profissional_id,
        dia_semana,
        hora_inicio,
        duracao_minutos,
        ativo,
        pacote:pacotes (
          id,
          vigencia_inicio,
          vigencia_fim,
          ativo
        )
      `)
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissionalId)
      .eq("ativo", true)
      .eq("dia_semana", novoDiaSemana);

    if (conflitoPacError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar conflitos com pacotes.",
      });
    }

    const conflitosPacoteFiltrados = (conflitosPacoteHorario || []).filter((ph) => {
      const pacote = ph.pacote;
      if (!pacote || pacote.ativo !== true) return false;
      if (!pacote.vigencia_inicio || novaData < pacote.vigencia_inicio) return false;
      if (pacote.vigencia_fim && novaData > pacote.vigencia_fim) return false;

      const inicioExist = String(ph.hora_inicio || "").slice(0, 5);
      const fimExist = adicionarMinutos(inicioExist, Number(ph.duracao_minutos || 0));

      const novoIni = novaHora.slice(0, 5);
      const novoFim = novaHoraFim.slice(0, 5);

      const overlap = inicioExist < novoFim && fimExist > novoIni;

      if (!overlap) return false;

      if (String(ph.id) === pacoteHorarioId && novaData === dataOriginal) {
        return false;
      }

      return true;
    });

    if (conflitosPacoteFiltrados.length > 0) {
      return res.status(409).json({
        error: "CONFLITO_COM_PACOTE",
        message: "A nova data/hora conflita com outro horário de pacote.",
      });
    }

    const payload = {
      barbearia_id: barbeariaId,
      pacote_id: pacoteId,
      pacote_horario_id: pacoteHorarioId,
      data_original: dataOriginal,
      acao: "remarcado",
      nova_data: novaData,
      nova_hora_inicio: novaHora,
      nova_duracao_minutos: duracao,
      observacoes: observacoes ? String(observacoes).trim() : null,
    };

    const { data, error } = await supabaseAdmin
      .from("pacote_excecoes")
      .upsert(payload, {
        onConflict: "pacote_horario_id,data_original",
      })
      .select("*")
      .single();

    if (error) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: error.message || "Erro ao remarcar ocorrência do pacote.",
      });
    }

    return res.status(200).json({
      message: "Ocorrência do pacote remarcada com sucesso.",
      excecao: data,
    });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: String(err?.message || err),
    });
  }
}

export async function reagendarAgendamento(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { id } = req.params;
    const { data, hora } = req.body || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const dataISO = parseDateOnly(data);
    const horaNormalizada = normalizeHora(hora);

    if (!dataISO) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido.",
      });
    }

    if (!horaNormalizada) {
      return res.status(400).json({
        error: "HORA_INVALIDA",
        message: "Formato de hora inválido.",
      });
    }

    const { data: agendamentoAtual, error: erroBusca } = await supabaseAdmin
      .from("agendamentos")
      .select("id, data, hora_inicio, hora_fim, profissional_id, servico_id, status")
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (erroBusca) {
      return res.status(500).json({
        error: "ERRO_BUSCA_AGENDAMENTO",
        message: "Erro ao buscar agendamento.",
      });
    }

    if (!agendamentoAtual) {
      return res.status(404).json({
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento não encontrado.",
      });
    }

    if (agendamentoAtual.status === "cancelado") {
      return res.status(400).json({
        error: "AGENDAMENTO_JA_CANCELADO",
        message: "Não é possível reagendar um agendamento cancelado.",
      });
    }

    const janela = validarJanelaReagendamentoCancelamento({
      dataISO: agendamentoAtual.data,
      horaInicio: agendamentoAtual.hora_inicio,
      isAdmin: true,
    });

    if (!janela.ok) {
      return res.status(400).json({
        error: janela.code,
        message: janela.message,
      });
    }

    const agoraBiz = getNowInBusinessTimeZone();
    const hojeBiz = agoraBiz.date;

    if (dataISO < hojeBiz) {
      return res.status(400).json({
        error: "DATA_PASSADA",
        message: "Não é possível reagendar para uma data que já passou.",
      });
    }

    const novaDataHoraComparable = toComparableDateTime(dataISO, horaNormalizada);
    const agoraComparable = toComparableDateTime(agoraBiz.date, agoraBiz.time);

    if (novaDataHoraComparable == null || agoraComparable == null) {
      return res.status(400).json({
        error: "DATA_HORA_INVALIDA",
        message: "Não foi possível interpretar a nova data/hora.",
      });
    }

    const mesmaData = isSameISODate(dataISO, hojeBiz);

    if (mesmaData) {
      const limiteRetroativo = agoraComparable - ADMIN_RETRO_TOLERANCE_MINUTES * 60 * 1000;

      if (novaDataHoraComparable < limiteRetroativo) {
        return res.status(400).json({
          error: "HORA_PASSADA",
          message: `Para lançamento interno, só é permitido registrar horários de até ${ADMIN_RETRO_TOLERANCE_MINUTES} minutos atrás.`,
        });
      }
    }

    const diffDias = diffDaysBetweenISO(hojeBiz, dataISO);

    if (diffDias > 7) {
      return res.status(400).json({
        error: "DATA_MUITO_DISTANTE",
        message: "Você só pode reagendar dentro dos próximos 7 dias.",
      });
    }

    const { data: servico, error: servicoError } = await supabaseAdmin
      .from("servicos")
      .select("id, duracao_minutos")
      .eq("id", agendamentoAtual.servico_id)
      .eq("barbearia_id", barbeariaId)
      .eq("ativo", true)
      .single();

    if (servicoError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar serviço para reagendar",
      });
    }

    if (!servico) {
      return res.status(404).json({
        error: "SERVICO_NAO_ENCONTRADO",
        message: "Serviço associado ao agendamento não encontrado.",
      });
    }

    const horaInicioHHMM = horaNormalizada.slice(0, 5);
    const novaHoraFim = adicionarMinutos(horaInicioHHMM, servico.duracao_minutos);

    const { data: bloqueios, error: bloqueioError } = await supabaseAdmin
      .from("bloqueios_agenda")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", agendamentoAtual.profissional_id)
      .eq("data", dataISO)
      .lt("hora_inicio", novaHoraFim)
      .gt("hora_fim", horaNormalizada);

    if (bloqueioError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar bloqueios de agenda",
      });
    }

    if (bloqueios && bloqueios.length > 0) {
      return res.status(409).json({
        error: "HORARIO_BLOQUEADO",
        message: "Este horário está bloqueado na agenda do profissional.",
      });
    }

    const { data: conflitos, error: conflitoError } = await supabaseAdmin
      .from("agendamentos")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", agendamentoAtual.profissional_id)
      .eq("data", dataISO)
      .eq("status", "confirmado")
      .lt("hora_inicio", novaHoraFim)
      .gt("hora_fim", horaNormalizada)
      .neq("id", id);

    if (conflitoError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao verificar conflitos de agenda",
      });
    }

    if (conflitos && conflitos.length > 0) {
      return res.status(409).json({
        error: "HORARIO_INDISPONIVEL",
        message: "Já existe um agendamento nesse horário para este profissional.",
      });
    }

    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from("agendamentos")
      .update({
        data: dataISO,
        hora_inicio: horaNormalizada,
        hora_fim: novaHoraFim,
      })
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, data, hora_inicio, hora_fim, status, preco_aplicado, comissao_valor")
      .single();

    if (updateError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao reagendar agendamento",
      });
    }

    return res.status(200).json(atualizado);
  } catch {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao reagendar agendamento",
    });
  }
}

export async function cancelarAgendamento(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { id } = req.params;

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const { data: agendamentoAtual, error: erroBusca } = await supabaseAdmin
      .from("agendamentos")
      .select("id, data, hora_inicio, status")
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (erroBusca) {
      return res.status(500).json({
        error: "ERRO_BUSCA_AGENDAMENTO",
        message: "Erro ao buscar agendamento.",
      });
    }

    if (!agendamentoAtual) {
      return res.status(404).json({
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento não encontrado.",
      });
    }

    if (agendamentoAtual.status === "cancelado") {
      return res.status(400).json({
        error: "AGENDAMENTO_JA_CANCELADO",
        message: "Este agendamento já está cancelado.",
      });
    }

    const janela = validarJanelaReagendamentoCancelamento({
      dataISO: agendamentoAtual.data,
      horaInicio: agendamentoAtual.hora_inicio,
      isAdmin: true,
    });

    if (!janela.ok) {
      return res.status(400).json({
        error: janela.code,
        message: janela.message,
      });
    }

    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from("agendamentos")
      .update({ status: "cancelado" })
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, data, hora_inicio, hora_fim, status, preco_aplicado, comissao_valor")
      .single();

    if (updateError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao cancelar agendamento",
      });
    }

    return res.status(200).json(atualizado);
  } catch {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao cancelar agendamento",
    });
  }
}

export async function concluirAgendamento(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { id } = req.params;

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    const { data: ag, error: erroBusca } = await supabaseAdmin
      .from("agendamentos")
      .select(
        "id, barbearia_id, profissional_id, servico_id, data, status, preco_aplicado, comissao_calculada_em"
      )
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (erroBusca) {
      return res.status(500).json({
        error: "ERRO_BUSCA_AGENDAMENTO",
        message: "Erro ao buscar agendamento.",
      });
    }

    if (!ag) {
      return res.status(404).json({
        error: "AGENDAMENTO_NAO_ENCONTRADO",
        message: "Agendamento não encontrado.",
      });
    }

    if (ag.status === "cancelado") {
      return res.status(400).json({
        error: "AGENDAMENTO_CANCELADO",
        message: "Não é possível concluir um agendamento cancelado.",
      });
    }

    if (ag.comissao_calculada_em) {
      return res.status(409).json({
        error: "COMISSAO_JA_CALCULADA",
        message: "Comissão já foi calculada para este agendamento.",
      });
    }

    const precoAplicado = Number(ag.preco_aplicado ?? 0);

    const snap = await calcularComissaoServico({
      barbeariaId: ag.barbearia_id,
      profissionalId: ag.profissional_id,
      servicoId: ag.servico_id,
      dataRefYYYYMMDD: ag.data,
      precoAplicado,
    });

    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from("agendamentos")
      .update({
        comissao_pct_aplicada: snap.comissao_pct_aplicada,
        comissao_valor: snap.comissao_valor,
        comissao_calculada_em: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("barbearia_id", ag.barbearia_id)
      .select(
        "id, data, status, preco_aplicado, comissao_pct_aplicada, comissao_valor, comissao_calculada_em"
      )
      .single();

    if (updateError) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao salvar comissão do agendamento",
      });
    }

    return res.status(200).json(atualizado);
  } catch {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao concluir agendamento",
    });
  }
}

/**
 * GET /agendamentos/pendentes
 * Lista agendamentos confirmados com pago = false
 */
export async function listarPendentes(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) return respondBarbeariaAusente(res);

    const { data, error } = await supabaseAdmin
      .from("agendamentos")
      .select(
        "id, data, hora_inicio, hora_fim, preco_aplicado, pago, pago_em, " +
        "cliente:clientes(id, nome, whatsapp), " +
        "profissional:profissionais(id, nome), " +
        "servico:servicos(id, nome)"
      )
      .eq("barbearia_id", barbeariaId)
      .eq("status", "confirmado")
      .eq("pago", false)
      .order("data", { ascending: true })
      .order("hora_inicio", { ascending: true });

    if (error) {
      return res.status(500).json({ error: "ERRO_SUPABASE", message: "Erro ao listar pendentes." });
    }

    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: "ERRO_INTERNO", message: String(err?.message || err) });
  }
}

/**
 * PATCH /agendamentos/:id/pagar
 * Marca agendamento como pago
 */
export async function marcarComoPago(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    if (!barbeariaId) return respondBarbeariaAusente(res);

    const { id } = req.params;

    const { data: ag, error: fetchError } = await supabaseAdmin
      .from("agendamentos")
      .select("id, status, pago")
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (fetchError || !ag) {
      return res.status(404).json({ error: "NAO_ENCONTRADO", message: "Agendamento não encontrado." });
    }

    if (ag.status !== "confirmado") {
      return res.status(400).json({ error: "STATUS_INVALIDO", message: "Apenas agendamentos confirmados podem ser marcados como pagos." });
    }

    if (ag.pago) {
      return res.status(400).json({ error: "JA_PAGO", message: "Este agendamento já está marcado como pago." });
    }

    const { data: atualizado, error: updateError } = await supabaseAdmin
      .from("agendamentos")
      .update({ pago: true, pago_em: new Date().toISOString() })
      .eq("id", id)
      .eq("barbearia_id", barbeariaId)
      .select("id, data, hora_inicio, hora_fim, status, preco_aplicado, pago, pago_em")
      .single();

    if (updateError) {
      return res.status(500).json({ error: "ERRO_SUPABASE", message: "Erro ao atualizar pagamento." });
    }

    return res.status(200).json(atualizado);
  } catch (err) {
    return res.status(500).json({ error: "ERRO_INTERNO", message: String(err?.message || err) });
  }
}