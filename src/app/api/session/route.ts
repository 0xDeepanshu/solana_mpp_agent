/**
 * /api/session — Bot session management backed by Redis.
 *
 * GET  /api/session?wallet=<pubkey>
 *   Returns full session status + player stats.
 *   Response (unlocked):
 *     { unlocked: true, ttl, sessionTtl, totalMatches, practiceMatches, averageScore, recentMatches }
 *   Response (not unlocked):
 *     { unlocked: false, matches, totalMatches, practiceMatches, averageScore, recentMatches }
 *
 * POST /api/session  { wallet: string }
 *   Authorization gate — call this before starting a bot match.
 *   Response:
 *     200  { ok: true,  ttl }
 *     403  { error: "Bot mode not unlocked. Play 5 practice matches first." }
 */

import { NextRequest } from 'next/server'
import { getRedisClient } from '@/lib/redis'

const SESSION_TTL = 60 * 60 * 24 // 24 hours in seconds
const RECENT_LIMIT = 10

// ── GET — full session status + stats ─────────────────────────────────────────
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

        // ── 1. Check bot session ──────────────────────────────────────────────
        const ttl         = await redis.ttl(`bot_session:${wallet}`)
        const botUnlocked = ttl > 0

        // ── 2. Practice match counter ─────────────────────────────────────────
        const practiceRaw = await redis.get(`practice_matches:${wallet}`)
        const practiceMatches = practiceRaw ? parseInt(practiceRaw, 10) : 0

        // ── 3. Match history ──────────────────────────────────────────────────
        const allMatchIds  = await redis.lRange(`player_matches:${wallet}`, 0, -1)
        const totalMatches = allMatchIds.length
        const recentIds    = allMatchIds.slice(-RECENT_LIMIT).reverse() // newest first

        // ── 4. Fetch recent match records ─────────────────────────────────────
        const recentMatches: { matchId: string; score: number; timestamp: number }[] = []
        let scoreSum    = 0
        let countValid  = 0

        for (const id of recentIds) {
            const rec = await redis.hGetAll(`match:${id}`)
            if (!rec?.matchId) continue

            const score = parseFloat(rec.score ?? '0')
            recentMatches.push({
                matchId:   rec.matchId,
                score,
                timestamp: parseInt(rec.timestamp ?? '0', 10),
            })
            scoreSum += score
            countValid++
        }

        const averageScore = countValid > 0
            ? parseFloat((scoreSum / countValid).toFixed(1))
            : 0

        // ── 5. Format session time remaining ──────────────────────────────────
        const sessionTtl = botUnlocked
            ? `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m`
            : null

        return Response.json({
            wallet,
            unlocked: botUnlocked,
            ...(botUnlocked
                ? { ttl, sessionTtl }
                : { matches: practiceMatches, matchesRequired: 5 }
            ),
            practiceMatches,
            totalMatches,
            averageScore,
            recentMatches,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

// ── POST — authorize a bot match ──────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as { wallet?: string }
        const { wallet } = body

        if (!wallet) {
            return Response.json(
                { error: 'Missing required field: wallet' },
                { status: 400 }
            )
        }

        const redis = await getRedisClient()
        const ttl = await redis.ttl(`bot_session:${wallet}`)

        if (ttl > 0) {
            return Response.json({ ok: true, ttl })
        }

        const raw = await redis.get(`practice_matches:${wallet}`)
        const matches = raw ? parseInt(raw, 10) : 0

        return Response.json(
            {
                error: 'Bot mode not unlocked. Play 5 practice matches first.',
                unlocked: false,
                matches,
                matchesRequired: 5,
            },
            { status: 403 }
        )
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
export { SESSION_TTL }