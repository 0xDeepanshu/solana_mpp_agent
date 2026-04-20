/**
 * /api/session — Bot session management backed by Redis.
 *
 * GET  /api/session?wallet=<pubkey>
 *   Returns the current bot-unlock status for the wallet.
 *   Response:
 *     { unlocked: true,  ttl: <seconds remaining> }           — active session
 *     { unlocked: false, matches: <practice matches so far> } — not yet unlocked
 *
 * POST /api/session  { wallet: string }
 *   Authorization gate — call this before starting a bot match.
 *   Response:
 *     200  { ok: true,  ttl: <seconds remaining> }
 *     403  { error: "Bot mode not unlocked. Play 5 practice matches first." }
 *     400  { error: "Missing required field: wallet" }
 *
 * Redis keys:
 *   practice_matches:<wallet>  — running practice match counter (no TTL)
 *   bot_session:<wallet>       — active 24-hour unlock token   (TTL = 86400 s)
 */

import { NextRequest } from 'next/server'
import { getRedisClient } from '@/lib/redis'

const SESSION_TTL = 60 * 60 * 24 // 24 hours in seconds

// ── GET — check unlock status ─────────────────────────────────────────────────
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

        // Check for an active bot session (TTL > 0 means key exists and has time left)
        const ttl = await redis.ttl(`bot_session:${wallet}`)

        if (ttl > 0) {
            return Response.json({ unlocked: true, ttl })
        }

        // No active session — return their current practice match count
        const raw = await redis.get(`practice_matches:${wallet}`)
        const matches = raw ? parseInt(raw, 10) : 0

        return Response.json({ unlocked: false, matches })
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
            // Session is active — bot match is allowed
            return Response.json({ ok: true, ttl })
        }

        // No active session — reject the request
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