/**
 * GET /api/player/status?wallet=<pubkey>
 *
 * Returns match count, bot eligibility, AND training readiness.
 * This is the single source of truth for a player's progression.
 *
 * Response:
 *   { wallet, matches, botUnlocked, training }
 */

import { NextRequest } from 'next/server'
import { matchStore } from '@/lib/matchStore'
import { getMatchCount, loadProfile } from '@/lib/trainingStore'

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

    // Training system status
    const trainingMatches = getMatchCount(wallet)
    const trainingReady = trainingMatches >= 5
    const profile = loadProfile(wallet)

    return Response.json({
        wallet,
        matches,
        botUnlocked,
        training: {
            matchesPlayed: trainingMatches,
            matchesRequired: 5,
            ready: trainingReady,
            progressPercent: Math.min(100, (trainingMatches / 5) * 100),
            hasProfile: profile !== null,
            skillTier: profile?.skillTier ?? null,
            accuracy: profile?.overallAccuracy ?? null,
        },
    })
}

export const dynamic = 'force-dynamic'
