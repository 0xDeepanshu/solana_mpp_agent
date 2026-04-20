/**
 * POST /api/player/record
 *
 * Records a completed practice match. Mirrors /api/game/finished POST.
 * Use this as an alternative endpoint if Unity calls it directly.
 *
 * Request body:
 *   {
 *     wallet:  string  — player's wallet public key  (required)
 *     score?:  number  — match score                 (default 0)
 *   }
 *
 * Response:
 *   { matchId, wallet, score, accuracy, timestamp,
 *     matches, botUnlocked, sessionExpiresAt? }
 *
 * Redis keys written:
 *   match:<matchId>            Hash   — full match record (30-day TTL)
 *   player_matches:<wallet>    List   — ordered matchId history
 *   practice_matches:<wallet>  String — running counter
 *   bot_session:<wallet>       String — 24-hour unlock token (if threshold met)
 */

import { NextRequest } from 'next/server'
import { getRedisClient } from '@/lib/redis'

const MATCHES_REQUIRED = 5
const SESSION_TTL      = 60 * 60 * 24  // 24 hours

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            wallet?: string
            score?:  number
        }

        const {
            wallet,
            score = 0,
        } = body

        if (!wallet) {
            return Response.json(
                { error: 'Missing required field: wallet' },
                { status: 400 }
            )
        }

        const redis     = await getRedisClient()
        const matchId   = crypto.randomUUID()
        const timestamp = Date.now()

        // ── 1. Store the full match record ────────────────────────────────────
        await redis.hSet(`match:${matchId}`, {
            matchId,
            wallet,
            score:     String(score),
            timestamp: String(timestamp),
        })
        await redis.expire(`match:${matchId}`, 60 * 60 * 24 * 30) // 30 days

        // ── 2. Append to player's match history ───────────────────────────────
        await redis.rPush(`player_matches:${wallet}`, matchId)

        // ── 3. Increment practice counter ─────────────────────────────────────
        const matches    = await redis.incr(`practice_matches:${wallet}`)
        const botUnlocked = matches >= MATCHES_REQUIRED
        let sessionExpiresAt: number | undefined

        if (botUnlocked) {
            await redis.set(`bot_session:${wallet}`, '1', { EX: SESSION_TTL })
            await redis.del(`practice_matches:${wallet}`)
            sessionExpiresAt = timestamp + SESSION_TTL * 1000

            console.log(
                `[player/record] 🔓 Bot session created for ${wallet.slice(0, 8)}… ` +
                `Expires at ${new Date(sessionExpiresAt).toISOString()}`
            )
        }

        console.log(
            `[player/record] Match ${matchId.slice(0, 8)}… — ` +
            `wallet: ${wallet.slice(0, 8)}… | score: ${score} | ` +
            `matches: ${botUnlocked ? 0 : matches} | botUnlocked: ${botUnlocked}`
        )

        return Response.json({
            matchId,
            wallet,
            score,
            timestamp,
            matches:    botUnlocked ? 0 : matches,
            botUnlocked,
            ...(sessionExpiresAt && { sessionExpiresAt }),
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
