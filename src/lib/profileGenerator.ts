/**
 * profileGenerator.ts
 *
 * Takes raw match data and computes a TrainingProfile.
 * This is the core intelligence — turning play history into
 * actionable strategy that the AI agent can use.
 */

import type { MatchSummary, TrainingProfile, MoveRecord } from './types/training'

// ── Helpers ─────────────────────────────────────────────────────────────────

function median(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function linearRegressionTrend(values: number[]): number {
    // Returns slope normalized to -100..100 range
    if (values.length < 2) return 0
    const n = values.length
    const xs = values.map((_, i) => i)
    const xMean = xs.reduce((a, b) => a + b, 0) / n
    const yMean = values.reduce((a, b) => a + b, 0) / n

    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
        num += (xs[i] - xMean) * (values[i] - yMean)
        den += (xs[i] - xMean) ** 2
    }

    if (den === 0) return 0
    const slope = num / den
    // Normalize: if slope moves accuracy by more than 5% per match, cap at 100
    return Math.max(-100, Math.min(100, slope * 20))
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
}

// ── Skill tier determination ────────────────────────────────────────────────

function determineSkillTier(accuracy: number, avgResponseMs: number): TrainingProfile['skillTier'] {
    // Composite score: 60% accuracy, 40% speed (lower ms = better)
    const speedScore = clamp(1 - (avgResponseMs - 200) / 1800, 0, 1) * 100
    const composite = accuracy * 0.6 + speedScore * 0.4

    if (composite >= 90) return 'master'
    if (composite >= 75) return 'expert'
    if (composite >= 60) return 'advanced'
    if (composite >= 40) return 'intermediate'
    return 'beginner'
}

// ── Stacking style detection ────────────────────────────────────────────────

function detectStackingStyle(matches: MatchSummary[]): TrainingProfile['stackingStyle'] {
    if (matches.length === 0) return 'adaptive'

    // Aggregate column usage across all matches
    const colUsage = matches.reduce(
        (acc, m) => {
            m.columnDistribution.forEach((count, i) => {
                acc[i] = (acc[i] ?? 0) + count
            })
            return acc
        },
        {} as Record<number, number>
    )

    const totalMoves = Object.values(colUsage).reduce((a, b) => a + b, 0)
    if (totalMoves === 0) return 'adaptive'

    const cols = Object.entries(colUsage)
        .map(([col, count]) => ({ col: Number(col), pct: (count / totalMoves) * 100 }))
        .sort((a, b) => b.pct - a.pct)

    // If one column dominates (>40%), it's a focused style
    if (cols[0]?.pct > 40) {
        const numCols = Math.max(...Object.keys(colUsage).map(Number)) + 1
        const centerCol = Math.floor(numCols / 2)
        if (cols[0].col === centerCol) return 'center-first'
        if (cols[0].col < centerCol) return 'left-to-right'
        return 'right-to-left'
    }

    // If distribution is fairly even (<25% each), it's spread
    if (cols.every(c => c.pct < 25)) return 'spread'

    return 'adaptive'
}

// ── Speed tier determination ────────────────────────────────────────────────

function determineSpeedTier(avgResponseMs: number): TrainingProfile['speedTier'] {
    if (avgResponseMs < 400) return 'blazing'
    if (avgResponseMs < 700) return 'quick'
    if (avgResponseMs < 1200) return 'steady'
    return 'cautious'
}

// ── Column analysis ─────────────────────────────────────────────────────────

function analyzeColumns(matches: MatchSummary[]): {
    preferred: number[]
    weak: number[]
} {
    if (matches.length === 0) return { preferred: [], weak: [] }

    const colStats: Record<number, { total: number; correct: number }> = {}

    for (const match of matches) {
        for (const move of match.moves) {
            const col = move.actualColumn
            if (!colStats[col]) colStats[col] = { total: 0, correct: 0 }
            colStats[col].total++
            if (move.correct) colStats[col].correct++
        }
    }

    const colAccuracy = Object.entries(colStats).map(([col, stats]) => ({
        col: Number(col),
        accuracy: stats.total > 0 ? (stats.correct / stats.total) * 100 : 0,
        usage: stats.total,
    }))

    // Sort by usage for preferred, by accuracy for weak
    const sorted = [...colAccuracy].sort((a, b) => b.usage - a.usage)
    const preferred = sorted.slice(0, 2).map(c => c.col)

    // Weak columns: low accuracy + decent usage (not just rarely used)
    const avgUsage = colAccuracy.reduce((a, c) => a + c.usage, 0) / Math.max(colAccuracy.length, 1)
    const weak = colAccuracy
        .filter(c => c.accuracy < 70 && c.usage >= avgUsage * 0.5)
        .sort((a, b) => a.accuracy - b.accuracy)
        .slice(0, 2)
        .map(c => c.col)

    return { preferred, weak }
}

// ── Level performance analysis ──────────────────────────────────────────────

function analyzeLevelPerformance(matches: MatchSummary[]): TrainingProfile['levelPerformance'] {
    const levelData: Record<number, { accuracies: number[]; responseTimes: number[] }> = {}

    for (const match of matches) {
        for (const move of match.moves) {
            if (!levelData[move.level]) {
                levelData[move.level] = { accuracies: [], responseTimes: [] }
            }
            levelData[move.level].accuracies.push(move.correct ? 100 : 0)
            levelData[move.level].responseTimes.push(move.responseTimeMs)
        }
    }

    return Object.entries(levelData)
        .map(([level, data]) => ({
            level: Number(level),
            accuracy: data.accuracies.length > 0
                ? data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length
                : 0,
            avgResponseTimeMs: data.responseTimes.length > 0
                ? data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length
                : 0,
            sampleSize: data.accuracies.length,
        }))
        .sort((a, b) => a.level - b.level)
}

// ── Strategy summary generator ──────────────────────────────────────────────

function generateStrategySummary(profile: Omit<TrainingProfile, 'strategySummary' | 'computedAt'>): string {
    const lines: string[] = []

    // Core stats
    lines.push(`Player skill: ${profile.skillTier} (${profile.overallAccuracy.toFixed(1)}% accuracy)`)
    lines.push(`Speed: ${profile.speedTier} (avg ${profile.overallAvgResponseTimeMs.toFixed(0)}ms response time)`)
    lines.push(`Stacking style: ${profile.stackingStyle}`)

    // Column preferences
    if (profile.preferredColumns.length > 0) {
        lines.push(`Preferred columns: ${profile.preferredColumns.map(c => c + 1).join(', ')}`)
    }
    if (profile.weakColumns.length > 0) {
        lines.push(`Struggles with columns: ${profile.weakColumns.map(c => c + 1).join(', ')}`)
    }

    // Performance patterns
    if (profile.levelPerformance.length > 0) {
        const peakLevel = profile.levelPerformance.reduce((best, lp) =>
            lp.accuracy > best.accuracy && lp.sampleSize >= 5 ? lp : best
        )
        lines.push(`Peak accuracy at level ${peakLevel.level}: ${peakLevel.accuracy.toFixed(1)}%`)

        // Find where accuracy drops significantly
        for (let i = 1; i < profile.levelPerformance.length; i++) {
            const prev = profile.levelPerformance[i - 1]
            const curr = profile.levelPerformance[i]
            if (prev.accuracy - curr.accuracy > 15 && curr.sampleSize >= 3) {
                lines.push(`Accuracy drops at level ${curr.level} (${curr.accuracy.toFixed(1)}% vs ${prev.accuracy.toFixed(1)}% at level ${prev.level})`)
            }
        }
    }

    // Improvement trend
    if (profile.improvementTrend > 20) {
        lines.push('Player is improving rapidly — agent should adopt an aggressive strategy')
    } else if (profile.improvementTrend > 5) {
        lines.push('Player is gradually improving')
    } else if (profile.improvementTrend < -20) {
        lines.push('Player is declining — agent should play conservatively and focus on accuracy')
    }

    // Consistency
    if (profile.consistencyScore > 80) {
        lines.push('Highly consistent player — replicate their exact patterns')
    } else if (profile.consistencyScore < 40) {
        lines.push('Inconsistent player — agent should be more stable than the human was')
    }

    // Agent behavior guidance
    lines.push('')
    lines.push('AGENT BEHAVIOR:')
    if (profile.overallAccuracy >= 85) {
        lines.push('- Prioritize accuracy over speed — mirror the player\'s high-accuracy pattern')
    } else if (profile.overallAvgResponseTimeMs < 500) {
        lines.push('- Speed-focused — place tiles quickly, accept some inaccuracy')
    } else {
        lines.push('- Balanced approach — take moderate time to ensure reasonable accuracy')
    }

    if (profile.stackingStyle === 'center-first') {
        lines.push('- Stack from center outward, fill edges when center is stable')
    } else if (profile.stackingStyle === 'left-to-right') {
        lines.push('- Work left to right systematically')
    } else if (profile.stackingStyle === 'right-to-left') {
        lines.push('- Work right to left systematically')
    }

    return lines.join('\n')
}

// ── Main profile generation function ────────────────────────────────────────

export function generateProfile(wallet: string, matches: MatchSummary[]): TrainingProfile | null {
    if (matches.length === 0) return null

    // Aggregate stats across all matches
    const totalMoves = matches.reduce((a, m) => a + m.totalMoves, 0)
    const totalCorrect = matches.reduce((a, m) => a + m.correctMoves, 0)
    const overallAccuracy = totalMoves > 0 ? (totalCorrect / totalMoves) * 100 : 0

    const allResponseTimes = matches.flatMap(m => m.moves.map(mv => mv.responseTimeMs))
    const overallAvgResponseTimeMs = allResponseTimes.length > 0
        ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
        : 0

    const wins = matches.filter(m => m.result === 'win').length
    const winRate = (wins / matches.length) * 100

    const scores = matches.map(m => m.finalScore)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const bestScore = Math.max(...scores)

    const maxLevels = matches.map(m => m.maxLevel)
    const avgMaxLevel = maxLevels.reduce((a, b) => a + b, 0) / maxLevels.length

    // Column analysis
    const { preferred, weak } = analyzeColumns(matches)

    // Level performance
    const levelPerformance = analyzeLevelPerformance(matches)

    // Average failure level
    const failureLevels = matches.filter(m => m.result === 'loss').map(m => m.maxLevel)
    const averageFailureLevel = failureLevels.length > 0
        ? failureLevels.reduce((a, b) => a + b, 0) / failureLevels.length
        : avgMaxLevel

    // Consistency (inverse of coefficient of variation of accuracy per match)
    const matchAccuracies = matches.map(m => m.accuracy)
    const accMean = matchAccuracies.reduce((a, b) => a + b, 0) / matchAccuracies.length
    const accStdDev = Math.sqrt(
        matchAccuracies.reduce((sum, acc) => sum + (acc - accMean) ** 2, 0) / matchAccuracies.length
    )
    const consistencyScore = accMean > 0
        ? clamp(100 - (accStdDev / accMean) * 100, 0, 100)
        : 0

    // Improvement trend
    const improvementTrend = linearRegressionTrend(matchAccuracies)

    // Stacking style
    const stackingStyle = detectStackingStyle(matches)

    // Skill and speed tiers
    const skillTier = determineSkillTier(overallAccuracy, overallAvgResponseTimeMs)
    const speedTier = determineSpeedTier(overallAvgResponseTimeMs)

    const profileBase = {
        wallet,
        totalMatches: matches.length,
        overallAccuracy,
        overallAvgResponseTimeMs,
        winRate,
        avgScore,
        bestScore,
        avgMaxLevel,
        skillTier,
        stackingStyle,
        speedTier,
        preferredColumns: preferred,
        weakColumns: weak,
        levelPerformance,
        averageFailureLevel,
        consistencyScore,
        improvementTrend,
    }

    const strategySummary = generateStrategySummary(profileBase)

    return {
        ...profileBase,
        strategySummary,
        computedAt: Date.now(),
    }
}
