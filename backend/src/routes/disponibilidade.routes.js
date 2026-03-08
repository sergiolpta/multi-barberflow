import express from "express";
import { getDisponibilidade } from "../controllers/disponibilidade.controller.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

const adminReadAccess = [
  authAdminMiddleware,
  requireRole(["admin_owner", "admin_staff", "barber"]),
];

// GET /disponibilidade
router.get("/", ...adminReadAccess, getDisponibilidade);

export default router;
