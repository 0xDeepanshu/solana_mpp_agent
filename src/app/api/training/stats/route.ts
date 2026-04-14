/**
 * GET /api/training/stats?wallet=<pubkey>&limit=<n>
 *
 * Returns match history and aggregate stats for the training dashboard.
 *
 * Response:
 *   { wallet, totalMatches, matches[], aggregates }
 */

import { NextRequest } from 'next/server'
import { getMatchCount, loadMatches } from '@/lib/trainingStore'

export function GET(request: NextRequest) {
    const wallet = request.nextUrl.searchParams.get('wallet')
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 20

    if (!wallet) {
        return Response.json(
            { error: 'Missing required query param: wallet' },
            { status: 400 }
        )
    }

    const totalMatches = getMatchCount(wallet)
    const allMatches = loadMatches(wallet)

    // Take the most recent N matches
    const recentMatches = allMatches.slice(-limit).reverse()

    // Compute aggregates across ALL matches (not just recent)
    const wins = allMatches.filter(m => m.result === 'win').length
    const losses = allMatches.filter(m => m.result === 'loss').length
    const totalScore = allMatches.reduce((a, m) => a + m.finalScore, 0)
    const bestScore = allMatches.length > 0 ? Math.max(...allMatches.map(m => m.finalScore)) : 0
    const avgAccuracy = allMatches.length > 0
        ? allMatches.reduce((a, m) => a + m.accuracy, 0) / allMatches.length
        : 0
    const avgResponseTime = allMatches.length > 0
        ? allMatches.reduce((a, m) => a + m.avgResponseTimeMs, 0) / allMatches.length
        : 0
    const totalPlayTimeSec = allMatches.reduce((a, m) => a + m.durationSec, 0)

    // Accuracy trend (last 10 matches)
    const recentAccuracy = allMatches.slice(-10).map(m => ({
        matchId: m.matchId,
        accuracy: m.accuracy,
        score: m.finalScore,
        date: m.endedAt,
    }))

    return Response.json({
        wallet,
        totalMatches,
        aggregates: {
            wins,
            losses,
            winRate: totalMatches > 0 ? (wins / totalMatches) * 100 : 0,
            totalScore,
            bestScore,
            avgScore: totalMatches > 0 ? totalScore / totalMatches : 0,
            avgAccuracy,
            avgResponseTimeMs: avgResponseTime,
            totalPlayTimeSec,
            totalPlayTimeFormatted: formatDuration(totalPlayTimeSec),
        },
        recentAccuracy,
        matches: recentMatches.map(m => ({
            matchId: m.matchId,
            startedAt: m.startedAt,
            endedAt: m.endedAt,
            durationSec: m.durationSec,
            finalScore: m.finalScore,
            maxLevel: m.maxLevel,
            totalMoves: m.totalMoves,
            correctMoves: m.correctMoves,
            accuracy: m.accuracy,
            avgResponseTimeMs: m.avgResponseTimeMs,
            result: m.result,
        })),
    })
}

function formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
    if (mins > 0) return `${mins}m ${secs}s`
    return `${secs}s`
}

export const dynamic = 'force-dynamic'
