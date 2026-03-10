import crypto from "crypto";

function safeCompare(a, b) {
  const aBuffer = Buffer.from(String(a || ""), "utf8");
  const bBuffer = Buffer.from(String(b || ""), "utf8");

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function requirePlatformToken(req, res, next) {
  const expectedToken = process.env.PLATFORM_ONBOARDING_TOKEN;
  const authHeader = req.headers.authorization || "";

  if (!expectedToken) {
    return res.status(500).json({
      error: "PLATFORM_ONBOARDING_TOKEN não configurado no servidor.",
    });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token || !safeCompare(token, expectedToken)) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  return next();
}