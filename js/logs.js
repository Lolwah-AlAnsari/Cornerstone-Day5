/* ==========================================================================
   Gahwa log data access.

   Note what is NOT here: no ".eq('user_id', ...)" filter on the read. Row
   Level Security in Postgres decides which rows exist for this token, so the
   browser cannot widen the query even if this code were tampered with.
   ========================================================================== */

import { supabase } from "./supabase.js";

const COLUMNS = "id, name, place, with_who, rating, is_favorite, notes, created_at, user_id";

/** Every log belonging to the signed-in user, newest first. */
export async function listLogs() {
  const { data, error } = await supabase
    .from("gahwa_logs")
    .select(COLUMNS)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Insert one log. user_id is stamped by the database default (auth.uid()). */
export async function createLog({ name, place, with_who, rating, is_favorite, notes }) {
  const payload = {
    name: name.trim(),
    place: place?.trim() || null,
    with_who: with_who?.trim() || null,
    rating: Number(rating),
    is_favorite: Boolean(is_favorite),
    notes: notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("gahwa_logs")
    .insert(payload)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

/** The three numbers shown on the dashboard. */
export function computeStats(logs) {
  return {
    total: logs.length,
    favourites: logs.filter((l) => l.is_favorite).length,
    best: logs.length ? Math.max(...logs.map((l) => l.rating)) : 0,
  };
}
