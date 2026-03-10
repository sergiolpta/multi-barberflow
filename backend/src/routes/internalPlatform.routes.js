import { Router } from "express";
import { requirePlatformToken } from "../middlewares/requirePlatformToken.js";
import { createBarbershopOnboarding } from "../services/platformOnboarding.service.js";

const router = Router();

/**
 * Endpoint interno da plataforma
 * Provisionamento de nova barbearia (onboarding)
 */
router.post(
  "/internal/platform/create-barbershop",
  requirePlatformToken,
  async (req, res) => {
    try {
      const result = await createBarbershopOnboarding(req.body);

      return res.status(200).json(result);
    } catch (error) {
      return res.status(error.statusCode || 500).json({
        error: error.message || "Erro interno ao processar onboarding.",
      });
    }
  }
);

export default router;