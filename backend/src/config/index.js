import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath =
  process.env.DOTENV_CONFIG_PATH ||
  path.resolve(__dirname, "../../.env");

dotenv.config({ path: envPath });

function required(name, value) {
  if (value === undefined || value === null || String(value).trim() === "") {
    throw new Error(`ENV obrigatória ausente: ${name}`);
  }
  return String(value).trim();
}

function optional(name, value, fallback = "") {
  return String(value ?? fallback).trim();
}

function toPositiveInt(name, value, fallback) {
  const raw = value ?? fallback;
  const num = Number(raw);

  if (!Number.isInteger(num) || num <= 0) {
    throw new Error(`ENV inteira positiva inválida: ${name}=${raw}`);
  }

  return num;
}

function toBoolean(name, value, fallback = false) {
  const raw = String(value ?? fallback).trim().toLowerCase();

  if (["true", "1", "yes", "on"].includes(raw)) return true;
  if (["false", "0", "no", "off"].includes(raw)) return false;

  throw new Error(`ENV booleana inválida: ${name}=${value}`);
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const env = optional("NODE_ENV", process.env.NODE_ENV, "development");

const corsOrigins = splitCsv(process.env.CORS_ORIGINS);
if (env === "production" && corsOrigins.length === 0) {
  throw new Error("ENV obrigatória ausente ou vazia: CORS_ORIGINS");
}

export const config = Object.freeze({
  envPathLoaded: envPath,
  env,
  port: toPositiveInt("PORT", process.env.PORT, 3001),

  supabase: {
    url: required("SUPABASE_URL", process.env.SUPABASE_URL),
    publishableKey: required(
      "SUPABASE_PUBLISHABLE_KEY",
      process.env.SUPABASE_PUBLISHABLE_KEY
    ),
    secretKey: required(
      "SUPABASE_SECRET_KEY",
      process.env.SUPABASE_SECRET_KEY
    ),
    // Opcional: JWT Secret do painel Supabase (Settings → API → JWT Secret).
    // Usado para verificar tokens HS256 emitidos pelo browser.
    // Se não configurado, usa apenas getUser() do client admin (funciona para ES256).
    jwtSecret: optional("SUPABASE_JWT_SECRET", process.env.SUPABASE_JWT_SECRET, ""),
  },

  cors: {
    origins:
      corsOrigins.length > 0
        ? corsOrigins
        : ["http://localhost:5173", "http://localhost:3000"],
  },

  rateLimit: {
    windowMs: toPositiveInt(
      "RATE_LIMIT_WINDOW_MS",
      process.env.RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    max: toPositiveInt("RATE_LIMIT_MAX", process.env.RATE_LIMIT_MAX, 200),
  },

  features: {
    enableDebugRoutes: toBoolean(
      "ENABLE_DEBUG_ROUTES",
      process.env.ENABLE_DEBUG_ROUTES,
      env !== "production"
    ),
  },

  business: {
    timeZone: optional("BUSINESS_TIME_ZONE", process.env.BUSINESS_TIME_ZONE, "America/Sao_Paulo"),
    localOffset: optional("LOCAL_OFFSET", process.env.LOCAL_OFFSET, "-03:00"),
    janelaInicioMin: toPositiveInt("JANELA_INICIO_MIN", process.env.JANELA_INICIO_MIN, 9 * 60),
    janelaFimMin: toPositiveInt("JANELA_FIM_MIN", process.env.JANELA_FIM_MIN, 21 * 60),
    slotGranularityMin: toPositiveInt("SLOT_GRANULARITY_MIN", process.env.SLOT_GRANULARITY_MIN, 30),
    adminRetroToleranceMinutes: toPositiveInt(
      "ADMIN_RETRO_TOLERANCE_MINUTES",
      process.env.ADMIN_RETRO_TOLERANCE_MINUTES,
      30
    ),
  },
});