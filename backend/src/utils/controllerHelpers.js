// Helpers compartilhados entre controllers

export function getBarbeariaId(req) {
  return (
    String(req?.barbeariaId || "").trim() ||
    String(req?.user?.barbearia_id || "").trim() ||
    null
  );
}

export function respondBarbeariaAusente(res) {
  return res.status(401).json({
    error: "USUARIO_SEM_BARBEARIA",
    message: "Usuário autenticado sem barbearia vinculada.",
  });
}
