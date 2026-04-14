'use client'

import { useAccount } from '@solana/connector'
import { ConnectButtonBaseUI } from '@/components/WalletConnect'

export default function Home() {
    const { address } = useAccount()

    return (
        <div style={s.page}>
            {/* ── Nav ──────────────────────────────────────── */}
            <nav style={s.nav}>
                <div style={s.navInner}>
                    <div style={s.logo}>
                        <div style={s.logoIcon}>
                            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="16" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.5" />
                                <rect x="10" y="10" width="8" height="16" rx="2" fill="#8b5cf6" opacity="0.7" />
                                <rect x="18" y="4" width="8" height="22" rx="2" fill="#a78bfa" />
                            </svg>
                        </div>
                        <span style={s.logoText}>StakeStack</span>
                    </div>
                    <div style={s.navLinks}>
                        <a href="/agent" style={s.navLink}>
                            <span style={s.navLinkIcon}>⚡</span> Agent
                        </a>
                        <a href="/training" style={s.navLink}>
                            <span style={s.navLinkIcon}>🧠</span> Training
                        </a>
                        <div style={s.navDivider} />
                        <ConnectButtonBaseUI />
                    </div>
                </div>
            </nav>

            {/* ── Hero ─────────────────────────────────────── */}
            <section style={s.hero}>
                <div style={s.heroGlow} />
                <div style={s.heroContent}>
                    <div style={s.heroBadge}>
                        <span style={s.heroBadgeDot} />
                        AI-Powered Tile Stacking on Solana
                    </div>
                    <h1 style={s.heroTitle}>
                        Your Agent.<br />
                        Your Play Style.<br />
                        <span style={s.gradientText}>Your Rules.</span>
                    </h1>
                    <p style={s.heroDesc}>
                        Play tile-stacking games. Train your AI agent with your unique strategy.
                        Let it compete autonomously on Solana.
                    </p>
                    <div style={s.heroCTA}>
                        {address ? (
                            <>
                                <a href="/agent" style={s.primaryBtn}>
                                    <span style={s.btnIcon}>⚡</span>
                                    Open Agent
                                    <span style={s.btnArrow}>→</span>
                                </a>
                                <a href="/training" style={s.ghostBtn}>
                                    View Training
                                </a>
                            </>
                        ) : (
                            <>
                                <div style={s.primaryBtnWrap}>
                                    <ConnectButtonBaseUI />
                                </div>
                                <span style={s.ctaHint}>Connect wallet to start training</span>
                            </>
                        )}
                    </div>

                    {/* Stats bar */}
                    <div style={s.statsBar}>
                        <div style={s.statItem}>
                            <span style={s.statValue}>5</span>
                            <span style={s.statLabel}>Games to Train</span>
                        </div>
                        <div style={s.statDivider} />
                        <div style={s.statItem}>
                            <span style={s.statValue}>87%</span>
                            <span style={s.statLabel}>Avg Agent Accuracy</span>
                        </div>
                        <div style={s.statDivider} />
                        <div style={s.statItem}>
                            <span style={s.statValue}>1 USDC</span>
                            <span style={s.statLabel}>Per Paid Call</span>
                        </div>
                        <div style={s.statDivider} />
                        <div style={s.statItem}>
                            <span style={s.statValue}>Solana</span>
                            <span style={s.statLabel}>Devnet</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ── How it Works ─────────────────────────────── */}
            <section style={s.section}>
                <div style={s.sectionInner}>
                    <div style={s.sectionHeader}>
                        <span style={s.sectionOverline}>How It Works</span>
                        <h2 style={s.sectionTitle}>Play. Train. Deploy. Compete.</h2>
                        <p style={s.sectionDesc}>
                            Four steps to an autonomous agent that plays exactly like you.
                        </p>
                    </div>
                    <div style={s.stepsGrid}>
                        {STEPS.map((step, i) => (
                            <div key={i} style={{ ...s.stepCard, animationDelay: `${i * 0.1}s` }}>
                                <div style={s.stepNumber}>{String(i + 1).padStart(2, '0')}</div>
                                <div style={{ ...s.stepIcon, background: step.glow }}>{step.icon}</div>
                                <h3 style={s.stepTitle}>{step.title}</h3>
                                <p style={s.stepDesc}>{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ─────────────────────────────────── */}
            <section style={{ ...s.section, background: '#0a0b0c' }}>
                <div style={s.sectionInner}>
                    <div style={s.sectionHeader}>
                        <span style={s.sectionOverline}>Features</span>
                        <h2 style={s.sectionTitle}>Everything you need</h2>
                        <p style={s.sectionDesc}>
                            Built for competitive AI gaming on Solana.
                        </p>
                    </div>
                    <div style={s.featuresGrid}>
                        {FEATURES.map((feat, i) => (
                            <div key={i} style={{ ...s.featureCard, animationDelay: `${i * 0.08}s` }}>
                                <div style={s.featureHeader}>
                                    <span style={s.featureIcon}>{feat.icon}</span>
                                    <span style={s.featureTag}>{feat.tag}</span>
                                </div>
                                <h3 style={s.featureTitle}>{feat.title}</h3>
                                <p style={s.featureDesc}>{feat.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── CTA Section ──────────────────────────────── */}
            <section style={s.ctaSection}>
                <div style={s.ctaInner}>
                    <div style={s.ctaGlow} />
                    <h2 style={s.ctaTitle}>Ready to train your agent?</h2>
                    <p style={s.ctaDesc}>
                        Connect your wallet, play 5 games, and watch your AI agent take over.
                    </p>
                    <div style={s.ctaActions}>
                        {address ? (
                            <a href="/agent" style={s.primaryBtn}>
                                <span style={s.btnIcon}>⚡</span>
                                Launch Agent
                                <span style={s.btnArrow}>→</span>
                            </a>
                        ) : (
                            <ConnectButtonBaseUI />
                        )}
                    </div>
                </div>
            </section>

            {/* ── Footer ───────────────────────────────────── */}
            <footer style={s.footer}>
                <div style={s.footerInner}>
                    <div style={s.footerLeft}>
                        <div style={s.footerLogo}>
                            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="16" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.5" />
                                <rect x="10" y="10" width="8" height="16" rx="2" fill="#8b5cf6" opacity="0.7" />
                                <rect x="18" y="4" width="8" height="22" rx="2" fill="#a78bfa" />
                            </svg>
                            <span style={s.footerLogoText}>StakeStack</span>
                        </div>
                        <span style={s.footerCopy}>© 2026 Rupture Labs</span>
                    </div>
                    <div style={s.footerLinks}>
                        <a href="/agent" style={s.footerLink}>Agent</a>
                        <a href="/training" style={s.footerLink}>Training</a>
                    </div>
                </div>
            </footer>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            `}</style>
        </div>
    )
}

const STEPS = [
    {
        icon: '🎮',
        title: 'Play',
        desc: 'Play the tile-stacking game manually. Every move, timing, and pattern is recorded.',
        glow: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(124,58,237,0.05))',
    },
    {
        icon: '📊',
        title: 'Train',
        desc: 'After 5 games, we analyze accuracy, speed, and stacking patterns to build your profile.',
        glow: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(6,182,212,0.05))',
    },
    {
        icon: '🤖',
        title: 'Deploy',
        desc: 'Your AI agent plays autonomously using your trained profile — just like you would.',
        glow: 'linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))',
    },
    {
        icon: '🏆',
        title: 'Compete',
        desc: 'Challenge other agents, climb leaderboards, and earn rewards on Solana.',
        glow: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))',
    },
]

const FEATURES = [
    {
        icon: '🧠',
        tag: 'Training',
        title: 'Agent Training',
        desc: 'Your agent learns your accuracy, speed, stacking style, column preferences, and patterns.',
    },
    {
        icon: '⚡',
        tag: 'Real-time',
        title: 'Live Game Bridge',
        desc: 'SSE-powered bridge between web UI and Unity — instant commands, live state sync.',
    },
    {
        icon: '🔗',
        tag: 'Seamless',
        title: 'Unified Wallet',
        desc: 'Connect once, shared everywhere. Web UI, Unity game, and AI agent all use the same wallet.',
    },
    {
        icon: '💰',
        tag: 'Solana',
        title: 'MPP Payments',
        desc: 'Micropayments on Solana Devnet. Agent handles 1 USDC payments autonomously.',
    },
    {
        icon: '📈',
        tag: 'Analytics',
        title: 'Performance Tracking',
        desc: 'Accuracy by level, response time trends, consistency scores, improvement tracking.',
    },
    {
        icon: '🎯',
        tag: 'Strategy',
        title: 'Style Detection',
        desc: 'Auto-detects center-first, left-to-right, spread, or adaptive stacking strategies.',
    },
]

/* ── Styles (Linear-inspired premium dark) ──────────────────────── */

const s: Record<string, React.CSSProperties> = {
    page: {
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        color: '#f7f8f8',
        background: '#08090a',
        minHeight: '100vh',
        overflow: 'hidden',
    },

    /* ── Nav ── */
    nav: {
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(8, 9, 10, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    navInner: {
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0.75rem 2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    logo: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
    logoIcon: {
        width: '36px',
        height: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(124,58,237,0.1)',
        borderRadius: '10px',
        border: '1px solid rgba(124,58,237,0.2)',
    },
    logoText: {
        fontSize: '1.05rem',
        fontWeight: 600,
        color: '#f7f8f8',
        letterSpacing: '-0.02em',
    },
    navLinks: { display: 'flex', alignItems: 'center', gap: '0.25rem' },
    navLink: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.35rem',
        padding: '0.4rem 0.8rem',
        borderRadius: '8px',
        fontSize: '0.82rem',
        fontWeight: 500,
        color: '#8a8f98',
        textDecoration: 'none',
        transition: 'all 0.15s ease',
    },
    navLinkIcon: { fontSize: '0.9rem' },
    navDivider: {
        width: '1px',
        height: '20px',
        background: 'rgba(255,255,255,0.06)',
        margin: '0 0.5rem',
    },

    /* ── Hero ── */
    hero: {
        position: 'relative',
        textAlign: 'center',
        padding: '8rem 2rem 6rem',
        overflow: 'hidden',
    },
    heroGlow: {
        position: 'absolute',
        top: '-200px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '800px',
        height: '600px',
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    heroContent: {
        position: 'relative',
        zIndex: 1,
        maxWidth: '800px',
        margin: '0 auto',
        animation: 'fadeUp 0.6s ease-out',
    },
    heroBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.35rem 1rem',
        borderRadius: '999px',
        background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.15)',
        color: '#a78bfa',
        fontSize: '0.78rem',
        fontWeight: 500,
        marginBottom: '2rem',
        letterSpacing: '0.01em',
    },
    heroBadgeDot: {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#7c3aed',
        boxShadow: '0 0 8px rgba(124,58,237,0.5)',
    },
    heroTitle: {
        fontSize: 'clamp(2.5rem, 5vw, 3.75rem)',
        fontWeight: 700,
        color: '#f7f8f8',
        lineHeight: 1.08,
        letterSpacing: '-0.035em',
        marginBottom: '1.5rem',
    },
    gradientText: {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 50%, #22c55e 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        backgroundSize: '200% 200%',
        animation: 'gradientShift 6s ease infinite',
    },
    heroDesc: {
        fontSize: '1.1rem',
        color: '#8a8f98',
        lineHeight: 1.7,
        maxWidth: '560px',
        margin: '0 auto 2.5rem',
        fontWeight: 400,
    },
    heroCTA: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
        marginBottom: '4rem',
    },
    primaryBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.7rem 1.5rem',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        color: '#fff',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '0.9rem',
        letterSpacing: '-0.01em',
        boxShadow: '0 4px 20px rgba(124,58,237,0.25), 0 0 0 1px rgba(124,58,237,0.1)',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
        border: 'none',
    },
    primaryBtnWrap: {
        display: 'inline-flex',
    },
    btnIcon: { fontSize: '1rem' },
    btnArrow: {
        fontSize: '0.9rem',
        transition: 'transform 0.2s ease',
    },
    ghostBtn: {
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.7rem 1.5rem',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#d0d6e0',
        textDecoration: 'none',
        fontWeight: 500,
        fontSize: '0.9rem',
        transition: 'all 0.2s ease',
        cursor: 'pointer',
    },
    ctaHint: { fontSize: '0.78rem', color: '#62666d' },

    /* Stats bar */
    statsBar: {
        display: 'flex',
        justifyContent: 'center',
        gap: '0',
        padding: '1.25rem 2rem',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        maxWidth: '700px',
        margin: '0 auto',
        animation: 'fadeUp 0.8s ease-out 0.3s both',
    },
    statItem: {
        flex: 1,
        textAlign: 'center',
    },
    statValue: {
        display: 'block',
        fontSize: '1.1rem',
        fontWeight: 600,
        color: '#f7f8f8',
        letterSpacing: '-0.02em',
        fontFamily: "'JetBrains Mono', monospace",
    },
    statLabel: {
        display: 'block',
        fontSize: '0.68rem',
        color: '#62666d',
        marginTop: '0.2rem',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.06em',
        fontWeight: 500,
    },
    statDivider: {
        width: '1px',
        height: '36px',
        background: 'rgba(255,255,255,0.06)',
    },

    /* ── Sections ── */
    section: {
        padding: '6rem 2rem',
    },
    sectionInner: {
        maxWidth: '1100px',
        margin: '0 auto',
    },
    sectionHeader: {
        textAlign: 'center',
        marginBottom: '4rem',
    },
    sectionOverline: {
        display: 'block',
        fontSize: '0.72rem',
        fontWeight: 600,
        color: '#7c3aed',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.1em',
        marginBottom: '0.75rem',
    },
    sectionTitle: {
        fontSize: 'clamp(1.75rem, 3vw, 2.25rem)',
        fontWeight: 700,
        color: '#f7f8f8',
        letterSpacing: '-0.03em',
        marginBottom: '0.75rem',
    },
    sectionDesc: {
        fontSize: '1rem',
        color: '#8a8f98',
        lineHeight: 1.6,
        maxWidth: '480px',
        margin: '0 auto',
    },

    /* ── Steps ── */
    stepsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem',
    },
    stepCard: {
        padding: '1.75rem',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        transition: 'all 0.3s ease',
        animation: 'fadeUp 0.5s ease-out both',
    },
    stepNumber: {
        fontSize: '0.68rem',
        fontWeight: 600,
        color: '#62666d',
        fontFamily: "'JetBrains Mono', monospace",
        letterSpacing: '0.05em',
        marginBottom: '1rem',
    },
    stepIcon: {
        width: '48px',
        height: '48px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.4rem',
        marginBottom: '1rem',
    },
    stepTitle: {
        fontSize: '1.05rem',
        fontWeight: 600,
        color: '#f7f8f8',
        letterSpacing: '-0.02em',
        marginBottom: '0.5rem',
    },
    stepDesc: {
        fontSize: '0.85rem',
        color: '#8a8f98',
        lineHeight: 1.6,
        margin: 0,
    },

    /* ── Features ── */
    featuresGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1rem',
    },
    featureCard: {
        padding: '1.5rem',
        borderRadius: '14px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        transition: 'all 0.3s ease',
        animation: 'fadeUp 0.5s ease-out both',
    },
    featureHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '1rem',
    },
    featureIcon: {
        fontSize: '1.5rem',
    },
    featureTag: {
        fontSize: '0.65rem',
        fontWeight: 600,
        color: '#7c3aed',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        background: 'rgba(124,58,237,0.08)',
        border: '1px solid rgba(124,58,237,0.12)',
    },
    featureTitle: {
        fontSize: '1rem',
        fontWeight: 600,
        color: '#f7f8f8',
        letterSpacing: '-0.01em',
        marginBottom: '0.4rem',
    },
    featureDesc: {
        fontSize: '0.85rem',
        color: '#8a8f98',
        lineHeight: 1.6,
        margin: 0,
    },

    /* ── CTA ── */
    ctaSection: {
        padding: '6rem 2rem',
        position: 'relative',
        overflow: 'hidden',
    },
    ctaInner: {
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '4rem 2rem',
        borderRadius: '20px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
    },
    ctaGlow: {
        position: 'absolute',
        top: '-100px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '400px',
        height: '300px',
        background: 'radial-gradient(ellipse, rgba(124,58,237,0.1) 0%, transparent 70%)',
        pointerEvents: 'none',
    },
    ctaTitle: {
        fontSize: '2rem',
        fontWeight: 700,
        color: '#f7f8f8',
        letterSpacing: '-0.03em',
        marginBottom: '0.75rem',
    },
    ctaDesc: {
        fontSize: '1rem',
        color: '#8a8f98',
        lineHeight: 1.6,
        marginBottom: '2rem',
    },
    ctaActions: {
        display: 'flex',
        justifyContent: 'center',
    },

    /* ── Footer ── */
    footer: {
        borderTop: '1px solid rgba(255,255,255,0.05)',
        padding: '2rem',
    },
    footerInner: {
        maxWidth: '1100px',
        margin: '0 auto',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    footerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
    },
    footerLogo: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
    },
    footerLogoText: {
        fontSize: '0.85rem',
        fontWeight: 600,
        color: '#f7f8f8',
    },
    footerCopy: {
        fontSize: '0.75rem',
        color: '#62666d',
    },
    footerLinks: {
        display: 'flex',
        gap: '1.5rem',
    },
    footerLink: {
        fontSize: '0.8rem',
        color: '#8a8f98',
        textDecoration: 'none',
        fontWeight: 500,
    },
}
