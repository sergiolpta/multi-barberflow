// backend/src/routes/pacotes.routes.js
import express from "express";
import {
  listarPacotes,
  criarPacote,
  atualizarPacote,
  desativarPacote,

  // 👇 NOVOS
  listarPagamentosPacote,
  registrarPagamentoPacote,
} from "../controllers/pacotes.controller.js";

import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

// ✅ Quem pode VER (Admin "comum")
const adminReadAccess = [
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
];

// ✅ Quem pode ALTERAR (Admin "gestor")
const adminWriteAccess = [
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff"]),
];

// ------------------- Pacotes (já existentes) -------------------

// GET pode ser mais permissivo
router.get("/", ...adminReadAccess, listarPacotes);

// Escritas ficam restritas
router.post("/", ...adminWriteAccess, criarPacote);
router.put("/:id", ...adminWriteAccess, atualizarPacote);
router.delete("/:id", ...adminWriteAccess, desativarPacote);

// ------------------- Pagamentos do Pacote (NOVO) -------------------

// listar pagamentos do pacote (admin pode ver)
router.get("/:id/pagamentos", ...adminReadAccess, listarPagamentosPacote);

// registrar pagamento mensal (somente gestor)
router.post("/:id/pagamentos", ...adminWriteAccess, registrarPagamentoPacote);

export default router;

