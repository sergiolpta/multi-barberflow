// src/server.js
import "dotenv/config";
import app from "./app.js";

const PORT = process.env.PORT || 3002;

// Carimbo para confirmar qual server está rodando
console.log("[Multi Barber API] server.js loaded from:", new URL(import.meta.url).pathname);
console.log("[Multi Barber API] process.cwd():", process.cwd());
console.log("[Multi Barber API] NODE_ENV:", process.env.NODE_ENV || "development");

app.listen(PORT, () => {
  console.log(`Multi Barber API rodando na porta ${PORT}`);
});