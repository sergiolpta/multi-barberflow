// src/db.js
import pg from "pg";
const { Pool } = pg;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`ENV ausente: ${name}`);
  return v;
}

// Use preferencialmente o pooler (Supavisor) no SUPABASE_DB_URL
// Ex.: postgres://[db-user]:[db-password]@aws-0-...pooler.supabase.com:6543/postgres?options=reference%3D<project-ref>
const connectionString = requireEnv("SUPABASE_DB_URL");

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});

