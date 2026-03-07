// backend/src/routes/clientes.routes.js
import express from "express";
import {
  lookupCliente,
  searchClientes,
} from "../controllers/clientes.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

// GET /clientes/search?q=...&limit=10 → ADMIN (owner/staff/barber)
router.get(
  "/search",
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
  searchClientes
);

// POST /clientes/lookup → ADMIN (owner/staff/barber)
router.post(
  "/lookup",
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
  lookupCliente
);

export default router;
