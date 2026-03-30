// backend/src/routes/clientes.routes.js
import express from "express";
import {
  lookupCliente,
  searchClientes,
  listarClientes,
  criarCliente,
  atualizarCliente,
} from "../controllers/clientes.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

// GET /clientes?q=...&limit=50&offset=0 → owner/staff/barber
router.get(
  "/",
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
  listarClientes
);

// GET /clientes/search?q=...&limit=10 → owner/staff/barber
router.get(
  "/search",
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
  searchClientes
);

// POST /clientes → owner/staff
router.post(
  "/",
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff"]),
  criarCliente
);

// PUT /clientes/:id → owner/staff
router.put(
  "/:id",
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff"]),
  atualizarCliente
);

// POST /clientes/lookup → owner/staff/barber
router.post(
  "/lookup",
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
  lookupCliente
);

export default router;
