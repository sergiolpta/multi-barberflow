import express from "express";
import { getDisponibilidade } from "../controllers/disponibilidade.controller.js";

const router = express.Router();

// GET /disponibilidade
router.get("/", getDisponibilidade);

export default router;

