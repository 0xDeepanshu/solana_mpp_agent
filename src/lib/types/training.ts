/**
 * Training System Types
 *
 * Defines the data structures for the agent training pipeline:
 * Unity records raw move telemetry → stored per-wallet →
 * crunched into a strategy profile → injected into agent prompts.
 */

// ── Raw move data (sent from Unity per action) ──────────────────────────────

export interface MoveRecord {
    /** Timestamp of the move (ms since epoch) */
    ts: number
    /** The tile type/identifier */
    tileType: string
    /** Target column (0-indexed, left to right) */
    targetColumn: number
    /** Column the player actually placed the tile in */
    actualColumn: number
    /** Was the placement correct? */
    correct: boolean
    /** Time between tile appearing and placement (ms) */
    responseTimeMs: number
    /** Score at the moment of this move */
    score: number
    /** Current level/difficulty */
    level: number
    /** Stack height at this column after placement */
    stackHeight: number
}

// ── Match-level summary (computed after each game) ──────────────────────────

export interface MatchSummary {
    /** Unique match ID */
    matchId: string
    /** Wallet that played */
    wallet: string
    /** When the match started */
    startedAt: number
    /** When the match ended */
    endedAt: number
    /** Total duration in seconds */
    durationSec: number
    /** Final score */
    finalScore: number
    /** Highest level reached */
    maxLevel: number
    /** Total moves made */
    totalMoves: number
    /** Correct placements */
    correctMoves: number
    /** Accuracy percentage (0-100) */
    accuracy: number
    /** Average response time (ms) */
    avgResponseTimeMs: number
    /** Median response time (ms) */
    medianResponseTimeMs: number
    /** Fastest response time (ms) */
    fastestResponseTimeMs: number
    /** Slowest response time (ms) */
    slowestResponseTimeMs: number
    /** Moves per minute */
    movesPerMinute: number
    /** Most frequently used column (0-indexed) */
    preferredColumn: number
    /** Column usage distribution [col0, col1, col2, ...] */
    columnDistribution: number[]
    /** Accuracy per level */
    levelAccuracy: Record<number, number>
    /** Response time per level */
    levelResponseTime: Record<number, number>
    /** Result type */
    result: 'win' | 'loss' | 'abandoned'
    /** Raw moves (stored for replay) */
    moves: MoveRecord[]
}

// ── Training profile (aggregated from all matches) ──────────────────────────

export interface TrainingProfile {
    /** Wallet this profile belongs to */
    wallet: string
    /** Total matches played for training */
    totalMatches: number
    /** Overall accuracy across all matches (0-100) */
    overallAccuracy: number
    /** Overall average response time (ms) */
    overallAvgResponseTimeMs: number
    /** Win rate (0-100) */
    winRate: number
    /** Average score */
    avgScore: number
    /** Best score */
    bestScore: number
    /** Average max level reached */
    avgMaxLevel: number
    /** Skill tier based on accuracy and speed */
    skillTier: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master'
    /** Preferred stacking style */
    stackingStyle: 'center-first' | 'left-to-right' | 'right-to-left' | 'spread' | 'adaptive'
    /** Play speed classification */
    speedTier: 'cautious' | 'steady' | 'quick' | 'blazing'
    /** Columns the player favors */
    preferredColumns: number[]
    /** Columns the player avoids or struggles with */
    weakColumns: number[]
    /** Performance breakdown by level */
    levelPerformance: {
        level: number
        accuracy: number
        avgResponseTimeMs: number
        sampleSize: number
    }[]
    /** Where the player typically fails */
    averageFailureLevel: number
    /** Consistency score (0-100) — how similar are performances across matches */
    consistencyScore: number
    /** Improvement trend (-100 to 100) — positive means getting better */
    improvementTrend: number
    /** Natural language strategy summary for the agent prompt */
    strategySummary: string
    /** When profile was last computed */
    computedAt: number
}

// ── Training readiness ──────────────────────────────────────────────────────

export interface TrainingReadiness {
    /** Whether agent can be deployed with current training data */
    agentReady: boolean
    /** Matches played so far */
    matchesPlayed: number
    /** Matches needed to unlock agent */
    matchesRequired: number
    /** Percentage complete (0-100) */
    progressPercent: number
    /** Current profile (null if not enough data) */
    profile: TrainingProfile | null
}
