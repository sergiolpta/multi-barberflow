// src/routes/relatorios.routes.js
import { Router } from "express";
import { getRelatorioFinanceiro } from "../controllers/relatorios.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

// financeiro: SOMENTE admin_owner
router.get(
  "/financeiro",
  authAdminMiddleware,
  requireRole(["admin_owner"]),
  getRelatorioFinanceiro
);

export default router;

