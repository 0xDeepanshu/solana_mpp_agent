'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from '@solana/connector'
import { ConnectButtonBaseUI } from '@/components/WalletConnect'

interface TrainingProfile {
    wallet: string
    totalMatches: number
    overallAccuracy: number
    overallAvgResponseTimeMs: number
    winRate: number
    avgScore: number
    bestScore: number
    avgMaxLevel: number
    skillTier: string
    stackingStyle: string
    speedTier: string
    preferredColumns: number[]
    weakColumns: number[]
    levelPerformance: { level: number; accuracy: number; avgResponseTimeMs: number; sampleSize: number }[]
    averageFailureLevel: number
    consistencyScore: number
    improvementTrend: number
    strategySummary: string
    computedAt: number
}

interface MatchRecord {
    matchId: string
    startedAt: number
    endedAt: number
    durationSec: number
    finalScore: number
    maxLevel: number
    totalMoves: number
    correctMoves: number
    accuracy: number
    avgResponseTimeMs: number
    result: string
}

interface TrainingStats {
    wallet: string
    totalMatches: number
    aggregates: {
        wins: number
        losses: number
        winRate: number
        totalScore: number
        bestScore: number
        avgScore: number
        avgAccuracy: number
        avgResponseTimeMs: number
        totalPlayTimeSec: number
        totalPlayTimeFormatted: string
    }
    recentAccuracy: { matchId: string; accuracy: number; score: number; date: number }[]
    matches: MatchRecord[]
}

interface PlayerStatus {
    wallet: string
    matches: number
    botUnlocked: boolean
    training: {
        matchesPlayed: number
        matchesRequired: number
        ready: boolean
        progressPercent: number
        hasProfile: boolean
        skillTier: string | null
        accuracy: number | null
    }
}

const TIER_COLORS: Record<string, string> = {
    beginner: '#94a3b8',
    intermediate: '#3b82f6',
    advanced: '#8b5cf6',
    expert: '#f59e0b',
    master: '#ef4444',
}

const TIER_LABELS: Record<string, string> = {
    beginner: '🌱 Beginner',
    intermediate: '⚔️ Intermediate',
    advanced: '🔥 Advanced',
    expert: '💎 Expert',
    master: '👑 Master',
}

const SPEED_LABELS: Record<string, string> = {
    cautious: '🐢 Cautious',
    steady: '🚶 Steady',
    quick: '🏃 Quick',
    blazing: '⚡ Blazing',
}

const STYLE_LABELS: Record<string, string> = {
    'center-first': '🎯 Center-First',
    'left-to-right': '⬅️ Left-to-Right',
    'right-to-left': '➡️ Right-to-Left',
    spread: '🔀 Spread',
    adaptive: '🧩 Adaptive',
}

export default function TrainingPage() {
    const { address } = useAccount()
    const [status, setStatus] = useState<PlayerStatus | null>(null)
    const [profile, setProfile] = useState<TrainingProfile | null>(null)
    const [stats, setStats] = useState<TrainingStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'strategy'>('overview')

    const fetchData = useCallback(async () => {
        if (!address) return
        setLoading(true)
        setError(null)

        try {
            const [statusRes, profileRes, statsRes] = await Promise.all([
                fetch(`/api/player/status?wallet=${address}`),
                fetch(`/api/training/profile?wallet=${address}`),
                fetch(`/api/training/stats?wallet=${address}&limit=20`),
            ])

            if (statusRes.ok) setStatus(await statusRes.json())
            if (profileRes.ok) {
                const pData = await profileRes.json()
                setProfile(pData.profile)
            }
            if (statsRes.ok) setStats(await statsRes.json())
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load training data')
        } finally {
            setLoading(false)
        }
    }, [address])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    if (!address) {
        return (
            <div style={styles.container}>
                <div style={styles.connectPrompt}>
                    <div style={styles.connectIcon}>🎮</div>
                    <h1 style={styles.connectTitle}>Agent Training Center</h1>
                    <p style={styles.connectDesc}>
                        Connect your wallet to view your training profile and agent stats.
                    </p>
                    <ConnectButtonBaseUI />
                </div>
            </div>
        )
    }

    return (
        <div style={styles.container}>
            {/* Header */}
            <div style={styles.header}>
                <div>
                    <h1 style={styles.title}>🎯 Training Center</h1>
                    <p style={styles.subtitle}>
                        Wallet: {address.slice(0, 6)}...{address.slice(-4)}
                    </p>
                </div>
                <div style={styles.headerActions}>
                    <button onClick={fetchData} style={styles.refreshBtn} disabled={loading}>
                        {loading ? '⟳' : '↻'} Refresh
                    </button>
                    <a href="/agent" style={styles.agentLink}>Go to Agent →</a>
                </div>
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {/* Training Progress Bar */}
            {status && (
                <div style={styles.progressSection}>
                    <div style={styles.progressHeader}>
                        <span style={styles.progressLabel}>Training Progress</span>
                        <span style={styles.progressValue}>
                            {status.training.matchesPlayed}/{status.training.matchesRequired} games
                        </span>
                    </div>
                    <div style={styles.progressBar}>
                        <div
                            style={{
                                ...styles.progressFill,
                                width: `${status.training.progressPercent}%`,
                                background: status.training.ready
                                    ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                    : 'linear-gradient(90deg, #8b5cf6, #6d28d9)',
                            }}
                        />
                    </div>
                    <div style={styles.progressStatus}>
                        {status.training.ready ? (
                            <span style={styles.readyBadge}>✅ Agent is trained and ready!</span>
                        ) : (
                            <span style={styles.pendingBadge}>
                                🔄 {status.training.matchesRequired - status.training.matchesPlayed} more games to train your agent
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div style={styles.tabs}>
                {(['overview', 'history', 'strategy'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            ...styles.tab,
                            ...(activeTab === tab ? styles.tabActive : {}),
                        }}
                    >
                        {tab === 'overview' ? '📊 Overview' : tab === 'history' ? '📜 History' : '🧠 Strategy'}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && profile && (
                <div style={styles.overview}>
                    {/* Skill Card */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>Agent Skill Level</h3>
                        <div style={styles.tierDisplay}>
                            <span style={{ ...styles.tierBadge, background: TIER_COLORS[profile.skillTier] + '22', color: TIER_COLORS[profile.skillTier], borderColor: TIER_COLORS[profile.skillTier] + '44' }}>
                                {TIER_LABELS[profile.skillTier]}
                            </span>
                        </div>
                        <div style={styles.statsGrid}>
                            <StatBox label="Accuracy" value={`${profile.overallAccuracy.toFixed(1)}%`} icon="🎯" />
                            <StatBox label="Speed" value={SPEED_LABELS[profile.speedTier]} icon="⏱️" />
                            <StatBox label="Win Rate" value={`${profile.winRate.toFixed(1)}%`} icon="🏆" />
                            <StatBox label="Best Score" value={profile.bestScore.toString()} icon="⭐" />
                            <StatBox label="Consistency" value={`${profile.consistencyScore.toFixed(0)}/100`} icon="📈" />
                            <StatBox label="Avg Level" value={profile.avgMaxLevel.toFixed(1)} icon="📊" />
                        </div>
                    </div>

                    {/* Play Style Card */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>Play Style</h3>
                        <div style={styles.statsGrid}>
                            <StatBox label="Stacking Style" value={STYLE_LABELS[profile.stackingStyle]} icon="🧱" />
                            <StatBox
                                label="Preferred Columns"
                                value={profile.preferredColumns.length > 0 ? profile.preferredColumns.map(c => c + 1).join(', ') : 'N/A'}
                                icon="📍"
                            />
                            <StatBox
                                label="Weak Columns"
                                value={profile.weakColumns.length > 0 ? profile.weakColumns.map(c => c + 1).join(', ') : 'None'}
                                icon="⚠️"
                            />
                            <StatBox
                                label="Trend"
                                value={profile.improvementTrend > 5 ? '📈 Improving' : profile.improvementTrend < -5 ? '📉 Declining' : '➡️ Stable'}
                                icon="📉"
                            />
                        </div>
                    </div>

                    {/* Level Performance */}
                    {profile.levelPerformance.length > 0 && (
                        <div style={styles.card}>
                            <h3 style={styles.cardTitle}>Performance by Level</h3>
                            <div style={styles.levelBars}>
                                {profile.levelPerformance.map(lp => (
                                    <div key={lp.level} style={styles.levelBarRow}>
                                        <span style={styles.levelLabel}>L{lp.level}</span>
                                        <div style={styles.levelBarTrack}>
                                            <div
                                                style={{
                                                    ...styles.levelBarFill,
                                                    width: `${lp.accuracy}%`,
                                                    background: lp.accuracy >= 80 ? '#22c55e' : lp.accuracy >= 60 ? '#f59e0b' : '#ef4444',
                                                }}
                                            />
                                        </div>
                                        <span style={styles.levelValue}>{lp.accuracy.toFixed(0)}%</span>
                                        <span style={styles.levelSamples}>n={lp.sampleSize}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'history' && stats && (
                <div style={styles.history}>
                    {/* Aggregate Stats */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>Lifetime Stats</h3>
                        <div style={styles.statsGrid}>
                            <StatBox label="Total Matches" value={stats.totalMatches.toString()} icon="🎮" />
                            <StatBox label="Wins" value={stats.aggregates.wins.toString()} icon="🏆" />
                            <StatBox label="Losses" value={stats.aggregates.losses.toString()} icon="💀" />
                            <StatBox label="Total Score" value={stats.aggregates.totalScore.toString()} icon="⭐" />
                            <StatBox label="Avg Accuracy" value={`${stats.aggregates.avgAccuracy.toFixed(1)}%`} icon="🎯" />
                            <StatBox label="Play Time" value={stats.aggregates.totalPlayTimeFormatted} icon="⏱️" />
                        </div>
                    </div>

                    {/* Recent Matches */}
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>Recent Matches</h3>
                        <div style={styles.matchList}>
                            {stats.matches.map((match, i) => (
                                <div key={match.matchId} style={styles.matchRow}>
                                    <div style={styles.matchIndex}>#{stats.totalMatches - i}</div>
                                    <div style={styles.matchResult}>
                                        <span style={{
                                            ...styles.matchResultBadge,
                                            background: match.result === 'win' ? '#22c55e22' : '#ef444422',
                                            color: match.result === 'win' ? '#22c55e' : '#ef4444',
                                        }}>
                                            {match.result === 'win' ? '✅ Win' : match.result === 'loss' ? '❌ Loss' : '🏳️ Abandoned'}
                                        </span>
                                    </div>
                                    <div style={styles.matchStat}>
                                        <span style={styles.matchStatLabel}>Score</span>
                                        <span style={styles.matchStatValue}>{match.finalScore}</span>
                                    </div>
                                    <div style={styles.matchStat}>
                                        <span style={styles.matchStatLabel}>Accuracy</span>
                                        <span style={styles.matchStatValue}>{match.accuracy.toFixed(1)}%</span>
                                    </div>
                                    <div style={styles.matchStat}>
                                        <span style={styles.matchStatLabel}>Level</span>
                                        <span style={styles.matchStatValue}>{match.maxLevel}</span>
                                    </div>
                                    <div style={styles.matchStat}>
                                        <span style={styles.matchStatLabel}>Speed</span>
                                        <span style={styles.matchStatValue}>{match.avgResponseTimeMs.toFixed(0)}ms</span>
                                    </div>
                                    <div style={styles.matchTime}>
                                        {new Date(match.endedAt).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            {stats.matches.length === 0 && (
                                <div style={styles.emptyState}>No matches recorded yet. Play some games!</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'strategy' && profile && (
                <div style={styles.strategy}>
                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>🧠 Agent Strategy Profile</h3>
                        <p style={styles.strategyDesc}>
                            This is the strategy your AI agent will use when playing for you.
                            It&apos;s generated from your play history and continuously updated.
                        </p>
                        <div style={styles.strategyBox}>
                            <pre style={styles.strategyText}>{profile.strategySummary}</pre>
                        </div>
                    </div>

                    <div style={styles.card}>
                        <h3 style={styles.cardTitle}>How Training Works</h3>
                        <div style={styles.howItWorks}>
                            <div style={styles.step}>
                                <div style={styles.stepNum}>1</div>
                                <div>
                                    <strong>Play manually</strong>
                                    <p style={styles.stepDesc}>Play at least 5 games in the Unity game. Your moves, timing, and accuracy are recorded.</p>
                                </div>
                            </div>
                            <div style={styles.step}>
                                <div style={styles.stepNum}>2</div>
                                <div>
                                    <strong>Profile generated</strong>
                                    <p style={styles.stepDesc}>After 5 games, we analyze your play style — accuracy, speed, stacking patterns, and preferences.</p>
                                </div>
                            </div>
                            <div style={styles.step}>
                                <div style={styles.stepNum}>3</div>
                                <div>
                                    <strong>Agent learns</strong>
                                    <p style={styles.stepDesc}>Your AI agent receives your strategy profile and uses it to play just like you would.</p>
                                </div>
                            </div>
                            <div style={styles.step}>
                                <div style={styles.stepNum}>4</div>
                                <div>
                                    <strong>Continuous improvement</strong>
                                    <p style={styles.stepDesc}>Keep playing! Each game refines the profile, making your agent smarter over time.</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!profile && !loading && (
                <div style={styles.card}>
                    <div style={styles.emptyState}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎮</div>
                        <h3>No training data yet</h3>
                        <p>Play some games in the Unity client to start training your agent.</p>
                        <a href="/agent" style={styles.agentLink}>Go to Agent →</a>
                    </div>
                </div>
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
                body { background: #080c14; }
            `}</style>
        </div>
    )
}

function StatBox({ label, value, icon }: { label: string; value: string; icon: string }) {
    return (
        <div style={styles.statBox}>
            <div style={styles.statIcon}>{icon}</div>
            <div style={styles.statValue}>{value}</div>
            <div style={styles.statLabel}>{label}</div>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1.5rem',
        fontFamily: "'Inter', sans-serif",
        color: '#e2e8f0',
        minHeight: '100vh',
        background: '#080c14',
    },
    connectPrompt: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1.5rem',
        textAlign: 'center',
    },
    connectIcon: { fontSize: '4rem' },
    connectTitle: { fontSize: '2rem', fontWeight: 700, color: '#f1f5f9' },
    connectDesc: { fontSize: '1rem', color: '#64748b', maxWidth: '400px' },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
    },
    title: { fontSize: '1.75rem', fontWeight: 700, color: '#f1f5f9', margin: 0 },
    subtitle: { fontSize: '0.85rem', color: '#64748b', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.25rem' },
    headerActions: { display: 'flex', gap: '0.75rem', alignItems: 'center' },
    refreshBtn: {
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#94a3b8',
        fontSize: '0.8rem',
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
    },
    agentLink: {
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        background: 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.3)',
        color: '#a78bfa',
        fontSize: '0.8rem',
        textDecoration: 'none',
        fontWeight: 500,
    },
    error: {
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.2)',
        color: '#fca5a5',
        fontSize: '0.85rem',
        marginBottom: '1.5rem',
    },
    progressSection: {
        marginBottom: '2rem',
        padding: '1.25rem',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
    },
    progressHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.75rem',
    },
    progressLabel: { fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8' },
    progressValue: { fontSize: '0.85rem', fontFamily: "'JetBrains Mono', monospace", color: '#a78bfa' },
    progressBar: {
        height: '8px',
        borderRadius: '4px',
        background: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: '4px',
        transition: 'width 0.5s ease',
    },
    progressStatus: { marginTop: '0.75rem', fontSize: '0.8rem' },
    readyBadge: { color: '#22c55e', fontWeight: 500 },
    pendingBadge: { color: '#f59e0b', fontWeight: 500 },
    tabs: {
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '1.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        paddingBottom: '0.5rem',
    },
    tab: {
        padding: '0.5rem 1rem',
        borderRadius: '8px',
        background: 'transparent',
        border: '1px solid transparent',
        color: '#64748b',
        fontSize: '0.85rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
    },
    tabActive: {
        background: 'rgba(139,92,246,0.1)',
        borderColor: 'rgba(139,92,246,0.25)',
        color: '#a78bfa',
    },
    overview: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    history: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    strategy: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    card: {
        padding: '1.5rem',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
    },
    cardTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#f1f5f9',
        marginBottom: '1rem',
        marginTop: 0,
    },
    tierDisplay: { textAlign: 'center', marginBottom: '1.5rem' },
    tierBadge: {
        display: 'inline-block',
        padding: '0.5rem 1.5rem',
        borderRadius: '999px',
        fontSize: '1.1rem',
        fontWeight: 600,
        border: '1px solid',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '0.75rem',
    },
    statBox: {
        padding: '1rem',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
    },
    statIcon: { fontSize: '1.5rem', marginBottom: '0.5rem' },
    statValue: { fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9', fontFamily: "'JetBrains Mono', monospace" },
    statLabel: { fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
    levelBars: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    levelBarRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
    levelLabel: { width: '30px', fontSize: '0.75rem', color: '#94a3b8', fontFamily: "'JetBrains Mono', monospace" },
    levelBarTrack: { flex: 1, height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
    levelBarFill: { height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' },
    levelValue: { width: '45px', textAlign: 'right', fontSize: '0.75rem', color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace" },
    levelSamples: { width: '40px', fontSize: '0.65rem', color: '#475569' },
    matchList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    matchRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        flexWrap: 'wrap',
    },
    matchIndex: { width: '40px', fontSize: '0.75rem', color: '#475569', fontFamily: "'JetBrains Mono', monospace" },
    matchResult: {},
    matchResultBadge: {
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.72rem',
        fontWeight: 600,
    },
    matchStat: { textAlign: 'center' as const },
    matchStatLabel: { display: 'block', fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase' as const },
    matchStatValue: { display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#e2e8f0', fontFamily: "'JetBrains Mono', monospace" },
    matchTime: { marginLeft: 'auto', fontSize: '0.7rem', color: '#475569' },
    strategyDesc: { fontSize: '0.85rem', color: '#94a3b8', marginBottom: '1rem', lineHeight: 1.6 },
    strategyBox: {
        padding: '1.25rem',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(139,92,246,0.15)',
    },
    strategyText: {
        fontSize: '0.8rem',
        color: '#c4b5fd',
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'pre-wrap',
        margin: 0,
        lineHeight: 1.8,
    },
    howItWorks: { display: 'flex', flexDirection: 'column', gap: '1rem' },
    step: { display: 'flex', gap: '1rem', alignItems: 'flex-start' },
    stepNum: {
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.3)',
        color: '#a78bfa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '0.85rem',
        flexShrink: 0,
    },
    stepDesc: { fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', lineHeight: 1.5 },
    emptyState: {
        textAlign: 'center',
        padding: '3rem',
        color: '#64748b',
    },
}
