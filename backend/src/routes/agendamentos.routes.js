import { Router } from "express";
import {
  listarAgendamentos,
  criarAgendamento,
  reagendarAgendamento,
  cancelarAgendamento,
  concluirAgendamento,
  adicionarExtrasAgendamento,
  cancelarOcorrenciaPacote,
  remarcarOcorrenciaPacote,
} from "../controllers/agendamentos.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";
import { validate } from "../validators/validate.js";
import {
  criarAgendamentoSchema,
  reagendarSchema,
  cancelarSchema,
  concluirSchema,
  listarAgendamentosSchema,
  adicionarExtrasAgendamentoSchema,
} from "../validators/agendamentos.schemas.js";

const router = Router();

// Admin: ler agenda (inclui barber)
const adminReadAccess = [
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
];

// Admin: gerir (owner/staff)
const adminWriteAccess = [
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff"]),
];

// ===========================
// ✅ ROTAS ADMIN (PROTEGIDAS)
// ===========================

// LISTAR agendamentos (admin)
router.get(
  "/",
  ...adminReadAccess,
  validate(listarAgendamentosSchema),
  listarAgendamentos
);

// CRIAR agendamento
router.post(
  "/",
  ...adminWriteAccess,
  validate(criarAgendamentoSchema),
  criarAgendamento
);

// REAGENDAR agendamento normal (admin)
router.put(
  "/:id/reagendar",
  ...adminWriteAccess,
  validate(reagendarSchema),
  reagendarAgendamento
);

// CANCELAR agendamento normal (admin)
router.post(
  "/:id/cancelar",
  ...adminWriteAccess,
  validate(cancelarSchema),
  cancelarAgendamento
);

// CONCLUIR agendamento normal (admin)
router.patch(
  "/:id/concluir",
  ...adminWriteAccess,
  validate(concluirSchema),
  concluirAgendamento
);

// EXTRAS em agendamento normal (admin)
router.post(
  "/:id/extras",
  ...adminWriteAccess,
  validate(adicionarExtrasAgendamentoSchema),
  adicionarExtrasAgendamento
);

// ===========================
// ✅ OCORRÊNCIAS DE PACOTE
// ===========================

// Cancelar só a ocorrência daquele dia
router.post(
  "/pacotes/ocorrencias/cancelar",
  ...adminWriteAccess,
  cancelarOcorrenciaPacote
);

// Remarcar só a ocorrência daquele dia
router.post(
  "/pacotes/ocorrencias/remarcar",
  ...adminWriteAccess,
  remarcarOcorrenciaPacote
);

export default router;