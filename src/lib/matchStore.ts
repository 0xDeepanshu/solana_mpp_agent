/**
 * matchStore.ts — DEPRECATED
 *
 * This in-memory store is no longer the source of truth.
 * Match counts and bot sessions are now persisted in Redis:
 *
 *   Redis key: practice_matches:<wallet>  — running practice match counter
 *   Redis key: bot_session:<wallet>       — active 24-hour bot unlock token
 *
 * See:
 *   src/lib/redis.ts
 *   src/app/api/game/finished/route.ts
 *   src/app/api/player/record/route.ts
 *   src/app/api/session/route.ts
 *
 * This file is kept to avoid breaking any stale imports during the transition.
 * It can be safely deleted once all consumers have been updated.
 */

/** @deprecated Use Redis via getRedisClient() instead */
export const matchStore = new Map<string, number>()
