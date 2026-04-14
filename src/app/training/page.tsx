'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from '@solana/connector'
import { ConnectButtonBaseUI } from '@/components/WalletConnect'

interface TrainingProfile {
    wallet: string; totalMatches: number; overallAccuracy: number
    overallAvgResponseTimeMs: number; winRate: number; avgScore: number
    bestScore: number; avgMaxLevel: number; skillTier: string
    stackingStyle: string; speedTier: string; preferredColumns: number[]
    weakColumns: number[]; levelPerformance: { level: number; accuracy: number; avgResponseTimeMs: number; sampleSize: number }[]
    averageFailureLevel: number; consistencyScore: number; improvementTrend: number
    strategySummary: string; computedAt: number
}

interface MatchRecord {
    matchId: string; startedAt: number; endedAt: number; durationSec: number
    finalScore: number; maxLevel: number; totalMoves: number; correctMoves: number
    accuracy: number; avgResponseTimeMs: number; result: string
}

interface TrainingStats {
    wallet: string; totalMatches: number
    aggregates: { wins: number; losses: number; winRate: number; totalScore: number; bestScore: number; avgScore: number; avgAccuracy: number; avgResponseTimeMs: number; totalPlayTimeSec: number; totalPlayTimeFormatted: string }
    recentAccuracy: { matchId: string; accuracy: number; score: number; date: number }[]
    matches: MatchRecord[]
}

interface PlayerStatus {
    wallet: string; matches: number; botUnlocked: boolean
    training: { matchesPlayed: number; matchesRequired: number; ready: boolean; progressPercent: number; hasProfile: boolean; skillTier: string | null; accuracy: number | null }
}

const TIER_CONFIG: Record<string, { color: string; bg: string; border: string; label: string }> = {
    beginner: { color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)', label: 'Beginner' },
    intermediate: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', label: 'Intermediate' },
    advanced: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.15)', label: 'Advanced' },
    expert: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', label: 'Expert' },
    master: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', label: 'Master' },
}

const STYLE_LABELS: Record<string, string> = {
    'center-first': 'Center-First', 'left-to-right': 'Left→Right',
    'right-to-left': 'Right→Left', spread: 'Spread', adaptive: 'Adaptive',
}

export default function TrainingPage() {
    const { address } = useAccount()
    const [status, setStatus] = useState<PlayerStatus | null>(null)
    const [profile, setProfile] = useState<TrainingProfile | null>(null)
    const [stats, setStats] = useState<TrainingStats | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'strategy'>('overview')

    const fetchData = useCallback(async () => {
        if (!address) return
        setLoading(true)
        try {
            const [s, p, st] = await Promise.all([
                fetch(`/api/player/status?wallet=${address}`).then(r => r.json()),
                fetch(`/api/training/profile?wallet=${address}`).then(r => r.json()),
                fetch(`/api/training/stats?wallet=${address}&limit=20`).then(r => r.json()),
            ])
            if (s.training) setStatus(s)
            if (p.profile) setProfile(p.profile)
            if (st.matches) setStats(st)
        } catch {} finally { setLoading(false) }
    }, [address])

    useEffect(() => { fetchData() }, [fetchData])

    if (!address) {
        return (
            <div style={s.page}>
                <div style={s.connectPrompt}>
                    <div style={s.connectIcon}>
                        <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
                            <rect x="2" y="16" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.4" />
                            <rect x="10" y="10" width="8" height="16" rx="2" fill="#8b5cf6" opacity="0.6" />
                            <rect x="18" y="4" width="8" height="22" rx="2" fill="#a78bfa" />
                        </svg>
                    </div>
                    <h1 style={s.connectTitle}>Training Center</h1>
                    <p style={s.connectDesc}>Connect your wallet to view your training profile and agent stats.</p>
                    <ConnectButtonBaseUI />
                </div>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>
            </div>
        )
    }

    const tier = profile ? TIER_CONFIG[profile.skillTier] || TIER_CONFIG.beginner : null

    return (
        <div style={s.page}>
            {/* Header */}
            <nav style={s.nav}>
                <div style={s.navInner}>
                    <div style={s.navLeft}>
                        <a href="/" style={s.logoLink}>
                            <div style={s.logoIcon}>
                                <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                                    <rect x="2" y="16" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.5" />
                                    <rect x="10" y="10" width="8" height="16" rx="2" fill="#8b5cf6" opacity="0.7" />
                                    <rect x="18" y="4" width="8" height="22" rx="2" fill="#a78bfa" />
                                </svg>
                            </div>
                        </a>
                        <div style={s.navDivider} />
                        <span style={s.pageTitle}>Training</span>
                    </div>
                    <div style={s.navRight}>
                        <span style={s.walletBadge}>
                            <span style={s.walletDot} />
                            {address.slice(0, 4)}...{address.slice(-4)}
                        </span>
                        <button style={s.refreshBtn} onClick={fetchData} disabled={loading}>
                            {loading ? '...' : '↻'}
                        </button>
                        <a href="/agent" style={s.agentLink}>Agent →</a>
                    </div>
                </div>
            </nav>

            <div style={s.content}>
                {/* Progress */}
                {status && (
                    <div style={s.progressCard}>
                        <div style={s.progressHeader}>
                            <span style={s.progressLabel}>Agent Training</span>
                            <span style={s.progressValue}>
                                {status.training.matchesPlayed}/{status.training.matchesRequired}
                            </span>
                        </div>
                        <div style={s.progressTrack}>
                            <div style={{
                                ...s.progressFill,
                                width: `${status.training.progressPercent}%`,
                            }} />
                        </div>
                        <div style={s.progressStatus}>
                            {status.training.ready
                                ? <span style={s.readyText}>Agent is trained and ready</span>
                                : <span style={s.pendingText}>{status.training.matchesRequired - status.training.matchesPlayed} more games to train</span>}
                        </div>
                    </div>
                )}

                {/* Tabs */}
                <div style={s.tabs}>
                    {(['overview', 'history', 'strategy'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                ...s.tab,
                                ...(activeTab === tab ? s.tabActive : {}),
                            }}
                        >
                            {tab === 'overview' ? 'Overview' : tab === 'history' ? 'History' : 'Strategy'}
                        </button>
                    ))}
                </div>

                {/* Overview */}
                {activeTab === 'overview' && profile && tier && (
                    <div style={s.grid}>
                        {/* Tier card */}
                        <div style={s.tierCard}>
                            <div style={{
                                ...s.tierBadge,
                                color: tier.color,
                                background: tier.bg,
                                border: `1px solid ${tier.border}`,
                            }}>
                                {tier.label}
                            </div>
                            <div style={s.tierStats}>
                                <Stat label="Accuracy" value={`${profile.overallAccuracy.toFixed(1)}%`} />
                                <Stat label="Win Rate" value={`${profile.winRate.toFixed(1)}%`} />
                                <Stat label="Best Score" value={profile.bestScore.toString()} />
                                <Stat label="Speed" value={profile.speedTier} />
                                <Stat label="Consistency" value={`${profile.consistencyScore.toFixed(0)}/100`} />
                                <Stat label="Avg Level" value={profile.avgMaxLevel.toFixed(1)} />
                            </div>
                        </div>

                        {/* Play style */}
                        <div style={s.card}>
                            <h3 style={s.cardTitle}>Play Style</h3>
                            <div style={s.kvList}>
                                <KV label="Stacking" value={STYLE_LABELS[profile.stackingStyle] || profile.stackingStyle} />
                                <KV label="Preferred Columns" value={profile.preferredColumns.length ? profile.preferredColumns.map(c => c + 1).join(', ') : 'N/A'} />
                                <KV label="Weak Columns" value={profile.weakColumns.length ? profile.weakColumns.map(c => c + 1).join(', ') : 'None'} />
                                <KV label="Trend" value={profile.improvementTrend > 5 ? '↑ Improving' : profile.improvementTrend < -5 ? '↓ Declining' : '→ Stable'} />
                            </div>
                        </div>

                        {/* Level bars */}
                        {profile.levelPerformance.length > 0 && (
                            <div style={{ ...s.card, gridColumn: '1 / -1' }}>
                                <h3 style={s.cardTitle}>Performance by Level</h3>
                                <div style={s.levelBars}>
                                    {profile.levelPerformance.map(lp => (
                                        <div key={lp.level} style={s.levelRow}>
                                            <span style={s.levelLabel}>L{lp.level}</span>
                                            <div style={s.levelTrack}>
                                                <div style={{
                                                    ...s.levelFill,
                                                    width: `${lp.accuracy}%`,
                                                    background: lp.accuracy >= 80 ? '#22c55e' : lp.accuracy >= 60 ? '#f59e0b' : '#ef4444',
                                                }} />
                                            </div>
                                            <span style={s.levelValue}>{lp.accuracy.toFixed(0)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* History */}
                {activeTab === 'history' && stats && (
                    <div style={s.grid}>
                        <div style={s.card}>
                            <h3 style={s.cardTitle}>Lifetime</h3>
                            <div style={s.tierStats}>
                                <Stat label="Matches" value={stats.totalMatches.toString()} />
                                <Stat label="Wins" value={stats.aggregates.wins.toString()} />
                                <Stat label="Total Score" value={stats.aggregates.totalScore.toString()} />
                                <Stat label="Avg Accuracy" value={`${stats.aggregates.avgAccuracy.toFixed(1)}%`} />
                                <Stat label="Play Time" value={stats.aggregates.totalPlayTimeFormatted} />
                                <Stat label="Win Rate" value={`${stats.aggregates.winRate.toFixed(1)}%`} />
                            </div>
                        </div>

                        <div style={{ ...s.card, gridColumn: '1 / -1' }}>
                            <h3 style={s.cardTitle}>Recent Matches</h3>
                            <div style={s.matchList}>
                                {stats.matches.map((m, i) => (
                                    <div key={m.matchId} style={s.matchRow}>
                                        <span style={s.matchIdx}>#{stats.totalMatches - i}</span>
                                        <span style={{
                                            ...s.matchResult,
                                            color: m.result === 'win' ? '#22c55e' : '#ef4444',
                                            background: m.result === 'win' ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                                            border: `1px solid ${m.result === 'win' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
                                        }}>
                                            {m.result}
                                        </span>
                                        <span style={s.matchStat}>{m.finalScore} pts</span>
                                        <span style={s.matchStat}>{m.accuracy.toFixed(0)}%</span>
                                        <span style={s.matchStat}>Lv {m.maxLevel}</span>
                                        <span style={s.matchStat}>{m.avgResponseTimeMs.toFixed(0)}ms</span>
                                        <span style={s.matchTime}>{new Date(m.endedAt).toLocaleDateString()}</span>
                                    </div>
                                ))}
                                {stats.matches.length === 0 && (
                                    <div style={s.empty}>No matches yet. Play some games!</div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Strategy */}
                {activeTab === 'strategy' && profile && (
                    <div style={s.grid}>
                        <div style={s.card}>
                            <h3 style={s.cardTitle}>Agent Strategy</h3>
                            <p style={s.cardDesc}>
                                This profile is what your AI agent uses to play. It&apos;s generated from your play history and updates after each game.
                            </p>
                            <pre style={s.strategyBox}>{profile.strategySummary}</pre>
                        </div>

                        <div style={s.card}>
                            <h3 style={s.cardTitle}>How Training Works</h3>
                            <div style={s.steps}>
                                {[
                                    { n: '01', t: 'Play manually', d: 'Play 5+ games. Every move, timing, and pattern is recorded.' },
                                    { n: '02', t: 'Profile generated', d: 'We analyze accuracy, speed, stacking patterns, and preferences.' },
                                    { n: '03', t: 'Agent learns', d: 'Your AI receives your strategy and plays just like you.' },
                                    { n: '04', t: 'Keep improving', d: 'Each game refines the profile. Your agent gets smarter over time.' },
                                ].map(step => (
                                    <div key={step.n} style={s.step}>
                                        <span style={s.stepNum}>{step.n}</span>
                                        <div>
                                            <div style={s.stepTitle}>{step.t}</div>
                                            <div style={s.stepDesc}>{step.d}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {!profile && !loading && (
                    <div style={s.card}>
                        <div style={s.empty}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎮</div>
                            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f7f8f8', marginBottom: '0.5rem' }}>No training data</div>
                            <div>Play some games to start training your agent.</div>
                            <a href="/agent" style={s.agentLink}>Go to Agent →</a>
                        </div>
                    </div>
                )}
            </div>

            <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');`}</style>
        </div>
    )
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div style={s.stat}>
            <div style={s.statValue}>{value}</div>
            <div style={s.statLabel}>{label}</div>
        </div>
    )
}

function KV({ label, value }: { label: string; value: string }) {
    return (
        <div style={s.kv}>
            <span style={s.kvLabel}>{label}</span>
            <span style={s.kvValue}>{value}</span>
        </div>
    )
}

const s: Record<string, React.CSSProperties> = {
    page: {
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#f7f8f8',
        background: '#08090a',
        minHeight: '100vh',
    },

    /* Nav */
    nav: {
        background: 'rgba(15, 16, 17, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
    },
    navInner: {
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0.6rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    navLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
    logoLink: { textDecoration: 'none', display: 'flex' },
    logoIcon: {
        width: '32px', height: '32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(124,58,237,0.08)',
        borderRadius: '8px',
        border: '1px solid rgba(124,58,237,0.15)',
    },
    navDivider: { width: '1px', height: '20px', background: 'rgba(255,255,255,0.06)' },
    pageTitle: {
        fontSize: '0.85rem', fontWeight: 600,
        color: '#f7f8f8', letterSpacing: '-0.01em',
    },
    navRight: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
    walletBadge: {
        display: 'flex', alignItems: 'center', gap: '0.35rem',
        padding: '0.25rem 0.6rem',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.7rem', color: '#8a8f98',
        fontFamily: "'JetBrains Mono', monospace",
    },
    walletDot: {
        width: '5px', height: '5px', borderRadius: '50%',
        background: '#22c55e',
    },
    refreshBtn: {
        width: '32px', height: '32px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: '#62666d',
        fontSize: '0.85rem',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    agentLink: {
        padding: '0.35rem 0.75rem',
        borderRadius: '8px',
        background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.15)',
        color: '#a78bfa',
        fontSize: '0.75rem',
        textDecoration: 'none',
        fontWeight: 500,
    },

    /* Connect */
    connectPrompt: {
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '70vh',
        gap: '1rem', textAlign: 'center',
        padding: '2rem',
    },
    connectIcon: {
        width: '80px', height: '80px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(124,58,237,0.06)',
        borderRadius: '20px',
        border: '1px solid rgba(124,58,237,0.1)',
        marginBottom: '0.5rem',
    },
    connectTitle: {
        fontSize: '1.75rem', fontWeight: 700,
        color: '#f7f8f8', letterSpacing: '-0.03em',
    },
    connectDesc: { fontSize: '0.9rem', color: '#8a8f98', maxWidth: '400px' },

    /* Content */
    content: {
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '1.5rem',
    },

    /* Progress */
    progressCard: {
        padding: '1rem 1.25rem',
        borderRadius: '12px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: '1.25rem',
    },
    progressHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '0.6rem',
    },
    progressLabel: {
        fontSize: '0.78rem', fontWeight: 600,
        color: '#8a8f98',
    },
    progressValue: {
        fontSize: '0.78rem',
        fontFamily: "'JetBrains Mono', monospace",
        color: '#a78bfa',
    },
    progressTrack: {
        height: '4px',
        borderRadius: '2px',
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: '2px',
        background: 'linear-gradient(90deg, #7c3aed, #22c55e)',
        transition: 'width 0.6s ease',
    },
    progressStatus: { marginTop: '0.5rem', fontSize: '0.72rem' },
    readyText: { color: '#22c55e', fontWeight: 500 },
    pendingText: { color: '#f59e0b', fontWeight: 500 },

    /* Tabs */
    tabs: {
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '1.25rem',
        padding: '0.2rem',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '10px',
        border: '1px solid rgba(255,255,255,0.04)',
    },
    tab: {
        padding: '0.4rem 1rem',
        borderRadius: '8px',
        background: 'transparent',
        border: 'none',
        color: '#62666d',
        fontSize: '0.78rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.15s',
        flex: 1,
        textAlign: 'center' as const,
    },
    tabActive: {
        background: 'rgba(124,58,237,0.1)',
        color: '#a78bfa',
        boxShadow: '0 0 0 1px rgba(124,58,237,0.15)',
    },

    /* Grid */
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1rem',
    },

    /* Cards */
    card: {
        padding: '1.25rem',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
    },
    cardTitle: {
        fontSize: '0.85rem', fontWeight: 600,
        color: '#f7f8f8',
        letterSpacing: '-0.01em',
        marginBottom: '0.75rem',
        marginTop: 0,
    },
    cardDesc: {
        fontSize: '0.8rem', color: '#8a8f98',
        lineHeight: 1.6, marginBottom: '1rem',
    },
    tierCard: {
        padding: '1.5rem',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'center' as const,
    },
    tierBadge: {
        display: 'inline-block',
        padding: '0.4rem 1.25rem',
        borderRadius: '999px',
        fontSize: '0.9rem',
        fontWeight: 600,
        marginBottom: '1.25rem',
        letterSpacing: '-0.01em',
    },
    tierStats: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
    },
    stat: {
        padding: '0.75rem',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.04)',
        textAlign: 'center' as const,
    },
    statValue: {
        fontSize: '1rem', fontWeight: 600,
        color: '#f7f8f8',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '-0.02em',
    },
    statLabel: {
        fontSize: '0.6rem', color: '#62666d',
        marginTop: '0.15rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        fontWeight: 500,
    },

    /* KV list */
    kvList: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
    kv: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 0.75rem',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.02)',
    },
    kvLabel: { fontSize: '0.75rem', color: '#62666d', fontWeight: 500 },
    kvValue: { fontSize: '0.75rem', color: '#f7f8f8', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" },

    /* Level bars */
    levelBars: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
    levelRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
    levelLabel: {
        width: '28px', fontSize: '0.7rem',
        color: '#8a8f98', fontFamily: "'JetBrains Mono', monospace",
    },
    levelTrack: {
        flex: 1, height: '4px', borderRadius: '2px',
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    levelFill: {
        height: '100%', borderRadius: '2px',
        transition: 'width 0.4s ease',
    },
    levelValue: {
        width: '40px', textAlign: 'right' as const,
        fontSize: '0.7rem', color: '#f7f8f8',
        fontFamily: "'JetBrains Mono', monospace",
    },

    /* Match list */
    matchList: { display: 'flex', flexDirection: 'column', gap: '0.35rem' },
    matchRow: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.6rem 0.75rem',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.015)',
        border: '1px solid rgba(255,255,255,0.03)',
    },
    matchIdx: {
        width: '36px', fontSize: '0.68rem',
        color: '#3e3e44',
        fontFamily: "'JetBrains Mono', monospace",
    },
    matchResult: {
        padding: '0.1rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.62rem',
        fontWeight: 600,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
    },
    matchStat: {
        fontSize: '0.72rem', color: '#d0d6e0',
        fontFamily: "'JetBrains Mono', monospace",
    },
    matchTime: {
        marginLeft: 'auto',
        fontSize: '0.65rem', color: '#3e3e44',
    },

    /* Strategy */
    strategyBox: {
        padding: '1rem',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(124,58,237,0.1)',
        fontSize: '0.72rem',
        color: '#c4b5fd',
        fontFamily: "'JetBrains Mono', monospace",
        whiteSpace: 'pre-wrap' as const,
        margin: 0,
        lineHeight: 1.8,
    },
    steps: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
    step: { display: 'flex', gap: '0.75rem' },
    stepNum: {
        width: '28px', height: '28px',
        borderRadius: '8px',
        background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.12)',
        color: '#a78bfa',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '0.68rem', fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0,
    },
    stepTitle: { fontSize: '0.8rem', fontWeight: 600, color: '#f7f8f8', marginBottom: '0.15rem' },
    stepDesc: { fontSize: '0.75rem', color: '#8a8f98', lineHeight: 1.5 },

    /* Empty */
    empty: {
        textAlign: 'center' as const,
        padding: '3rem',
        color: '#62666d',
        fontSize: '0.85rem',
    },
}
