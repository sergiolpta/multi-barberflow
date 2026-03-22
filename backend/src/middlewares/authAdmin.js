// backend/src/middlewares/authAdmin.js
import jwt from "jsonwebtoken";
import { supabaseAdmin } from "../lib/supabase.js";
import { config } from "../config/index.js";
import { logger } from "../utils/logger.js";

const JWT_SECRET = config.supabase.jwtSecret;

/**
 * Valida o JWT de duas formas, em cascata:
 *
 * 1. Se SUPABASE_JWT_SECRET estiver configurado, verifica a assinatura HS256
 *    localmente (tokens emitidos pelo browser) e obtém o usuário via getUserById.
 *    Isso garante que o token não foi forjado.
 *
 * 2. Se a verificação HS256 falhar (token ES256, ou secret não configurado),
 *    delega para supabaseAdmin.auth.getUser(token), que valida tokens ES256
 *    diretamente na API do Supabase.
 *
 * Assim o middleware aceita ambos os formatos de token sem abrir mão da
 * verificação de assinatura.
 */
export async function authAdminMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        error: "NAO_AUTORIZADO",
        message: "Token de autenticação não informado.",
      });
    }

    let user = null;

    // Tentativa 1: verificação de assinatura HS256 com JWT secret local
    if (JWT_SECRET) {
      try {
        const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

        if (payload?.sub) {
          const { data, error } = await supabaseAdmin.auth.admin.getUserById(payload.sub);
          if (!error && data?.user) {
            user = data.user;
          }
        }
      } catch {
        // Token não é HS256 ou assinatura inválida — tenta ES256 abaixo
      }
    }

    // Tentativa 2: validação via API do Supabase (funciona para ES256)
    if (!user) {
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      return res.status(401).json({
        error: "TOKEN_INVALIDO",
        message: "Token inválido ou expirado.",
      });
    }

    req.user = user;
    req.auth = { userId: user.id, email: user.email ?? null };

    return next();
  } catch (e) {
    logger.error("authAdminMiddleware error", e);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Falha ao validar autenticação.",
    });
  }
}
