// backend/src/routes/profissionais.routes.js
import express from "express";
import {
  getProfissionais,
  getProfissionaisAdmin,
  createProfissional,
  updateProfissional,
  deleteProfissional,
  getComissoesServicoCtrl,
  upsertComissoesServicoCtrl,
} from "../controllers/profissionais.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

// ----------------------- Rotas públicas (cliente) -----------------------
// GET /profissionais → lista apenas profissionais ativos (para o fluxo de agendamento)
router.get("/", getProfissionais);

// ----------------------- Rotas admin (protegidas) -----------------------

// Owner OU Staff
const staffOrOwnerAccess = [
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff"]),
];

// Somente Owner
const ownerAccess = [
  authAdminMiddleware,
  requireRole(["admin_owner"]),
];

// ----------------------- Profissionais -----------------------

// GET /profissionais/admin → lista todos (ativos e inativos)
router.get("/admin", ...staffOrOwnerAccess, getProfissionaisAdmin);

// POST /profissionais → cria novo profissional
router.post("/", ...staffOrOwnerAccess, createProfissional);

// PUT /profissionais/:id → atualiza profissional
router.put("/:id", ...staffOrOwnerAccess, updateProfissional);

// DELETE /profissionais/:id → soft delete (ativo=false)
router.delete("/:id", ...staffOrOwnerAccess, deleteProfissional);

// ----------------------- Comissões por serviço (owner-only) -----------------------

// GET  /profissionais/:id/comissoes-servico
router.get("/:id/comissoes-servico", ...ownerAccess, getComissoesServicoCtrl);

// PUT /profissionais/:id/comissoes-servico
router.put("/:id/comissoes-servico", ...ownerAccess, upsertComissoesServicoCtrl);

export default router;