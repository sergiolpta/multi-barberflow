// backend/src/middlewares/requireRole.js
import { supabaseAdmin } from "../lib/supabase.js";

export function requireRole(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id || req.auth?.userId || null;

      if (!userId) {
        return res.status(401).json({
          error: "NAO_AUTENTICADO",
          message: "Usuário não autenticado.",
        });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({
          error: "CONFIG_SUPABASE_FALTANDO",
          message:
            "Supabase Admin client não configurado (verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY).",
        });
      }

      const { data: profile, error: profileErr } = await supabaseAdmin
        .from("admin_profiles")
        .select("barbearia_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileErr) {
        return res.status(500).json({
          error: "ERRO_PROFILE",
          message: profileErr.message,
        });
      }

      if (!profile?.barbearia_id) {
        return res.status(403).json({
          error: "SEM_BARBEARIA",
          message: "Usuário sem vínculo com barbearia.",
        });
      }

      const barbeariaId = profile.barbearia_id;

      let role = null;

      if (allowedRoles && allowedRoles.length > 0) {
        const { data: row, error: findErr } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("barbearia_id", barbeariaId)
          .maybeSingle();

        if (findErr) {
          return res.status(500).json({
            error: "ERRO_RBAC",
            message: findErr.message,
          });
        }

        role = row?.role || null;

        if (!role) {
          return res.status(403).json({
            error: "SEM_PERMISSAO",
            message: "Usuário não possui permissão nesta barbearia.",
          });
        }

        if (!allowedRoles.includes(role)) {
          return res.status(403).json({
            error: "ROLE_NAO_PERMITIDA",
            message: `Acesso negado para role '${role}'.`,
          });
        }
      } else {
        const { data: row, error: findErr } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("barbearia_id", barbeariaId)
          .maybeSingle();

        if (!findErr) {
          role = row?.role || null;
        }
      }

      // Fonte principal padronizada
      req.user = {
        ...req.user,
        id: req.user?.id || userId,
        email: req.user?.email || req.auth?.email || null,
        barbearia_id: barbeariaId,
        role,
      };

      // Compatibilidade temporária com código legado já existente
      req.barbeariaId = barbeariaId;
      req.role = role;

      return next();
    } catch (err) {
      return res.status(500).json({
        error: "ERRO_RBAC",
        message: String(err?.message || err),
      });
    }
  };
}