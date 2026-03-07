import { Router } from "express";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { supabaseAdmin } from "../lib/supabase.js";

const router = Router();

/**
 * GET /me
 */
router.get("/", authAdminMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id || req.auth?.userId || null;
    const email = req.user?.email || req.auth?.email || null;

    if (!userId) {
      return res.status(401).json({
        error: "NAO_AUTENTICADO",
        message: "Usuário não autenticado.",
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        error: "CONFIG_SUPABASE_FALTANDO",
        message: "Supabase Admin client não configurado.",
      });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("admin_profiles")
      .select("barbearia_id, display_name, profissional_id")
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

    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("barbearia_id", barbeariaId)
      .maybeSingle();

    if (roleErr) {
      return res.status(500).json({
        error: "ERRO_RBAC",
        message: roleErr.message,
      });
    }

    if (!roleRow?.role) {
      return res.status(403).json({
        error: "SEM_PERMISSAO",
        message: "Usuário sem papel definido para esta barbearia.",
      });
    }

    return res.status(200).json({
      userId,
      email,
      barbeariaId,
      role: roleRow.role,
      displayName: profile.display_name || null,
      profissionalId: profile.profissional_id || null,
    });
  } catch (err) {
    return res.status(500).json({
      error: "ERRO_INTERNO",
      message: String(err?.message || err),
    });
  }
});

export default router;
