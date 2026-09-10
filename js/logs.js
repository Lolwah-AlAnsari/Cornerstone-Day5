/* ==========================================================================
   Gahwa log data access.

   Note what is NOT here: no ".eq('user_id', ...)" filter on the read. Row
   Level Security in Postgres decides which rows exist for this token, so the
   browser cannot widen the query even if this code were tampered with.
   ========================================================================== */

import { supabase } from "./supabase.js";

const COLUMNS =
  "id, name, place, with_who, rating, is_favorite, notes, created_at, user_id, latitude, longitude";

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
export async function createLog({ name, place, with_who, rating, is_favorite, notes, latitude, longitude }) {
  const payload = {
    name: name.trim(),
    place: place?.trim() || null,
    with_who: with_who?.trim() || null,
    rating: Number(rating),
    is_favorite: Boolean(is_favorite),
    notes: notes?.trim() || null,
    // The database enforces both-or-neither, so normalise a half-set pair to null.
    latitude: Number.isFinite(latitude) && Number.isFinite(longitude) ? latitude : null,
    longitude: Number.isFinite(latitude) && Number.isFinite(longitude) ? longitude : null,
  };

  const { data, error } = await supabase
    .from("gahwa_logs")
    .insert(payload)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update one log.
 *
 * Only the six editable fields are sent. user_id is never included, so
 * ownership cannot move; latitude/longitude are left out too, so a pinned
 * location survives an edit untouched. The existing UPDATE policy carries a
 * `using` and a `with check`, so Postgres refuses both editing someone else's
 * row and rewriting a row into someone else's name.
 */
export async function updateLog(id, { name, place, with_who, rating, is_favorite, notes }) {
  const patch = {
    name: name.trim(),
    place: place?.trim() || null,
    with_who: with_who?.trim() || null,
    rating: Number(rating),
    is_favorite: Boolean(is_favorite),
    notes: notes?.trim() || null,
  };

  const { data, error } = await supabase
    .from("gahwa_logs")
    .update(patch)
    .eq("id", id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return data;
}

/** Delete one log. RLS decides whether this row is the caller's to delete. */
export async function deleteLog(id) {
  const { error } = await supabase.from("gahwa_logs").delete().eq("id", id);
  if (error) throw error;
}

/** Logs that can actually appear on the map. */
export function withCoordinates(logs) {
  return logs.filter((l) => Number.isFinite(l.latitude) && Number.isFinite(l.longitude));
}

/**
 * Insights over the caller's own logs.
 *
 * Computed from the rows already fetched for this user — which RLS has
 * restricted to their own — rather than by querying across the table. No other
 * user's data is read, aggregated, or filtered out in the browser.
 */
export function computeInsights(logs) {
  if (!logs.length) return null;

  const mostCommon = (values) => {
    const tally = new Map();
    for (const raw of values) {
      const value = raw?.trim();
      if (!value) continue;
      tally.set(value, (tally.get(value) ?? 0) + 1);
    }
    let best = null;
    for (const [value, count] of tally) {
      if (!best || count > best.count) best = { value, count };
    }
    return best;
  };

  const ratingSum = logs.reduce((sum, l) => sum + l.rating, 0);
  const bestRating = Math.max(...logs.map((l) => l.rating));

  return {
    total: logs.length,
    favourites: logs.filter((l) => l.is_favorite).length,
    average: Math.round((ratingSum / logs.length) * 10) / 10,
    // Ties resolve to the most recent, since logs arrive newest-first.
    bestCup: logs.find((l) => l.rating === bestRating) ?? null,
    topPlace: mostCommon(logs.map((l) => l.place)),
    topCompany: mostCommon(logs.map((l) => l.with_who)),
  };
}

/** The three numbers shown on the dashboard. */
export function computeStats(logs) {
  return {
    total: logs.length,
    favourites: logs.filter((l) => l.is_favorite).length,
    best: logs.length ? Math.max(...logs.map((l) => l.rating)) : 0,
  };
}
