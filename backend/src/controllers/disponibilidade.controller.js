// backend/src/controllers/disponibilidade.controller.js
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

// Helpers internos

function timeStringToMinutes(timeStr) {
  // aceita "HH:MM" ou "HH:MM:SS"
  const [h, m] = String(timeStr || "").split(":").map(Number);
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

// janela padrão da barbearia (pode virar config depois)
const JANELA_INICIO_MIN = 9 * 60; // 09:00
const JANELA_FIM_MIN = 21 * 60; // 21:00

// GET /disponibilidade?profissional_id=...&servico_id=...&data=YYYY-MM-DD
export async function getDisponibilidade(req, res) {
  try {
    const barbeariaId = getBarbeariaId(req);
    const { profissional_id, servico_id, data } = req.query || {};

    if (!barbeariaId) {
      return respondBarbeariaAusente(res);
    }

    // 1) validação básica
    if (!profissional_id || !servico_id || !data) {
      return res.status(400).json({
        error: "PARAMETROS_OBRIGATORIOS",
        message: "profissional_id, servico_id e data são obrigatórios",
      });
    }

    // validação simples da data e cálculo do dia da semana
    const dataObj = new Date(`${data}T00:00:00`);
    if (Number.isNaN(dataObj.getTime())) {
      return res.status(400).json({
        error: "DATA_INVALIDA",
        message: "Formato de data inválido. Use YYYY-MM-DD.",
      });
    }
    const diaSemana = dataObj.getDay(); // 0 (domingo) ... 6 (sábado)

    // 3) serviço
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

    // 4) profissional
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

    // 5) buscar agendamentos existentes para esse dia + profissional
    const { data: agendamentos, error: agError } = await supabase
      .from("agendamentos")
      .select("hora_inicio, hora_fim, status")
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissional_id)
      .eq("data", data);

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
      }));

    // 5.1) buscar pacotes ativos para este profissional e dia da semana
    const { data: pacotes, error: pacotesError } = await supabase
      .from("pacotes")
      .select(
        "hora_inicio, duracao_minutos, vigencia_inicio, vigencia_fim, dia_semana, ativo"
      )
      .eq("barbearia_id", barbeariaId)
      .eq("profissional_id", profissional_id)
      .eq("ativo", true)
      .eq("dia_semana", diaSemana);

    if (pacotesError) {
      console.error("Erro Supabase getDisponibilidade (pacotes):", pacotesError);
      return res.status(500).json({
        error: "ERRO_SUPABASE",
        message: "Erro ao buscar pacotes recorrentes",
      });
    }

    const intervalosPacotes = (pacotes || [])
      .filter((p) => {
        const vigInicio = new Date(`${p.vigencia_inicio}T00:00:00`);
        if (Number.isNaN(vigInicio.getTime())) return false;

        let vigFimOk = true;
        if (p.vigencia_fim) {
          const vigFim = new Date(`${p.vigencia_fim}T00:00:00`);
          if (Number.isNaN(vigFim.getTime())) return false;
          vigFimOk = vigFim.getTime() >= dataObj.getTime();
        }

        const vigInicioOk = vigInicio.getTime() <= dataObj.getTime();

        return vigInicioOk && vigFimOk;
      })
      .map((p) => {
        const inicio = timeStringToMinutes(p.hora_inicio);
        const fim = inicio + Number(p.duracao_minutos || 0);
        return { inicio, fim };
      });

    const intervalosOcupados = [...intervalosAgendamentos, ...intervalosPacotes];

    // 6) gerar slots possíveis na janela [09:00, 21:00]
    //    grade base em 30 em 30 minutos
    const SLOT_GRANULARITY_MIN = 30;
    const horariosDisponiveis = [];

    for (
      let inicioSlot = JANELA_INICIO_MIN;
      inicioSlot + duracaoMinutos <= JANELA_FIM_MIN;
      inicioSlot += SLOT_GRANULARITY_MIN
    ) {
      const fimSlot = inicioSlot + duracaoMinutos;

      const conflita = intervalosOcupados.some((intervalo) =>
        intervalsOverlap(inicioSlot, fimSlot, intervalo.inicio, intervalo.fim)
      );

      if (!conflita) {
        horariosDisponiveis.push(minutesToTimeString(inicioSlot));
      }
    }

    return res.status(200).json({
      data,
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