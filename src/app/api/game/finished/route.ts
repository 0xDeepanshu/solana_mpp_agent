/**
 * /api/game/finished — Unity signals that a match has ended.
 *
 * POST /api/game/finished
 *   Body: { wallet, score?, accuracy? }
 *
 *   - Generates a unique matchId and stores full match record in Redis
 *   - Appends matchId to the player's match history list
 *   - Increments practice_matches:<wallet> counter
 *   - If count >= 5: creates bot_session:<wallet> EX 86400, resets counter
 *   - Wakes up any agent long-polling on GET /api/game/finished
 *
 *   Redis keys written:
 *     match:<matchId>             Hash  — full match record
 *     player_matches:<wallet>     List  — ordered matchId history (newest last)
 *     practice_matches:<wallet>   String (int) — running counter
 *     bot_session:<wallet>        String ("1") — 24-hour unlock token
 *
 * GET  /api/game/finished?timeout=120
 *   Long-poll endpoint for the agent bot loop.
 *   Returns:
 *     200  { ok, wallet, result, score, accuracy, matchId, matches, botUnlocked }
 *     408  { error: "timeout" }
 */

import { NextRequest } from 'next/server'
import { getRedisClient } from '@/lib/redis'

const MATCHES_REQUIRED = 5
const SESSION_TTL = 60 * 60 * 24 // 24 hours in seconds

interface MatchRecord {
    matchId: string
    wallet: string
    score: number
    timestamp: number   // Unix ms
}

interface GameResult extends MatchRecord {
    matches: number
    botUnlocked: boolean
    sessionExpiresAt?: number
}

interface Waiter {
    resolve: (r: GameResult) => void
    timeoutId: ReturnType<typeof setTimeout>
}

// Module-level agent waiters (same process-singleton pattern as before)
const waiters: Waiter[] = []

// ── POST — Unity calls this when a match ends ─────────────────────────────────
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

        const redis    = await getRedisClient()
        const matchId  = crypto.randomUUID()
        const timestamp = Date.now()

        // ── 1. Store the full match record as a Redis Hash ────────────────────
        await redis.hSet(`match:${matchId}`, {
            matchId,
            wallet,
            score:     String(score),
            timestamp: String(timestamp),
        })
        // Keep match records for 30 days
        await redis.expire(`match:${matchId}`, 60 * 60 * 24 * 30)

        // ── 2. Append matchId to the player's ordered history list ─────────────
        await redis.rPush(`player_matches:${wallet}`, matchId)

        // ── 3. Increment practice match counter ───────────────────────────────
        const matches    = await redis.incr(`practice_matches:${wallet}`)
        const botUnlocked = matches >= MATCHES_REQUIRED
        let sessionExpiresAt: number | undefined

        if (botUnlocked) {
            // ── 4. Create the 24-hour bot session and reset the counter ────────
            await redis.set(`bot_session:${wallet}`, '1', { EX: SESSION_TTL })
            await redis.del(`practice_matches:${wallet}`)
            sessionExpiresAt = timestamp + SESSION_TTL * 1000

            console.log(
                `[game/finished] 🔓 Bot session created for ${wallet.slice(0, 8)}… ` +
                `Expires at ${new Date(sessionExpiresAt).toISOString()}`
            )
        }

        console.log(
            `[game/finished] Match ${matchId.slice(0, 8)}… recorded — ` +
            `wallet: ${wallet.slice(0, 8)}… | score: ${score} | ` +
            `matches: ${botUnlocked ? 0 : matches} | botUnlocked: ${botUnlocked}`
        )

        const gameResult: GameResult = {
            matchId,
            wallet,
            score,
            timestamp,
            matches:    botUnlocked ? 0 : matches,
            botUnlocked,
            ...(sessionExpiresAt && { sessionExpiresAt }),
        }

        // Wake up all waiting agents
        while (waiters.length > 0) {
            const waiter = waiters.shift()!
            clearTimeout(waiter.timeoutId)
            waiter.resolve(gameResult)
        }

        return Response.json({ ok: true, ...gameResult })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

// ── GET — Agent long-polls here waiting for the game to end ───────────────────
export function GET(request: NextRequest) {
    const timeoutSec = Math.min(
        parseInt(request.nextUrl.searchParams.get('timeout') ?? '180', 10),
        600 // cap at 10 min
    )

    return new Promise<Response>(resolve => {
        const timeoutId = setTimeout(() => {
            const idx = waiters.findIndex(w => w.timeoutId === timeoutId)
            if (idx !== -1) waiters.splice(idx, 1)
            console.log(`[game/finished] Long-poll timed out after ${timeoutSec}s`)
            resolve(
                Response.json(
                    { error: 'timeout', message: `Game did not end within ${timeoutSec}s` },
                    { status: 408 }
                )
            )
        }, timeoutSec * 1000)

        waiters.push({
            timeoutId,
            resolve: (result: GameResult) => {
                resolve(Response.json({ ok: true, ...result }))
            },
        })

        console.log(
            `[game/finished] Agent connected (timeout ${timeoutSec}s). ` +
            `Waiting agents: ${waiters.length}`
        )
    })
}

export const dynamic = 'force-dynamic'
