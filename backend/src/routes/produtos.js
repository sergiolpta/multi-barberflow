// src/routes/produtos.js
import express from "express";
import { supabase } from "../lib/supabase.js";
import { authAdminMiddleware } from "../middlewares/authAdmin.js";
import { requireRole } from "../middlewares/requireRole.js";

const router = express.Router();

router.use(authAdminMiddleware);
router.use(requireRole(["admin_owner", "admin_staff"]));

router.get("/", async (req, res) => {
  try {
    const barbeariaId = req.barbeariaId;

    const { data, error } = await supabase
      .from("produtos")
      .select("id, nome, estoque_qtd, preco_custo, preco_venda, ativo, created_at")
      .eq("barbearia_id", barbeariaId)
      .order("nome", { ascending: true });

    if (error) {
      console.error("Erro Supabase GET /produtos:", error);
      return res.status(500).json({ error: "ERRO_PRODUTOS", message: error.message });
    }

    return res.json({ produtos: data || [] });
  } catch (err) {
    console.error("Erro GET /produtos:", err);
    return res.status(500).json({ error: "ERRO_PRODUTOS", message: String(err?.message || err) });
  }
});

// ✅ criar produto
router.post("/", async (req, res) => {
  try {
    const barbeariaId = req.barbeariaId;

    const nome = String(req.body?.nome || "").trim();
    const estoque_qtd = Number(req.body?.estoque_qtd ?? 0);
    const preco_custo = req.body?.preco_custo === "" ? null : Number(req.body?.preco_custo ?? 0);
    const preco_venda = Number(req.body?.preco_venda ?? 0);
    const ativo = req.body?.ativo ?? true;

    if (!nome) {
      return res.status(400).json({ error: "VALIDACAO", message: "nome é obrigatório." });
    }
    if (!Number.isFinite(estoque_qtd) || estoque_qtd < 0) {
      return res.status(400).json({ error: "VALIDACAO", message: "estoque_qtd inválido." });
    }
    if (!Number.isFinite(preco_venda) || preco_venda < 0) {
      return res.status(400).json({ error: "VALIDACAO", message: "preco_venda inválido." });
    }
    if (preco_custo !== null && (!Number.isFinite(preco_custo) || preco_custo < 0)) {
      return res.status(400).json({ error: "VALIDACAO", message: "preco_custo inválido." });
    }

    const payload = {
      barbearia_id: barbeariaId,
      nome,
      estoque_qtd,
      preco_custo,
      preco_venda,
      ativo: !!ativo,
    };

    const { data, error } = await supabase
      .from("produtos")
      .insert(payload)
      .select("id, nome, estoque_qtd, preco_custo, preco_venda, ativo, created_at")
      .single();

    if (error) {
      console.error("Erro Supabase POST /produtos:", error);
      return res.status(500).json({ error: "ERRO_PRODUTOS", message: error.message });
    }

    return res.status(201).json({ produto: data });
  } catch (err) {
    console.error("Erro POST /produtos:", err);
    return res.status(500).json({ error: "ERRO_PRODUTOS", message: String(err?.message || err) });
  }
});

export default router;

