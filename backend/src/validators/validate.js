// backend/src/validators/validate.js
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });

    if (!result.success) {
      return res.status(400).json({
        error: "VALIDACAO",
        message: "Dados inválidos",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    // opcional: substituir por dados parseados/normalizados
    req.body = result.data.body;
    req.query = result.data.query;
    req.params = result.data.params;

    return next();
  };
}

