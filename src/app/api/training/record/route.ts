/**
 * POST /api/training/record
 *
 * Called by Unity when a match finishes to record training telemetry.
 * This is the main data ingestion point for the training pipeline.
 *
 * Request body:
 *   {
 *     wallet: string,           // player's wallet pubkey
 *     matchId: string,          // unique match identifier
 *     startedAt: number,        // match start timestamp (ms)
 *     endedAt: number,          // match end timestamp (ms)
 *     finalScore: number,       // final score
 *     maxLevel: number,         // highest level reached
 *     result: 'win' | 'loss' | 'abandoned',
 *     moves: MoveRecord[]       // array of individual move data
 *   }
 *
 * Response:
 *   { ok: true, matchId, matchesPlayed, trainingReady, profile }
 */

import { NextRequest } from 'next/server'
import { saveMatch, getMatchCount, loadMatches, saveProfile } from '@/lib/trainingStore'
import { generateProfile } from '@/lib/profileGenerator'
import type { MatchSummary, MoveRecord } from '@/lib/types/training'

const MIN_MATCHES_FOR_TRAINING = 5

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()

        const {
            wallet,
            matchId,
            startedAt,
            endedAt,
            finalScore,
            maxLevel,
            result,
            moves,
        } = body as {
            wallet?: string
            matchId?: string
            startedAt?: number
            endedAt?: number
            finalScore?: number
            maxLevel?: number
            result?: string
            moves?: MoveRecord[]
        }

        // ── Validation ──────────────────────────────────────────────────────
        if (!wallet || typeof wallet !== 'string') {
            return Response.json({ error: 'Missing or invalid: wallet' }, { status: 400 })
        }
        if (!matchId || typeof matchId !== 'string') {
            return Response.json({ error: 'Missing or invalid: matchId' }, { status: 400 })
        }
        if (!Array.isArray(moves) || moves.length === 0) {
            return Response.json({ error: 'Missing or empty: moves array' }, { status: 400 })
        }
        if (!result || !['win', 'loss', 'abandoned'].includes(result)) {
            return Response.json({ error: 'Invalid result. Must be win, loss, or abandoned' }, { status: 400 })
        }

        // ── Compute match summary ───────────────────────────────────────────
        const durationSec = ((endedAt ?? Date.now()) - (startedAt ?? Date.now())) / 1000
        const totalMoves = moves.length
        const correctMoves = moves.filter(m => m.correct).length
        const accuracy = totalMoves > 0 ? (correctMoves / totalMoves) * 100 : 0

        const responseTimes = moves.map(m => m.responseTimeMs).sort((a, b) => a - b)
        const avgResponseTimeMs = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : 0
        const medianResponseTimeMs = responseTimes.length > 0
            ? responseTimes[Math.floor(responseTimes.length / 2)]
            : 0

        // Column distribution
        const maxCol = Math.max(...moves.map(m => m.actualColumn), 0)
        const columnDistribution = Array(maxCol + 1).fill(0)
        moves.forEach(m => { columnDistribution[m.actualColumn]++ })
        const preferredColumn = columnDistribution.indexOf(Math.max(...columnDistribution))

        // Level accuracy
        const levelMoves: Record<number, { total: number; correct: number; responseTimes: number[] }> = {}
        moves.forEach(m => {
            if (!levelMoves[m.level]) levelMoves[m.level] = { total: 0, correct: 0, responseTimes: [] }
            levelMoves[m.level].total++
            if (m.correct) levelMoves[m.level].correct++
            levelMoves[m.level].responseTimes.push(m.responseTimeMs)
        })
        const levelAccuracy: Record<number, number> = {}
        const levelResponseTime: Record<number, number> = {}
        Object.entries(levelMoves).forEach(([level, data]) => {
            levelAccuracy[Number(level)] = (data.correct / data.total) * 100
            levelResponseTime[Number(level)] = data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
        })

        const matchSummary: MatchSummary = {
            matchId,
            wallet,
            startedAt: startedAt ?? Date.now(),
            endedAt: endedAt ?? Date.now(),
            durationSec,
            finalScore: finalScore ?? 0,
            maxLevel: maxLevel ?? 1,
            totalMoves,
            correctMoves,
            accuracy,
            avgResponseTimeMs,
            medianResponseTimeMs,
            fastestResponseTimeMs: responseTimes[0] ?? 0,
            slowestResponseTimeMs: responseTimes[responseTimes.length - 1] ?? 0,
            movesPerMinute: durationSec > 0 ? (totalMoves / durationSec) * 60 : 0,
            preferredColumn,
            columnDistribution,
            levelAccuracy,
            levelResponseTime,
            result: result as MatchSummary['result'],
            moves,
        }

        // ── Save match ──────────────────────────────────────────────────────
        saveMatch(matchSummary)

        // ── Check if we should regenerate profile ───────────────────────────
        const matchesPlayed = getMatchCount(wallet)
        const trainingReady = matchesPlayed >= MIN_MATCHES_FOR_TRAINING

        let profile = null
        if (trainingReady) {
            const allMatches = loadMatches(wallet)
            profile = generateProfile(wallet, allMatches)
            if (profile) {
                saveProfile(profile)
            }
        }

        return Response.json({
            ok: true,
            matchId,
            matchesPlayed,
            matchesRequired: MIN_MATCHES_FOR_TRAINING,
            trainingReady,
            profile: profile ? {
                skillTier: profile.skillTier,
                overallAccuracy: profile.overallAccuracy,
                speedTier: profile.speedTier,
                stackingStyle: profile.stackingStyle,
                strategySummary: profile.strategySummary,
            } : null,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[training/record] Error:', msg)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
