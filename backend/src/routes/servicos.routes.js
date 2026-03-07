// backend/src/routes/servicos.routes.js
import express from "express";
import {
  getServicos,
  getServicosAdmin,
  createServico,
  updateServico,
  deleteServico,
} from "../controllers/servicos.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

// ----------------------- Rotas públicas (cliente) -----------------------

// GET /servicos → lista apenas serviços ativos (para o fluxo de agendamento)
router.get("/", getServicos);

// ----------------------- Rotas admin (protegidas) -----------------------

const adminAccess = [authAdminMiddleware, requireRole(["admin_owner", "admin_staff"])];

// GET /servicos/admin → lista todos (ativos e inativos)
router.get("/admin", ...adminAccess, getServicosAdmin);

// POST /servicos → cria novo serviço
router.post("/", ...adminAccess, createServico);

// PUT /servicos/:id → atualiza serviço
router.put("/:id", ...adminAccess, updateServico);

// DELETE /servicos/:id → soft delete (ativo=false)
router.delete("/:id", ...adminAccess, deleteServico);

export default router;

