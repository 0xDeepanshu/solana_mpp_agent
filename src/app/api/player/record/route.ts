/**
 * POST /api/player/record
 *
 * Records a completed match for a wallet address.
 * Call this from Unity (or the overlay) when a match finishes.
 *
 * Now also integrates with the training system — if full training data
 * is provided, it saves to the training store as well.
 *
 * Request body (simple):
 *   { wallet: string, result?: "win" | "loss" | "draw" }
 *
 * Request body (with training data):
 *   { wallet: string, result: "win"|"loss"|"abandoned", matchId, startedAt, endedAt, finalScore, maxLevel, moves[] }
 *
 * Response:
 *   { wallet, matches, botUnlocked, training? }
 */

import { NextRequest } from 'next/server'
import { matchStore } from '@/lib/matchStore'
import { saveMatch, getMatchCount, loadMatches, saveProfile } from '@/lib/trainingStore'
import { generateProfile } from '@/lib/profileGenerator'
import type { MatchSummary, MoveRecord } from '@/lib/types/training'

const MIN_MATCHES_FOR_TRAINING = 5

export async function POST(request: NextRequest) {
    try {
        const body = await request.json() as {
            wallet?: string
            result?: string
            matchId?: string
            startedAt?: number
            endedAt?: number
            finalScore?: number
            maxLevel?: number
            moves?: MoveRecord[]
        }

        const { wallet, result } = body

        if (!wallet) {
            return Response.json(
                { error: 'Missing required field: wallet' },
                { status: 400 }
            )
        }

        // ── Record in legacy match store (for bot unlock) ───────────────
        const current = matchStore.get(wallet) ?? 0
        const updated = current + 1
        matchStore.set(wallet, updated)
        const botUnlocked = updated >= 5

        // ── If training data provided, save to training store ───────────
        let trainingResult = null
        if (body.matchId && body.moves && body.moves.length > 0) {
            const moves = body.moves
            const durationSec = ((body.endedAt ?? Date.now()) - (body.startedAt ?? Date.now())) / 1000
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

            const maxCol = Math.max(...moves.map(m => m.actualColumn), 0)
            const columnDistribution = Array(maxCol + 1).fill(0)
            moves.forEach(m => { columnDistribution[m.actualColumn]++ })
            const preferredColumn = columnDistribution.indexOf(Math.max(...columnDistribution))

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
                matchId: body.matchId,
                wallet,
                startedAt: body.startedAt ?? Date.now(),
                endedAt: body.endedAt ?? Date.now(),
                durationSec,
                finalScore: body.finalScore ?? 0,
                maxLevel: body.maxLevel ?? 1,
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
                result: (result as MatchSummary['result']) ?? 'loss',
                moves,
            }

            saveMatch(matchSummary)

            const trainingMatches = getMatchCount(wallet)
            const trainingReady = trainingMatches >= MIN_MATCHES_FOR_TRAINING

            if (trainingReady) {
                const allMatches = loadMatches(wallet)
                const profile = generateProfile(wallet, allMatches)
                if (profile) saveProfile(profile)
            }

            trainingResult = {
                matchesPlayed: trainingMatches,
                trainingReady,
                progressPercent: Math.min(100, (trainingMatches / MIN_MATCHES_FOR_TRAINING) * 100),
            }
        }

        console.log(`[player] Match recorded for ${wallet.slice(0, 8)}… → ${updated} matches. Bot unlocked: ${botUnlocked}`)

        return Response.json({
            wallet,
            matches: updated,
            botUnlocked,
            ...(trainingResult ? { training: trainingResult } : {}),
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
