// frontend/src/lib/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;

// Preferir publishable; fallback para anon (transição)
const publishable = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

const key = publishable || anon;

if (!url || !key) {
  console.warn(
    "⚠️ VITE_SUPABASE_URL ou VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) não estão definidos no .env do frontend."
  );
}

export const supabase = createClient(url || "", key || "");

