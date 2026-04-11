/**
 * POST /api/player/record
 *
 * Records a completed match for a wallet address.
 * Call this from Unity (or the overlay) when a match finishes.
 *
 * Request body:
 *   { wallet: string, result?: "win" | "loss" | "draw" }
 *
 * Response:
 *   { wallet: string, matches: number, botUnlocked: boolean }
 *
 * botUnlocked becomes true when matches >= 5.
 */

import { NextRequest } from 'next/server'
import { matchStore } from '@/lib/matchStore'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as { wallet?: string; result?: string }
        const { wallet } = body

        if (!wallet) {
            return Response.json(
                { error: 'Missing required field: wallet' },
                { status: 400 }
            )
        }

        const current = matchStore.get(wallet) ?? 0
        const updated = current + 1
        matchStore.set(wallet, updated)

        const botUnlocked = updated >= 5

        console.log(`[player] Match recorded for ${wallet.slice(0, 8)}… → ${updated} matches. Bot unlocked: ${botUnlocked}`)

        return Response.json({ wallet, matches: updated, botUnlocked })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
