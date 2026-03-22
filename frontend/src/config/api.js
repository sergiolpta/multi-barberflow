// src/config/api.js

const hostname =
  typeof window !== "undefined" ? window.location.hostname : "";

const isProd = hostname === "agenda.nexushomelp.tec.br";
const isHml = hostname === "agenda-hml.nexushomelp.tec.br";

export const API_BASE_URL = isProd
  ? "https://api.nexushomelp.tec.br"
  : isHml
    ? "https://api-hml.nexushomelp.tec.br"
    : "http://localhost:3001";

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * apiFetch:
 * - injeta Authorization
 * - NÃO injeta mais x-barbearia-id
 * - parse seguro do body
 * - tratamento de 204 (retorna null)
 * - evita 304/ETag em endpoints sensíveis
 * - timeout de 15s por padrão (configurável via options.timeoutMs)
 */
export async function apiFetch(path, { accessToken, timeoutMs = DEFAULT_TIMEOUT_MS, ...options } = {}) {
  const headers = new Headers(options.headers || {});

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  if (!headers.get("Cache-Control")) headers.set("Cache-Control", "no-cache");
  if (!headers.get("Pragma")) headers.set("Pragma", "no-cache");

  const hasBody = options.body != null;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.get("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (fetchErr) {
    clearTimeout(timerId);
    if (fetchErr.name === "AbortError") {
      const err = new Error(`Tempo limite de ${timeoutMs / 1000}s esgotado. Verifique sua conexão.`);
      err.status = 408;
      throw err;
    }
    throw fetchErr;
  }
  clearTimeout(timerId);

  if (res.status === 204) {
    if (!res.ok) {
      const err = new Error("Resposta sem conteúdo (204), mas requisição falhou.");
      err.status = res.status;
      err.data = null;
      throw err;
    }
    return null;
  }

  let text = "";
  try {
    text = await res.text();
  } catch {
    text = "";
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && data.message) ||
      (typeof data === "string" && data) ||
      `Erro HTTP ${res.status}`;

    const err = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}