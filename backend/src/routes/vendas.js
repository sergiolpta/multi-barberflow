import express from "express";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";
import { listarVendas, criarVenda } from "../controllers/vendas.controller.js";

const router = express.Router();

router.use(authAdminMiddleware);
router.use(requireRole(["admin_owner", "admin_staff"]));

router.get("/", listarVendas);
router.post("/", criarVenda);

export default router;

