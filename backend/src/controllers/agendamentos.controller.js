// backend/src/controllers/agendamentos.controller.js
import { supabaseAdmin } from "../lib/supabase.js";
import { calcularComissaoServico } from "../services/comissoes.service.js";

function getBarbeariaId(req) {
  return String(req?.user?.barbearia_id || "").trim() || null;
}

function respondBarbeariaAusente(res) {
  return res.status(401).json({
    error: "USUARIO_SEM_BARBEARIA",
    message: "Usuário autenticado sem barbearia vinculada.",
  });
}

function adicionarMinutos(horaStr, minutos) {
  const [h, m] = horaStr.split(":").map(Number);
  const total = h * 60 + m + minutos;
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

/**
 * ALTERAÇÃO APLICADA:
 * - Como nesta fase apenas owner/admin podem reagendar/cancelar,
 *   removemos as travas de antecedência para admins (gap aberto).
 * - Quando você habilitar cliente no futuro, é só remover esse early-return
 *   e voltar a aplicar as regras por role.
 */
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

/**
 * ✅ ALTERADO:
 * - aceita cliente_nascimento (YYYY-MM-DD)
 * - ao encontrar cliente por whatsapp:
 *    - se veio nascimento e cliente não tem, atualiza (sem sobrescrever)
 * - ao criar novo cliente:
 *    - grava nascimento se vier
 */
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

/**
 * NOVO: adiciona "serviço extra" ao financeiro sem mexer na agenda.
 * ✅ CORRIGIDO: agora calcula e grava comissão em vendas (extras).
 * ✅ CORRIGIDO (BUG PRINCIPAL): usa SEMPRE o barbearia_id do agendamento (ag.barbearia_id)
 * para garantir que o Financeiro encontre essa venda no fechamento/prévia.
 */
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
    } = req.body || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
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

    const agora = new Date();
    const hoje = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
      0,
      0,
      0,
      0
    );

    const dataSelecionadaDia = new Date(`${data}T00:00:00`);
    if (Number.isNaN(dataSelecionadaDia.getTime())) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido.",
      });
    }

    if (dataSelecionadaDia.getTime() < hoje.getTime()) {
      return res.status(400).json({
        error: "DATA_PASSADA",
        message: "Não é permitido agendar para datas que já passaram.",
      });
    }

    const agendamentoCompleto = new Date(`${data}T${hora}`);
    if (Number.isNaN(agendamentoCompleto.getTime())) {
      return res.status(400).json({
        error: "HORA_INVALIDA",
        message: "Formato de hora inválido.",
      });
    }

    const mesmaData =
      dataSelecionadaDia.getFullYear() === hoje.getFullYear() &&
      dataSelecionadaDia.getMonth() === hoje.getMonth() &&
      dataSelecionadaDia.getDate() === hoje.getDate();

    if (mesmaData && agendamentoCompleto.getTime() < agora.getTime()) {
      return res.status(400).json({
        error: "HORA_PASSADA",
        message: "Escolha um horário futuro.",
      });
    }

    const diffMs = dataSelecionadaDia.getTime() - hoje.getTime();
    const diffDias = diffMs / (1000 * 60 * 60 * 24);

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

    const hora_fim = adicionarMinutos(hora, servico.duracao_minutos);

    const { data: bloqueios, error: bloqueioError } = await supabaseAdmin
      .from("bloqueios_agenda")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissional_id)
      .eq("data", data)
      .lt("hora_inicio", hora_fim)
      .gt("hora_fim", hora);

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
      .eq("data", data)
      .eq("status", "confirmado")
      .lt("hora_inicio", hora_fim)
      .gt("hora_fim", hora);

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
        data,
        hora_inicio: hora,
        hora_fim,
        status: "confirmado",
        preco_aplicado: precoAplicado,
        comissao_pct_aplicada: 0,
        comissao_valor: 0,
        comissao_calculada_em: null,
      })
      .select("id, data, hora_inicio, hora_fim, status, preco_aplicado, comissao_valor")
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
      .from("pacotes")
      .select(
        `
        id,
        barbearia_id,
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
        cliente:clientes ( id, nome, whatsapp ),
        profissional:profissionais ( id, nome )
        `
      )
      .eq("barbearia_id", barbeariaId)
      .eq("ativo", true)
      .eq("dia_semana", diaSemana);

    if (profissional_id) pacotesQuery = pacotesQuery.eq("profissional_id", profissional_id);

    const { data: pacotesRaw, error: errorPac } = await pacotesQuery;

    if (errorPac) {
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao listar pacotes fixos",
      });
    }

    const pacotes = (pacotesRaw || []).filter((p) => {
      const inicio = p.vigencia_inicio;
      const fim = p.vigencia_fim;
      if (!inicio) return false;
      if (data < inicio) return false;
      if (fim && data > fim) return false;
      return true;
    });

    const instanciasPacotes = pacotes.map((p) => {
      const horaInicioStr = (p.hora_inicio && p.hora_inicio.slice(0, 5)) || "00:00";
      const horaFimStrBase = adicionarMinutos(horaInicioStr, p.duracao_minutos);
      const horaFimStr = horaFimStrBase.length === 5 ? `${horaFimStrBase}:00` : horaFimStrBase;

      return {
        id: `pacote-${p.id}`,
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
          id: p.cliente?.id || p.cliente_id || null,
          nome: p.cliente?.nome || p.cliente_nome || "Cliente pacote",
          whatsapp: p.cliente?.whatsapp || "",
        },
        profissional: {
          id: p.profissional?.id || p.profissional_id,
          nome: p.profissional?.nome || "Profissional",
        },
        servico: {
          id: null,
          nome: p.observacoes || "Pacote fixo",
          preco: null,
        },
      };
    });

    const tudo = [...agendamentosComExtras, ...instanciasPacotes].sort((a, b) => {
      const ha = (a.hora_inicio || "").slice(0, 5);
      const hb = (b.hora_inicio || "").slice(0, 5);
      return ha.localeCompare(hb);
    });

    return res.status(200).json(tudo);
  } catch {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao listar agendamentos",
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

    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    const dataSelecionadaDia = new Date(`${data}T00:00:00`);

    if (Number.isNaN(dataSelecionadaDia.getTime())) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido.",
      });
    }

    if (dataSelecionadaDia.getTime() < hoje.getTime()) {
      return res.status(400).json({
        error: "DATA_PASSADA",
        message: "Não é possível reagendar para uma data que já passou.",
      });
    }

    const novaDataHora = new Date(`${data}T${hora}`);
    if (Number.isNaN(novaDataHora.getTime())) {
      return res.status(400).json({
        error: "HORA_INVALIDA",
        message: "Formato de hora inválido.",
      });
    }

    const mesmaData =
      dataSelecionadaDia.getFullYear() === hoje.getFullYear() &&
      dataSelecionadaDia.getMonth() === hoje.getMonth() &&
      dataSelecionadaDia.getDate() === hoje.getDate();

    if (mesmaData && novaDataHora.getTime() < agora.getTime()) {
      return res.status(400).json({
        error: "HORA_PASSADA",
        message: "Escolha um horário futuro.",
      });
    }

    const diffMs = dataSelecionadaDia.getTime() - hoje.getTime();
    const diffDias = diffMs / (1000 * 60 * 60 * 24);

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

    const novaHoraFim = adicionarMinutos(hora, servico.duracao_minutos);

    const { data: bloqueios, error: bloqueioError } = await supabaseAdmin
      .from("bloqueios_agenda")
      .select("id")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", agendamentoAtual.profissional_id)
      .eq("data", data)
      .lt("hora_inicio", novaHoraFim)
      .gt("hora_fim", hora);

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
      .eq("data", data)
      .eq("status", "confirmado")
      .lt("hora_inicio", novaHoraFim)
      .gt("hora_fim", hora)
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
      .update({ data, hora_inicio: hora, hora_fim: novaHoraFim })
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