// src/hooks/useAgendamentoFlow.js
import { useEffect, useState, useCallback } from "react";
import { apiFetch, BARBEARIA_ID } from "../config/api";

export function useAgendamentoFlow() {
  // etapa atual (1 a 5)
  const [step, setStep] = useState(1);

  // dados carregados da API
  const [profissionais, setProfissionais] = useState([]);
  const [servicos, setServicos] = useState([]);

  // seleções do usuário
  const [profissionalSelecionado, setProfissionalSelecionado] = useState(null);
  const [servicoSelecionado, setServicoSelecionado] = useState(null);
  const [dataSelecionada, setDataSelecionada] = useState("");
  const [horariosDisponiveis, setHorariosDisponiveis] = useState([]);
  const [horarioSelecionado, setHorarioSelecionado] = useState("");

  // dados do cliente
  const [clienteNome, setClienteNome] = useState("");
  const [clienteWhatsapp, setClienteWhatsapp] = useState("");
  const [clienteNascimento, setClienteNascimento] = useState("");

  // status
  const [loadingProfissionais, setLoadingProfissionais] = useState(false);
  const [loadingServicos, setLoadingServicos] = useState(false);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [error, setError] = useState("");
  const [agendando, setAgendando] = useState(false);
  const [agendamentoConfirmado, setAgendamentoConfirmado] = useState(null);

  function getHojeISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function timeToMinutes(horaStr) {
    if (!horaStr) return 0;
    const [h, m] = horaStr.split(":");
    const hh = parseInt(h ?? "0", 10);
    const mm = parseInt(m ?? "0", 10);
    return hh * 60 + mm;
  }

  function normalizarWhatsapp(v) {
    return String(v || "").replace(/\D/g, "");
  }

  function isYYYYMMDD(s) {
    return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  }

  // 1) Carregar profissionais e serviços ao montar
  useEffect(() => {
    async function loadInitialData() {
      setError("");

      if (!BARBEARIA_ID) {
        setError("BARBEARIA_ID não configurado no frontend (VITE_BARBEARIA_ID).");
        return;
      }

      try {
        setLoadingProfissionais(true);
        const profData = await apiFetch(`/profissionais`, { method: "GET" });
        setProfissionais(Array.isArray(profData) ? profData : []);
      } catch (err) {
        console.error(err);
        setError(err?.message || "Erro ao carregar profissionais.");
      } finally {
        setLoadingProfissionais(false);
      }

      try {
        setLoadingServicos(true);
        const servData = await apiFetch(`/servicos`, { method: "GET" });
        setServicos(Array.isArray(servData) ? servData : []);
      } catch (err) {
        console.error(err);
        setError((prev) => prev || err?.message || "Erro ao carregar serviços.");
      } finally {
        setLoadingServicos(false);
      }
    }

    loadInitialData();
  }, []);

  // 2) Buscar horários
  async function buscarHorarios() {
    if (!profissionalSelecionado || !servicoSelecionado || !dataSelecionada) return;

    try {
      setLoadingHorarios(true);
      setError("");
      setHorariosDisponiveis([]);
      setHorarioSelecionado("");

      const params = new URLSearchParams({
        profissional_id: profissionalSelecionado.id,
        servico_id: servicoSelecionado.id,
        data: dataSelecionada,
      });

      const data = await apiFetch(`/disponibilidade?${params.toString()}`, {
        method: "GET",
      });

      let horarios =
        Array.isArray(data?.horarios_disponiveis) && data.horarios_disponiveis.length
          ? data.horarios_disponiveis
          : [];

      // se for hoje, filtra horários passados
      const hojeISO = getHojeISO();
      if (dataSelecionada === hojeISO) {
        const agora = new Date();
        const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
        horarios = horarios.filter((h) => timeToMinutes(h) >= minutosAgora);
      }

      setHorariosDisponiveis(horarios);
    } catch (err) {
      console.error(err);
      setError(err?.message || "Erro ao carregar horários.");
    } finally {
      setLoadingHorarios(false);
    }
  }

  function nextStep() {
    setStep((prev) => Math.min(prev + 1, 5));
  }

  function prevStep() {
    setStep((prev) => Math.max(prev - 1, 1));
  }

  const resetFlow = useCallback(() => {
    setStep(1);
    setProfissionalSelecionado(null);
    setServicoSelecionado(null);
    setDataSelecionada("");
    setHorariosDisponiveis([]);
    setHorarioSelecionado("");
    setClienteNome("");
    setClienteWhatsapp("");
    setClienteNascimento("");
    setAgendamentoConfirmado(null);
    setError("");
  }, []);

  // 3) Criar agendamento (PÚBLICO)
  // ✅ AGORA RETORNA o objeto de confirmação (para o App poder resetar imediatamente)
  async function confirmarAgendamento() {
    try {
      setAgendando(true);
      setError("");

      if (!BARBEARIA_ID) {
        throw new Error("BARBEARIA_ID não configurado no frontend (VITE_BARBEARIA_ID).");
      }

      if (
        !profissionalSelecionado ||
        !servicoSelecionado ||
        !dataSelecionada ||
        !horarioSelecionado ||
        !String(clienteNome || "").trim() ||
        !String(clienteWhatsapp || "").trim()
      ) {
        throw new Error("Preencha todos os dados antes de confirmar o agendamento.");
      }

      const whatsappNorm = normalizarWhatsapp(clienteWhatsapp);
      if (whatsappNorm.length < 10) {
        throw new Error("WhatsApp inválido. Informe DDD + número.");
      }

      const nascimentoEnvio =
        String(clienteNascimento || "").trim() !== "" ? String(clienteNascimento).trim() : null;

      if (nascimentoEnvio && !isYYYYMMDD(nascimentoEnvio)) {
        throw new Error("Data de nascimento inválida. Use AAAA-MM-DD.");
      }

      // regra: não agendar no passado
      const hojeISO = getHojeISO();

      if (dataSelecionada < hojeISO) {
        throw new Error("Não é possível agendar em datas que já passaram.");
      }

      if (dataSelecionada === hojeISO) {
        const agora = new Date();
        const minutosAgora = agora.getHours() * 60 + agora.getMinutes();
        const minutosHora = timeToMinutes(horarioSelecionado);
        if (minutosHora < minutosAgora) {
          throw new Error("Não é possível agendar para um horário que já passou.");
        }
      }

      const payload = {
        cliente_nome: String(clienteNome).trim(),
        cliente_whatsapp: whatsappNorm,
        profissional_id: profissionalSelecionado.id,
        servico_id: servicoSelecionado.id,
        data: dataSelecionada,
        hora: horarioSelecionado,
      };

      if (nascimentoEnvio) {
        payload.cliente_nascimento = nascimentoEnvio;
      }

      const agendamento = await apiFetch(`/agendamentos`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const confirmacao = {
        ...agendamento,
        cliente_nome: String(clienteNome).trim(),
        cliente_whatsapp: whatsappNorm,
        profissional_nome: profissionalSelecionado.nome,
        servico_nome: servicoSelecionado.nome,
      };

      setAgendamentoConfirmado(confirmacao);
      setStep(5);

      // ✅ retorno pro App usar e resetar sem perder a mensagem
      return confirmacao;
    } catch (err) {
      console.error(err);
      setError(err?.message || "Erro ao confirmar agendamento.");
      return null;
    } finally {
      setAgendando(false);
    }
  }

  return {
    // etapas
    step,
    nextStep,
    prevStep,
    resetFlow,

    // dados
    profissionais,
    servicos,

    // seleções
    profissionalSelecionado,
    setProfissionalSelecionado,
    servicoSelecionado,
    setServicoSelecionado,
    dataSelecionada,
    setDataSelecionada,
    horariosDisponiveis,
    horarioSelecionado,
    setHorarioSelecionado,

    // cliente
    clienteNome,
    setClienteNome,
    clienteWhatsapp,
    setClienteWhatsapp,
    clienteNascimento,
    setClienteNascimento,

    // status
    loadingProfissionais,
    loadingServicos,
    loadingHorarios,
    error,
    agendando,
    agendamentoConfirmado,

    // ações
    buscarHorarios,
    confirmarAgendamento,
  };
}
