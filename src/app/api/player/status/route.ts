/**
 * GET /api/player/status?wallet=<pubkey>
 *
 * Returns full player stats read from Redis.
 *
 * Response (session active):
 *   {
 *     wallet, botUnlocked: true, sessionTtl,
 *     totalMatches, averageScore,
 *     recentMatches: [{ matchId, score, timestamp }]
 *   }
 *
 * Response (session not active):
 *   {
 *     wallet, botUnlocked: false, matches,
 *     totalMatches, averageScore,
 *     recentMatches: [{ matchId, score, timestamp }]
 *   }
 */

import { NextRequest } from 'next/server'
import { getRedisClient } from '@/lib/redis'

const RECENT_LIMIT = 10 // how many recent matches to return

export async function GET(request: NextRequest) {
    const wallet = request.nextUrl.searchParams.get('wallet')

    if (!wallet) {
        return Response.json(
            { error: 'Missing required query param: wallet' },
            { status: 400 }
        )
    }

    try {
        const redis = await getRedisClient()

        // ── 1. Check for an active bot session ────────────────────────────────
        const ttl        = await redis.ttl(`bot_session:${wallet}`)
        const botUnlocked = ttl > 0

        // ── 2. Current practice match counter (0 when session is active) ──────
        const raw    = await redis.get(`practice_matches:${wallet}`)
        const matches = raw ? parseInt(raw, 10) : 0

        // ── 3. Fetch recent match IDs from the player's history list ──────────
        //   lRange returns the last RECENT_LIMIT entries (newest = highest index)
        const allMatchIds = await redis.lRange(`player_matches:${wallet}`, 0, -1)
        const recentIds   = allMatchIds.slice(-RECENT_LIMIT).reverse() // newest first
        const totalMatches = allMatchIds.length

        // ── 4. Fetch each match record from its Hash ──────────────────────────
        const recentMatches: {
            matchId:   string
            score:     number
            timestamp: number
        }[] = []

        let scoreSum      = 0
        let countWithData = 0

        for (const id of recentIds) {
            const rec = await redis.hGetAll(`match:${id}`)
            if (!rec || !rec.matchId) continue

            const score = parseFloat(rec.score ?? '0')

            recentMatches.push({
                matchId:   rec.matchId,
                score,
                timestamp: parseInt(rec.timestamp ?? '0', 10),
            })

            scoreSum += score
            countWithData++
        }

        // ── 5. Average score across recent matches ────────────────────────────
        const averageScore = countWithData > 0
            ? Math.round(scoreSum / countWithData)
            : 0

        return Response.json({
            wallet,
            botUnlocked,
            ...(botUnlocked
                ? { sessionTtl: ttl }
                : { matches }            // practice matches toward next unlock
            ),
            totalMatches,
            averageScore,
            recentMatches,             // newest first, up to RECENT_LIMIT
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
