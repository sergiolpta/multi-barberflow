// scripts/genAdminToken.js
import "dotenv/config";
import jwt from "jsonwebtoken";

if (!process.env.SUPABASE_JWT_SECRET) {
  console.error("SUPABASE_JWT_SECRET não definido no .env");
  process.exit(1);
}

// payload mínimo para o admin
const payload = {
  role: "authenticated", // bate com o padrão do Supabase
  email: "admin@barberflow.local",
};

// gera token válido por 4 horas
const token = jwt.sign(payload, process.env.SUPABASE_JWT_SECRET, {
  algorithm: "HS256",
  expiresIn: "4h",
});

console.log(token);

