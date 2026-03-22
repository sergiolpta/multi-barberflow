// Funções utilitárias de formatação compartilhadas

/**
 * Formata um valor numérico como moeda BRL (R$).
 * @param {number|string|null} v
 * @returns {string}
 */
export function formatBRL(v) {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Converte data ISO (YYYY-MM-DD) para formato brasileiro (DD/MM/YYYY).
 * Retorna string vazia se inválida.
 * @param {string} iso
 * @returns {string}
 */
export function fmtBRDate(iso) {
  const s = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Valida e retorna a data ISO (YYYY-MM-DD), ou string vazia se inválida.
 * @param {string} valor
 * @returns {string}
 */
export function normalizarDataISO(valor) {
  const s = String(valor || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "";
  return s;
}

/**
 * Normaliza hora para formato HH:MM.
 * Aceita HH:MM ou HH:MM:SS. Retorna string vazia se inválida.
 * @param {string} valor
 * @returns {string}
 */
export function normalizarHoraHHMM(valor) {
  const s = String(valor || "").trim();
  if (!s) return "";
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s.slice(0, 5);
  return "";
}

/**
 * Converte valor para número ou null se inválido/vazio.
 * @param {any} v
 * @returns {number|null}
 */
export function toNumberOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
