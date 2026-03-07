// backend/src/middlewares/rateLimit.js
import rateLimit from "express-rate-limit";
import { config } from "../config/index.js";

export const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT",
    message: "Muitas requisições. Tente novamente em alguns minutos.",
  },
});

