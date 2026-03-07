// src/routes/relatoriosEstatisticos.routes.js
import express from "express";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  financeiroDiario,
  horariosPico,
} from "../controllers/relatoriosEstatisticos.controller.js";

const router = express.Router();

// ✅ Rotas financeiras/estatísticas: SOMENTE admin_owner
router.get(
  "/financeiro-diario",
  authAdminMiddleware,
  requireRole(["admin_owner"]),
  financeiroDiario
);

router.get(
  "/horarios-pico",
  authAdminMiddleware,
  requireRole(["admin_owner"]),
  horariosPico
);

export default router;


