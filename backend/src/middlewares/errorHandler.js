// backend/src/middlewares/errorHandler.js
import { logger } from "../utils/logger.js";

export function errorHandler(err, req, res, next) {
  const status = Number(err?.statusCode || err?.status || 500);
  const code = err?.code || "INTERNAL_ERROR";
  const message = err?.message || "Erro interno.";

  logger.error("request_error", {
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    message,
  });

  return res.status(status).json({
    error: code,
    message,
    details: err?.details ?? null,
  });
}

