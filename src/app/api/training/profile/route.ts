/**
 * GET /api/training/profile?wallet=<pubkey>
 *
 * Returns the computed training profile for a wallet.
 * This is what the AI agent reads to know how to play.
 *
 * Response:
 *   { wallet, matchesPlayed, trainingReady, profile, readiness }
 */

import { NextRequest } from 'next/server'
import { getMatchCount, loadProfile, loadMatches } from '@/lib/trainingStore'
import { generateProfile } from '@/lib/profileGenerator'

const MIN_MATCHES_FOR_TRAINING = 5

export function GET(request: NextRequest) {
    const wallet = request.nextUrl.searchParams.get('wallet')
    const forceRefresh = request.nextUrl.searchParams.get('refresh') === 'true'

    if (!wallet) {
        return Response.json(
            { error: 'Missing required query param: wallet' },
            { status: 400 }
        )
    }

    const matchesPlayed = getMatchCount(wallet)
    const trainingReady = matchesPlayed >= MIN_MATCHES_FOR_TRAINING

    // Try to load existing profile, or regenerate if forced
    let profile = forceRefresh ? null : loadProfile(wallet)

    if (!profile && trainingReady) {
        const matches = loadMatches(wallet)
        profile = generateProfile(wallet, matches)
    }

    return Response.json({
        wallet,
        matchesPlayed,
        matchesRequired: MIN_MATCHES_FOR_TRAINING,
        trainingReady,
        progressPercent: Math.min(100, (matchesPlayed / MIN_MATCHES_FOR_TRAINING) * 100),
        agentReady: trainingReady && profile !== null,
        profile: profile ? {
            wallet: profile.wallet,
            totalMatches: profile.totalMatches,
            overallAccuracy: profile.overallAccuracy,
            overallAvgResponseTimeMs: profile.overallAvgResponseTimeMs,
            winRate: profile.winRate,
            avgScore: profile.avgScore,
            bestScore: profile.bestScore,
            avgMaxLevel: profile.avgMaxLevel,
            skillTier: profile.skillTier,
            stackingStyle: profile.stackingStyle,
            speedTier: profile.speedTier,
            preferredColumns: profile.preferredColumns,
            weakColumns: profile.weakColumns,
            levelPerformance: profile.levelPerformance,
            averageFailureLevel: profile.averageFailureLevel,
            consistencyScore: profile.consistencyScore,
            improvementTrend: profile.improvementTrend,
            strategySummary: profile.strategySummary,
            computedAt: profile.computedAt,
        } : null,
    })
}

export const dynamic = 'force-dynamic'
