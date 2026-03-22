import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

import { config } from "./config/index.js";
import { supabaseAdmin, supabasePublic } from "./lib/supabase.js";

import publicRoutes from "./routes/public.routes.js";
import profissionaisRoutes from "./routes/profissionais.routes.js";
import servicosRoutes from "./routes/servicos.routes.js";
import disponibilidadeRoutes from "./routes/disponibilidade.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";
import agendamentosRoutes from "./routes/agendamentos.routes.js";
import relatoriosRoutes from "./routes/relatorios.routes.js";
import relatoriosEstatisticosRoutes from "./routes/relatoriosEstatisticos.routes.js";
import bloqueiosRoutes from "./routes/bloqueios.routes.js";
import pacotesRoutes from "./routes/pacotes.routes.js";
import meRoutes from "./routes/me.routes.js";
import financeiroRouter from "./routes/financeiro.js";
import produtosRouter from "./routes/produtos.js";
import vendasRouter from "./routes/vendas.js";

import internalPlatformRoutes from "./routes/internalPlatform.routes.js";

const app = express();

/* ---------------- Proxy ---------------- */
app.set("trust proxy", 1);

/* ---------------- Security headers ---------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

/* ---------------- CORS ---------------- */
const allowedOrigins = config.cors.origins;

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error(`Origin ${origin} não permitido pelo CORS`),
      false
    );
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "If-None-Match",
    "If-Modified-Since",
    "x-barbearia-id",
  ],
  exposedHeaders: ["ETag"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

/* ---------------- Parsers ---------------- */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ---------------- Internal platform routes ---------------- */
/* IMPORTANTE: precisa vir depois do parser JSON */
const limiterPlatform = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: "RATE_LIMIT", message: "Muitas requisições. Tente novamente mais tarde." },
});
// Aplica o limiter apenas no prefixo /internal/platform, não em todas as rotas
app.use("/internal/platform", limiterPlatform);
app.use(internalPlatformRoutes);

/* ---------------- Rate limiting ---------------- */
const isDev = config.env !== "production";

function makeLimiter(max) {
  return rateLimit({
    windowMs: config.rateLimit.windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,
  });
}

const limiterDefault = makeLimiter(config.rateLimit.max);
const limiterAdmin = makeLimiter(120);
const limiterPublic = makeLimiter(120);
const limiterPublicCreate = makeLimiter(60);

app.use(limiterDefault);

/* ---------------- Health ---------------- */
app.get("/health", async (req, res) => {
  const checks = {
    config: "ok",
    supabasePublic: "unknown",
    supabaseAdmin: "unknown",
  };

  try {
    const [{ error: publicError }, { error: adminError }] = await Promise.all([
      supabasePublic.auth.getSession(),
      supabaseAdmin.auth.getSession(),
    ]);

    checks.supabasePublic = publicError ? "error" : "ok";
    checks.supabaseAdmin = adminError ? "error" : "ok";

    const hasError =
      checks.supabasePublic === "error" || checks.supabaseAdmin === "error";

    return res.status(hasError ? 503 : 200).json({
      status: hasError ? "degraded" : "ok",
      service: "barberflow-api",
      env: config.env,
      timestamp: new Date().toISOString(),
      checks,
    });
  } catch (error) {
    return res.status(503).json({
      status: "error",
      service: "barberflow-api",
      env: config.env,
      timestamp: new Date().toISOString(),
      checks: {
        ...checks,
        supabasePublic: "error",
        supabaseAdmin: "error",
      },
      message: error?.message || "Healthcheck failure",
    });
  }
});

/* ---------------- Debug routes ---------------- */
if (config.env !== "production") {
  app.get("/__whoami", (req, res) => {
    res.json({
      ok: true,
      pid: process.pid,
      cwd: process.cwd(),
      appFile: new URL(import.meta.url).pathname,
      now: new Date().toISOString(),
    });
  });

  app.get("/__routes", (req, res) => {
    const routes = [];
    const stack = app?._router?.stack || [];

    for (const layer of stack) {
      if (layer?.route?.path) {
        const methods = Object.keys(layer.route.methods).map((m) =>
          m.toUpperCase()
        );
        routes.push({ type: "app", path: layer.route.path, methods });
      }

      if (layer?.name === "router" && layer?.handle?.stack) {
        for (const l2 of layer.handle.stack) {
          if (l2?.route?.path) {
            const methods = Object.keys(l2.route.methods).map((m) =>
              m.toUpperCase()
            );
            routes.push({ type: "router", path: l2.route.path, methods });
          }
        }
      }
    }

    res.json({ count: routes.length, routes });
  });
}

/* ---------------- Routes ---------------- */
app.use("/public", limiterPublic, publicRoutes);
app.use("/me", limiterAdmin, meRoutes);

app.use("/profissionais", limiterAdmin, profissionaisRoutes);
app.use("/servicos", limiterAdmin, servicosRoutes);
app.use("/disponibilidade", limiterAdmin, disponibilidadeRoutes);
app.use("/clientes", limiterAdmin, clientesRoutes);

app.use("/agendamentos", limiterPublicCreate, agendamentosRoutes);

app.use("/financeiro", limiterAdmin, financeiroRouter);

app.use("/relatorios", limiterAdmin, relatoriosRoutes);
app.use("/relatorios/estatisticos", limiterAdmin, relatoriosEstatisticosRoutes);

app.use("/bloqueios", limiterAdmin, bloqueiosRoutes);
app.use("/pacotes", limiterAdmin, pacotesRoutes);

app.use("/produtos", limiterAdmin, produtosRouter);
app.use("/vendas", limiterAdmin, vendasRouter);

/* ---------------- Not found ---------------- */
app.use((req, res) => {
  res.status(404).json({
    error: "NOT_FOUND",
    message: "Rota não encontrada",
    path: req.originalUrl,
  });
});

/* ---------------- Error handler ---------------- */
app.use((err, req, res, next) => {
  const message = err?.message || "Erro interno";
  const isCors =
    message.includes("CORS") || message.includes("Origin");

  if (config.env !== "production") {
    console.error("Express error:", err);
  }

  res.status(isCors ? 403 : 500).json({
    error: isCors ? "CORS_BLOCKED" : "INTERNAL_ERROR",
    message,
  });
});

export default app;