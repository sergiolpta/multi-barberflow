// src/config/api.js

const isProd =
  typeof window !== "undefined" &&
  window.location.hostname === "agenda.nexushomelp.tec.br";

export const API_BASE_URL = isProd
  ? "https://api.nexushomelp.tec.br"
  : "http://localhost:3001";

export const BARBEARIA_ID =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_BARBEARIA_ID) ||
  "";

/**
 * apiFetch:
 * - injeta Authorization
 * - injeta x-barbearia-id (a não ser que skipBarbeariaId=true)
 * - parse seguro do body
 * - tratamento de 204 (retorna null)
 * - ✅ evita 304/ETag em endpoints sensíveis (cache: no-store + headers no-cache)
 *
 * Observação: para rotas que NÃO dependem de barbearia (ex.: /me),
 * use skipBarbeariaId: true.
 */
export async function apiFetch(
  path,
  {
    accessToken,
    barbeariaId,
    skipBarbeariaId = false,
    ...options
  } = {}
) {
  const headers = new Headers(options.headers || {});

  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  if (!skipBarbeariaId) {
    const bid = barbeariaId || BARBEARIA_ID;
    if (bid) headers.set("x-barbearia-id", bid);
  }

  // ✅ evita 304/ETag e cache agressivo do navegador/CDN
  if (!headers.get("Cache-Control")) headers.set("Cache-Control", "no-cache");
  if (!headers.get("Pragma")) headers.set("Pragma", "no-cache");

  // define content-type automaticamente quando tem body (sem forçar em FormData)
  const hasBody = options.body != null;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (hasBody && !isFormData && !headers.get("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: "no-store", // ✅ impede reuso/ETag do browser nessa request
  });

  // 204 No Content
  if (res.status === 204) {
    if (!res.ok) {
      const err = new Error("Resposta sem conteúdo (204), mas requisição falhou.");
      err.status = res.status;
      err.data = null;
      throw err;
    }
    return null;
  }

  // Lê como texto e tenta JSON
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

