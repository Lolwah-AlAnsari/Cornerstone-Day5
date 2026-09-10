/* ==========================================================================
   Authentication. Email + password, with the display name stored on the
   user's own auth record (user_metadata.name) — no extra profile table.
   ========================================================================== */

import { supabase } from "./supabase.js";
import { t } from "./i18n.js";

/** Turns Supabase's raw error text into something a person wants to read. */
export function friendlyAuthError(error) {
  const msg = (error?.message || "").toLowerCase();
  const code = error?.code || "";

  if (code === "invalid_credentials" || msg.includes("invalid login credentials")) return t("errBadCreds");
  if (code === "user_already_exists" || msg.includes("already registered") || msg.includes("already been registered")) return t("errEmailTaken");
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return t("errUnconfirmed");
  if (code === "email_address_invalid" || msg.includes("is invalid")) return t("errEmailInvalid");
  if (code === "weak_password" || msg.includes("password should be at least")) return t("errPassShort");
  if (code === "over_email_send_rate_limit") return t("errEmailSendLimit");
  if (code === "over_request_rate_limit" || msg.includes("rate limit") || msg.includes("too many")) return t("errRate");
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed")) return t("errNetwork");

  return t("errGeneric");
}

export async function signUp({ name, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });
  if (error) throw error;

  // When email confirmation is switched on, Supabase returns a user but no
  // session — the caller shows "check your inbox" instead of the dashboard.
  return { session: data.session, needsConfirmation: !data.session };
}

export async function logIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function logOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthChange(fn) {
  return supabase.auth.onAuthStateChange((_event, session) => fn(session));
}

/** Best available display name, falling back to the email's local part. */
export function displayName(user) {
  const meta = user?.user_metadata || {};
  const name = (meta.name || meta.full_name || "").trim();
  if (name) return name;
  const email = user?.email || "";
  return email ? email.split("@")[0] : "";
}
