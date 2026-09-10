/* Writes js/config.js from environment variables at build time, so no keys
   are ever committed to Git. Vercel runs this via `npm run build`.
   Requires no dependencies — plain Node. */

import { writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    "\n[salfa] Missing environment variables.\n" +
      "Set SUPABASE_URL and SUPABASE_ANON_KEY in your Vercel project settings\n" +
      "(Settings -> Environment Variables), then redeploy.\n"
  );
  process.exit(1);
}

const banner = "/* Generated at build time from environment variables. Do not edit. */\n";
const body = `window.SALFA_CONFIG = ${JSON.stringify({ SUPABASE_URL, SUPABASE_ANON_KEY }, null, 2)};\n`;

writeFileSync("js/config.js", banner + body);
console.log("[salfa] wrote js/config.js for", SUPABASE_URL);
