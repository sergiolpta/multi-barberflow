// backend/src/middlewares/validate.js
const reDate = /^\d{4}-\d{2}-\d{2}$/;
const reTime = /^\d{2}:\d{2}(:\d{2})?$/;

function isUUID(v) {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function toTimeHHMM(hora) {
  if (!hora) return "";
  const s = String(hora).trim();
  // aceita "09:00" ou "09:00:00" e normaliza para "09:00"
  if (!reTime.test(s)) return "";
  return s.slice(0, 5);
}

export function validateCriarAgendamento(req, res, next) {
  const errors = [];
  const body = req.body || {};

  const profissional_id = body.profissional_id;
  const servico_id = body.servico_id;
  const data = body.data;
  const hora = toTimeHHMM(body.hora);

  const cliente_id = body.cliente_id;
  const cliente_nome = String(body.cliente_nome || "").trim();
  const cliente_whatsapp = String(body.cliente_whatsapp || "").trim();

  if (!isUUID(profissional_id)) errors.push("profissional_id inválido");
  if (!isUUID(servico_id)) errors.push("servico_id inválido");
  if (!data || !reDate.test(String(data))) errors.push("data inválida (YYYY-MM-DD)");
  if (!hora) errors.push("hora inválida (HH:MM ou HH:MM:SS)");

  // Regras cliente:
  // ou manda cliente_id, ou manda nome + whatsapp
  if (cliente_id) {
    if (!isUUID(cliente_id)) errors.push("cliente_id inválido");
  } else {
    if (!cliente_nome) errors.push("cliente_nome é obrigatório quando não há cliente_id");
    if (!cliente_whatsapp) errors.push("cliente_whatsapp é obrigatório quando não há cliente_id");
  }

  if (errors.length) {
    return res.status(400).json({ error: "VALIDACAO", errors });
  }

  // Normaliza hora pra não cair "09:00:00" vs "09:00"
  req.body.hora = hora;

  return next();
}

export function validateReagendar(req, res, next) {
  const errors = [];
  const { id } = req.params;
  const { data, hora } = req.body || {};

  if (!isUUID(id)) errors.push("id inválido");
  if (!data || !reDate.test(String(data))) errors.push("data inválida (YYYY-MM-DD)");

  const hhmm = toTimeHHMM(hora);
  if (!hhmm) errors.push("hora inválida (HH:MM ou HH:MM:SS)");

  if (errors.length) {
    return res.status(400).json({ error: "VALIDACAO", errors });
  }

  req.body.hora = hhmm;
  return next();
}

export function validateIdParam(req, res, next) {
  const { id } = req.params;
  if (!isUUID(id)) {
    return res.status(400).json({ error: "VALIDACAO", errors: ["id inválido"] });
  }
  return next();
}

