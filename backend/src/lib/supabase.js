import { createClient } from "@supabase/supabase-js";
import { config } from "../config/index.js";

const commonOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
};

export const supabasePublic = createClient(
  config.supabase.url,
  config.supabase.publishableKey,
  commonOptions
);

export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.secretKey,
  commonOptions
);

// Compatibilidade temporária
export const supabase = supabaseAdmin;

export const supabaseKeyInfo = {
  envPathLoaded: config.envPathLoaded,
  hasUrl: true,
  publicKeyType: "publishable",
  adminKeyType: "secret",
  usingLegacyPublic: false,
  usingLegacyAdmin: false,
};
