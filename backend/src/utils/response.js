// Utilitários para respostas HTTP padronizadas

/**
 * Envia resposta de erro no formato padrão da API.
 * @param {import('express').Response} res
 * @param {number} status - HTTP status code
 * @param {string} code - Código de erro em maiúsculas (ex: "VALIDACAO", "NAO_ENCONTRADO")
 * @param {string} message - Mensagem legível para o cliente
 * @param {any} [details] - Detalhes opcionais (ex: issues de validação)
 */
export function sendError(res, status, code, message, details) {
  const body = { error: code, message };
  if (details !== undefined) body.details = details;
  return res.status(status).json(body);
}
