// backend/src/middlewares/authAdmin.js
import { supabasePublic } from "../lib/supabase.js";
import { logger } from "../utils/logger.js";

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

    // ✅ Token deve ser validado com client PUBLIC (publishable/anon)
    const { data, error } = await supabasePublic.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(401).json({
        error: "TOKEN_INVALIDO",
        message: "Token inválido ou expirado.",
      });
    }

    req.user = data.user;
    req.auth = { userId: data.user.id, email: data.user.email ?? null };

    return next();
  } catch (e) {
    logger.error("authAdminMiddleware error", e);
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: "Falha ao validar autenticação.",
    });
  }
}

