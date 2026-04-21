/**
 * GET /api/debug/players
 * Lists all players, their match counts, session status, and recent matches.
 * ⚠️ DEBUG ONLY — remove before production.
 */

import { getRedisClient } from '@/lib/redis'

export async function GET() {
    try {
        const redis = await getRedisClient()

        // Find all player-related keys
        const [practiceKeys, sessionKeys, playerMatchKeys] = await Promise.all([
            redis.keys('practice_matches:*'),
            redis.keys('bot_session:*'),
            redis.keys('player_matches:*'),
        ])

        // Collect all unique wallet addresses
        const wallets = new Set<string>()
        for (const k of practiceKeys)    wallets.add(k.replace('practice_matches:', ''))
        for (const k of sessionKeys)     wallets.add(k.replace('bot_session:', ''))
        for (const k of playerMatchKeys) wallets.add(k.replace('player_matches:', ''))

        // Build player list
        const players = await Promise.all(
            Array.from(wallets).map(async (wallet) => {
                const [practiceRaw, sessionTtl, matchIds] = await Promise.all([
                    redis.get(`practice_matches:${wallet}`),
                    redis.ttl(`bot_session:${wallet}`),
                    redis.lRange(`player_matches:${wallet}`, 0, -1),
                ])

                // Fetch last 5 match details
                const recentIds = matchIds.slice(-5).reverse()
                const recentMatches = await Promise.all(
                    recentIds.map(async (id) => {
                        const rec = await redis.hGetAll(`match:${id}`)
                        return rec?.matchId ? {
                            matchId:   rec.matchId,
                            score:     Number(rec.score ?? 0),
                            timestamp: new Date(Number(rec.timestamp ?? 0)).toISOString(),
                        } : null
                    })
                )

                return {
                    wallet,
                    practiceMatches: practiceRaw ? parseInt(practiceRaw, 10) : 0,
                    botUnlocked:    sessionTtl > 0,
                    sessionTtl:     sessionTtl > 0 ? `${Math.floor(sessionTtl / 3600)}h ${Math.floor((sessionTtl % 3600) / 60)}m` : null,
                    totalMatches:   matchIds.length,
                    recentMatches:  recentMatches.filter(Boolean),
                }
            })
        )

        return Response.json({
            totalPlayers: players.length,
            players,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
