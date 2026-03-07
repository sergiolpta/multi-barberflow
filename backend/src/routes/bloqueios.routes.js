// backend/src/routes/bloqueios.routes.js
import { Router } from "express";
import {
  criarBloqueio,
  listarBloqueios,
} from "../controllers/bloqueios.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = Router();

const adminAccess = [authAdminMiddleware, requireRole(["admin_owner", "admin_staff"])];

// LISTAR bloqueios: apenas admin
router.get("/", ...adminAccess, listarBloqueios);

// CRIAR bloqueio: apenas admin
router.post("/", ...adminAccess, criarBloqueio);

export default router;

