/* ==========================================================================
   SĀLFA — rewards.

   Whether a reward is *earned* is derived from the user's own logs every time
   the page renders, so it can never drift from reality and needs no
   bookkeeping. The only thing stored is the act of collecting one, in
   reward_claims, which RLS scopes to its owner exactly like gahwa_logs.

   Points come from two places: what you have logged, and the rewards you have
   collected. Tiers follow from points.
   ========================================================================== */

import { supabase } from "./supabase.js";

/** Points earned for the logging itself. */
const POINTS = {
  perCup: 10,
  perFavourite: 5,
  perPlace: 5,
  perCompanion: 5,
};

/** Tiers, lowest first. `at` is the points needed to reach it. */
export const TIERS = [
  { key: "guest", at: 0 },
  { key: "regular", at: 100 },
  { key: "devoted", at: 250 },
  { key: "taster", at: 500 },
  { key: "majlis", at: 1000 },
];

/**
 * The rewards themselves. `test` receives the derived tally and says whether
 * the reward is earned; `goal` drives the progress bar.
 */
export const REWARDS = [
  { key: "firstCup", points: 20, art: "dallah", goal: (s) => [s.total, 1], test: (s) => s.total >= 1 },
  { key: "fiveCups", points: 30, art: "finjan", goal: (s) => [s.total, 5], test: (s) => s.total >= 5 },
  { key: "tenCups", points: 50, art: "dallah", goal: (s) => [s.total, 10], test: (s) => s.total >= 10 },
  { key: "twentyFive", points: 100, art: "dallah", goal: (s) => [s.total, 25], test: (s) => s.total >= 25 },
  { key: "curator", points: 40, art: "finjan", goal: (s) => [s.favourites, 5], test: (s) => s.favourites >= 5 },
  { key: "explorer", points: 50, art: "iced", goal: (s) => [s.places, 5], test: (s) => s.places >= 5 },
  { key: "company", points: 40, art: "finjan", goal: (s) => [s.companions, 5], test: (s) => s.companions >= 5 },
  { key: "perfectionist", points: 40, art: "dallah", goal: (s) => [s.fiveStars, 3], test: (s) => s.fiveStars >= 3 },
  { key: "storyteller", points: 30, art: "iced", goal: (s) => [s.withNotes, 5], test: (s) => s.withNotes >= 5 },
];

/** The tally every reward is judged against, derived from the user's own logs. */
export function tallyFrom(logs) {
  const distinct = (values) =>
    new Set(values.map((v) => v?.trim().toLowerCase()).filter(Boolean)).size;

  return {
    total: logs.length,
    favourites: logs.filter((l) => l.is_favorite).length,
    places: distinct(logs.map((l) => l.place)),
    companions: distinct(logs.map((l) => l.with_who)),
    fiveStars: logs.filter((l) => l.rating === 5).length,
    withNotes: logs.filter((l) => l.notes?.trim()).length,
  };
}

export function tierFor(points) {
  let current = TIERS[0];
  for (const tier of TIERS) if (points >= tier.at) current = tier;
  const next = TIERS.find((tier) => tier.at > points) ?? null;
  return { current, next };
}

/**
 * Everything the rewards screen needs.
 * @param logs    the signed-in user's own logs
 * @param claimed a Set of reward keys they have already collected
 */
export function computeRewards(logs, claimed = new Set()) {
  const tally = tallyFrom(logs);

  const rewards = REWARDS.map((reward) => {
    const [have, need] = reward.goal(tally);
    return {
      ...reward,
      earned: reward.test(tally),
      claimed: claimed.has(reward.key),
      have: Math.min(have, need),
      need,
    };
  });

  const activityPoints =
    tally.total * POINTS.perCup +
    tally.favourites * POINTS.perFavourite +
    tally.places * POINTS.perPlace +
    tally.companions * POINTS.perCompanion;

  const claimedPoints = rewards
    .filter((r) => r.claimed)
    .reduce((sum, r) => sum + r.points, 0);

  const points = activityPoints + claimedPoints;
  const { current, next } = tierFor(points);

  return {
    tally,
    rewards,
    points,
    activityPoints,
    claimedPoints,
    tier: current,
    nextTier: next,
    // How far through the current tier, 0–1, for the progress bar.
    tierProgress: next
      ? Math.min(1, Math.max(0, (points - current.at) / (next.at - current.at)))
      : 1,
    pointsToNext: next ? Math.max(0, next.at - points) : 0,
    readyToClaim: rewards.filter((r) => r.earned && !r.claimed).length,
    collected: rewards.filter((r) => r.claimed).length,
  };
}

/* ------------------------------ data access ------------------------------ */

/** The caller's own claims. RLS decides which rows exist. */
export async function listClaims() {
  const { data, error } = await supabase
    .from("reward_claims")
    .select("reward_key, claimed_at");

  if (error) throw error;
  return new Set((data ?? []).map((row) => row.reward_key));
}

/**
 * Collect a reward. user_id is stamped by the column default (auth.uid()), so
 * a claim can only ever be written in the caller's own name.
 */
export async function claimReward(key) {
  const { error } = await supabase.from("reward_claims").insert({ reward_key: key });
  // Unique violation means it was already collected — harmless, not an error.
  if (error && error.code !== "23505") throw error;
}
