/**
 * GET /api/player/status?wallet=<pubkey>
 *
 * Returns the number of matches played and whether Bot Mode is unlocked.
 *
 * Response:
 *   { wallet: string, matches: number, botUnlocked: boolean }
 *
 * botUnlocked is true when matches >= 5.
 */

import { NextRequest } from 'next/server'
import { matchStore } from '@/lib/matchStore'

export function GET(request: NextRequest) {
    const wallet = request.nextUrl.searchParams.get('wallet')

    if (!wallet) {
        return Response.json(
            { error: 'Missing required query param: wallet' },
            { status: 400 }
        )
    }

    const matches = matchStore.get(wallet) ?? 0
    const botUnlocked = matches >= 5

    return Response.json({ wallet, matches, botUnlocked })
}

export const dynamic = 'force-dynamic'
