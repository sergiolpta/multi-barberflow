// src/server.js
import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 3001;

// Carimbo para confirmar qual server está rodando
console.log("[BarberFlow API] server.js loaded from:", new URL(import.meta.url).pathname);
console.log("[BarberFlow API] process.cwd():", process.cwd());
console.log("[BarberFlow API] NODE_ENV:", process.env.NODE_ENV || "development");

app.listen(PORT, () => {
  console.log(`BarberFlow API rodando na porta ${PORT}`);
});
