// backend/src/routes/adiantamentos.routes.js
import express from "express";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listAdiantamentos,
  createAdiantamento,
  deleteAdiantamento,
} from "../controllers/adiantamentos.controller.js";

const router = express.Router();

// owner-only
const ownerOnly = [authAdminMiddleware, requireRole(["admin_owner"])];

router.get("/", ...ownerOnly, listAdiantamentos);
router.post("/", ...ownerOnly, createAdiantamento);
router.delete("/:id", ...ownerOnly, deleteAdiantamento);

export default router;

