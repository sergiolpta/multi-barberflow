// backend/src/routes/public.routes.js
import { Router } from "express";

const router = Router();

// Ping público (opcional, útil para teste simples de saúde da rota)
router.get("/__ping", (req, res) => {
  res.json({
    ok: true,
    router: "public",
    file: new URL(import.meta.url).pathname,
    now: new Date().toISOString(),
  });
});

export default router;