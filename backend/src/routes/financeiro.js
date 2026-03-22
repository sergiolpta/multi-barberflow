// backend/src/routes/financeiro.js
import express from "express";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

import {
  obterPreviaPeriodoCtrl,
  criarFechamentoCtrl,
  obterResumoFechamentoCtrl,
  listarProfissionaisDoFechamentoCtrl,
  gerarSnapshotFechamentoCtrl,
  concluirFechamentoCtrl,

  // ✅ ADIANTAMENTOS
  criarAdiantamentoCtrl,
  listarAdiantamentosCtrl,
  deletarAdiantamentoCtrl,

  // ✅ DESPESAS
  criarDespesaCtrl,
  listarDespesasCtrl,
  deletarDespesaCtrl,

  // ✅ NOVO: listar fechamentos / buscar por data
  listarFechamentosCtrl,
  obterFechamentoPorDataCtrl,

  // ✅ PRÉVIA DETALHADA POR PROFISSIONAL
  obterDetalhesPreviaProfissionalCtrl,
} from "../controllers/financeiro.controller.js";

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.use(authAdminMiddleware);

// ✅ Prévia — owner-only
router.get("/previa", requireRole(["admin_owner"]), obterPreviaPeriodoCtrl);
router.get("/previa/profissional", requireRole(["admin_owner"]), obterDetalhesPreviaProfissionalCtrl);

// ✅ Fechamentos: listagem/busca (owner + staff)
router.use(requireRole(["admin_owner", "admin_staff"]));
router.get("/fechamentos", listarFechamentosCtrl);
router.get("/fechamentos/por-data", obterFechamentoPorDataCtrl);

// ✅ Adiantamentos — owner-only (STAFF NUNCA)
router.get("/adiantamentos", requireRole(["admin_owner"]), listarAdiantamentosCtrl);
router.post("/adiantamentos", requireRole(["admin_owner"]), criarAdiantamentoCtrl);
router.delete("/adiantamentos/:id", requireRole(["admin_owner"]), deletarAdiantamentoCtrl);

// Fechamentos (ações)
router.post("/fechamentos", criarFechamentoCtrl);
router.get("/fechamentos/:id/resumo", obterResumoFechamentoCtrl);
router.get("/fechamentos/:id/profissionais", listarProfissionaisDoFechamentoCtrl);
router.post("/fechamentos/:id/gerar-snapshot", gerarSnapshotFechamentoCtrl);
router.post("/fechamentos/:id/concluir", concluirFechamentoCtrl);

// Despesas
router.post("/despesas", criarDespesaCtrl);
router.get("/despesas", listarDespesasCtrl);
router.delete("/despesas/:id", deletarDespesaCtrl);

export default router;

