import { supabase } from "../lib/supabase.js";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const ADMIN_RETRO_TOLERANCE_MINUTES = 30;

// janela padrão da barbearia (pode virar config depois)
const JANELA_INICIO_MIN = 9 * 60; // 09:00
const JANELA_FIM_MIN = 21 * 60; // 21:00
const SLOT_GRANULARITY_MIN = 30;

function getBarbeariaId(req) {
  return String(req?.user?.barbearia_id || "").trim() || null;
}

function respondBarbeariaAusente(res) {
  return res.status(401).json({
    error: "USUARIO_SEM_BARBEARIA",
    message: "Usuário autenticado sem barbearia vinculada.",
  });
}

function parseDateOnly(value) {
  const s = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function normalizeHora(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  return null;
}

function timeStringToMinutes(timeStr) {
  const hora = normalizeHora(timeStr);
  if (!hora) return NaN;
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return `${hh}:${mm}`;
}

function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function getNowInBusinessTimeZone() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}:${map.second}`,
  };
}

function isSameISODate(a, b) {
  return String(a || "").trim() === String(b || "").trim();
}

function minutesFromBusinessNow(nowBiz) {
  const [h, m] = String(nowBiz.time || "00:00:00")
    .slice(0, 5)
    .split(":")
    .map(Number);

  return h * 60 + m;
}

function isPacoteVigenteNaData(pacote, dataISO) {
  if (!pacote?.vigencia_inicio) return false;
  if (dataISO < pacote.vigencia_inicio) return false;
  if (pacote.vigencia_fim && dataISO > pacote.vigencia_fim) return false;
  return true;
}

// GET /disponibilidade?profissional_id=...&servico_id=...&data=YYYY-MM-DD
export async function getDisponibilidade(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { profissional_id, servico_id, data } = req.query || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    if (!profissional_id || !servico_id || !data) {
      return res.status(400).json({
        error: "PARAMETROS_OBRIGATORIOS",
        message: "profissional_id, servico_id e data são obrigatórios",
      });
    }

    const dataISO = parseDateOnly(data);
    if (!dataISO) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido. Use YYYY-MM-DD.",
      });
    }

    const dataObj = new Date(`${dataISO}T00:00:00`);
    if (Number.isNaN(dataObj.getTime())) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido. Use YYYY-MM-DD.",
      });
    }

    const agoraBiz = getNowInBusinessTimeZone();
    const hojeBiz = agoraBiz.date;

    if (dataISO < hojeBiz) {
      return res.status(400).json({
        error: "DATA_PASSADA",
        message: "Não é permitido consultar disponibilidade para datas que já passaram.",
      });
    }

    const diaSemana = dataObj.getDay();

    // serviço
    const { data: servico, error: servicoError } = await supabase
      .from("servicos")
      .select("id, nome, duracao_minutos, ativo")
      .eq("id", servico_id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (servicoError) {
      console.error("Erro Supabase getDisponibilidade (servico):", servicoError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar dados do serviço",
      });
    }

    if (!servico) {
      return res.status(404).json({
        error: "SERVICO_NAO_ENCONTRADO",
        message: "Serviço não encontrado para esta barbearia",
      });
    }

    if (servico.ativo === false) {
      return res.status(400).json({
        error: "SERVICO_INATIVO",
        message: "Este serviço está inativo",
      });
    }

    const duracaoMinutos = Number(servico.duracao_minutos);
    if (!Number.isFinite(duracaoMinutos) || duracaoMinutos <= 0) {
      return res.status(400).json({
        error: "SERVICO_SEM_DURACAO",
        message: "Serviço não possui duração válida configurada",
      });
    }

    // profissional
    const { data: profissional, error: profissionalError } = await supabase
      .from("profissionais")
      .select("id, nome, ativo")
      .eq("id", profissional_id)
      .eq("barbearia_id", barbeariaId)
      .single();

    if (profissionalError) {
      console.error("Erro Supabase getDisponibilidade (profissional):", profissionalError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar dados do profissional",
      });
    }

    if (!profissional) {
      return res.status(404).json({
        error: "PROFISSIONAL_NAO_ENCONTRADO",
        message: "Profissional não encontrado para esta barbearia",
      });
    }

    if (profissional.ativo === false) {
      return res.status(400).json({
        error: "PROFISSIONAL_INATIVO",
        message: "Profissional está inativo",
      });
    }

    // agendamentos existentes
    const { data: agendamentos, error: agError } = await supabase
      .from("agendamentos")
      .select("id, hora_inicio, hora_fim, status")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissional_id)
      .eq("data", dataISO);

    if (agError) {
      console.error("Erro Supabase getDisponibilidade (agendamentos):", agError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar agendamentos existentes",
      });
    }

    const intervalosAgendamentos = (agendamentos || [])
      .filter((a) => a.status !== "cancelado")
      .map((a) => ({
        inicio: timeStringToMinutes(a.hora_inicio),
        fim: timeStringToMinutes(a.hora_fim),
      }))
      .filter((a) => Number.isFinite(a.inicio) && Number.isFinite(a.fim));

    // horários recorrentes de pacote
    const { data: pacoteHorariosRaw, error: pacotesError } = await supabase
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
      .eq("profissional_id", profissional_id)
      .eq("ativo", true)
      .eq("dia_semana", diaSemana);

    if (pacotesError) {
      console.error("Erro Supabase getDisponibilidade (pacote_horarios):", pacotesError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar pacotes recorrentes",
      });
    }

    const pacoteHorariosVigentes = (pacoteHorariosRaw || []).filter((ph) => {
      if (ph.ativo !== true) return false;
      if (!ph.pacote || ph.pacote.ativo !== true) return false;
      return isPacoteVigenteNaData(ph.pacote, dataISO);
    });

    // exceções do dia
    const { data: excecoesRaw, error: excecoesError } = await supabase
      .from("pacote_excecoes")
      .select(`
        id,
        pacote_id,
        pacote_horario_id,
        data_original,
        acao,
        nova_data,
        nova_hora_inicio,
        nova_duracao_minutos
      `)
      .eq("barbearia_id", barbeariaId)
      .or(`data_original.eq.${dataISO},nova_data.eq.${dataISO}`);

    if (excecoesError) {
      console.error("Erro Supabase getDisponibilidade (pacote_excecoes):", excecoesError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar exceções de pacote",
      });
    }

    const excecoes = excecoesRaw || [];

    const excecaoPorOcorrenciaOriginal = new Map();
    for (const ex of excecoes) {
      const key = `${ex.pacote_horario_id}|${ex.data_original}`;
      excecaoPorOcorrenciaOriginal.set(key, ex);
    }

    // pacotes base do dia, excluindo os cancelados/remarcados
    const intervalosPacotesBase = pacoteHorariosVigentes
      .filter((ph) => {
        const key = `${ph.id}|${dataISO}`;
        return !excecaoPorOcorrenciaOriginal.has(key);
      })
      .map((ph) => {
        const inicio = timeStringToMinutes(ph.hora_inicio);
        const fim = inicio + Number(ph.duracao_minutos || 0);
        return {
          inicio,
          fim,
          profissional_id: String(ph.profissional_id || ""),
        };
      })
      .filter(
        (a) =>
          Number.isFinite(a.inicio) &&
          Number.isFinite(a.fim) &&
          a.profissional_id === String(profissional_id)
      );

    // pacotes remarcados para este dia
    const remarcadosDoDia = excecoes.filter(
      (ex) => ex.acao === "remarcado" && ex.nova_data === dataISO
    );

    let intervalosPacotesRemarcados = [];
    if (remarcadosDoDia.length > 0) {
      const horarioIds = Array.from(
        new Set(remarcadosDoDia.map((ex) => ex.pacote_horario_id).filter(Boolean))
      );

      const { data: horariosRemarcados, error: horariosRemarcadosErr } = await supabase
        .from("pacote_horarios")
        .select(`
          id,
          profissional_id,
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
        .in("id", horarioIds);

      if (horariosRemarcadosErr) {
        console.error(
          "Erro Supabase getDisponibilidade (pacote_horarios remarcados):",
          horariosRemarcadosErr
        );
        return res.status(500).json({
          error: "ERRO_SUPABASE",
          message: "Erro ao buscar horários remarcados de pacote",
        });
      }

      const horarioMap = new Map((horariosRemarcados || []).map((h) => [String(h.id), h]));

      intervalosPacotesRemarcados = remarcadosDoDia
        .map((ex) => {
          const ph = horarioMap.get(String(ex.pacote_horario_id));
          if (!ph) return null;
          if (String(ph.profissional_id || "") !== String(profissional_id)) return null;

          const inicio = timeStringToMinutes(ex.nova_hora_inicio);
          const dur = Number(ex.nova_duracao_minutos || ph.duracao_minutos || 0);
          const fim = inicio + dur;

          return { inicio, fim };
        })
        .filter((a) => a && Number.isFinite(a.inicio) && Number.isFinite(a.fim));
    }

    const intervalosOcupados = [
      ...intervalosAgendamentos,
      ...intervalosPacotesBase.map(({ inicio, fim }) => ({ inicio, fim })),
      ...intervalosPacotesRemarcados,
    ];

    const horariosDisponiveis = [];
    const mesmaDataHoje = isSameISODate(dataISO, hojeBiz);
    const agoraMinBiz = minutesFromBusinessNow(agoraBiz);

    for (
      let inicioSlot = JANELA_INICIO_MIN;
      inicioSlot + duracaoMinutos <= JANELA_FIM_MIN;
      inicioSlot += SLOT_GRANULARITY_MIN
    ) {
      const fimSlot = inicioSlot + duracaoMinutos;

      if (mesmaDataHoje) {
        const limiteRetroativo = agoraMinBiz - ADMIN_RETRO_TOLERANCE_MINUTES;
        if (inicioSlot < limiteRetroativo) {
          continue;
        }
      }

      const conflita = intervalosOcupados.some((intervalo) =>
        intervalsOverlap(inicioSlot, fimSlot, intervalo.inicio, intervalo.fim)
      );

      if (!conflita) {
        horariosDisponiveis.push(minutesToTimeString(inicioSlot));
      }
    }

    return res.status(200).json({
      data: dataISO,
      profissional_id,
      servico_id,
      duracao_minutos: duracaoMinutos,
      profissional_nome: profissional.nome,
      servico_nome: servico.nome,
      horarios_disponiveis: horariosDisponiveis,
    });
  } catch (err) {
    console.error("Erro inesperado getDisponibilidade:", err);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Erro interno ao consultar disponibilidade",
    });
  }
}