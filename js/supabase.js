/* ==========================================================================
   Supabase client. Loaded straight from a CDN as an ES module — no build
   step, no node_modules.
   ========================================================================== */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const cfg = window.SALFA_CONFIG || {};

export const configured =
  typeof cfg.SUPABASE_URL === "string" &&
  cfg.SUPABASE_URL.startsWith("https://") &&
  !cfg.SUPABASE_URL.includes("YOUR-PROJECT-REF") &&
  typeof cfg.SUPABASE_ANON_KEY === "string" &&
  cfg.SUPABASE_ANON_KEY.length > 20 &&
  !cfg.SUPABASE_ANON_KEY.includes("YOUR-");

export const supabase = configured
  ? createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        // Keeps the user logged in across reloads and tabs.
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "salfa.auth",
      },
    })
  : null;
