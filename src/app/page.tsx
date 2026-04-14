'use client'

import { useAccount } from '@solana/connector'
import { ConnectButtonBaseUI } from '@/components/WalletConnect'

export default function Home() {
    const { address } = useAccount()

    return (
        <div style={styles.container}>
            {/* Nav */}
            <nav style={styles.nav}>
                <div style={styles.logo}>
                    <span style={styles.logoIcon}>🎮</span>
                    <span style={styles.logoText}>StakeStack</span>
                </div>
                <div style={styles.navLinks}>
                    <a href="/agent" style={styles.navLink}>Agent</a>
                    <a href="/training" style={styles.navLink}>Training</a>
                    <ConnectButtonBaseUI />
                </div>
            </nav>

            {/* Hero */}
            <section style={styles.hero}>
                <div style={styles.heroBadge}>🧠 AI-Powered Tile Stacking</div>
                <h1 style={styles.heroTitle}>
                    Your Agent.<br />
                    Your Play Style.<br />
                    <span style={styles.heroAccent}>Your Rules.</span>
                </h1>
                <p style={styles.heroDesc}>
                    Play tile-stacking games, train your AI agent with your unique strategy,
                    and let it compete autonomously on Solana.
                </p>
                <div style={styles.heroCTA}>
                    {address ? (
                        <>
                            <a href="/agent" style={styles.primaryBtn}>Open Agent →</a>
                            <a href="/training" style={styles.secondaryBtn}>View Training</a>
                        </>
                    ) : (
                        <>
                            <ConnectButtonBaseUI />
                            <span style={styles.ctaHint}>Connect wallet to start training</span>
                        </>
                    )}
                </div>
            </section>

            {/* How it works */}
            <section style={styles.section}>
                <h2 style={styles.sectionTitle}>How It Works</h2>
                <div style={styles.steps}>
                    <div style={styles.step}>
                        <div style={styles.stepIcon}>🎮</div>
                        <h3 style={styles.stepTitle}>1. Play</h3>
                        <p style={styles.stepDesc}>
                            Play the tile-stacking game manually in the Unity WebGL client.
                            Every move is recorded.
                        </p>
                    </div>
                    <div style={styles.step}>
                        <div style={styles.stepIcon}>📊</div>
                        <h3 style={styles.stepTitle}>2. Train</h3>
                        <p style={styles.stepDesc}>
                            After 5 games, we analyze your accuracy, speed, stacking patterns,
                            and build your agent&apos;s strategy profile.
                        </p>
                    </div>
                    <div style={styles.step}>
                        <div style={styles.stepIcon}>🤖</div>
                        <h3 style={styles.stepTitle}>3. Deploy</h3>
                        <p style={styles.stepDesc}>
                            Your AI agent plays autonomously using your trained profile.
                            It stacks tiles just like you would.
                        </p>
                    </div>
                    <div style={styles.step}>
                        <div style={styles.stepIcon}>🏆</div>
                        <h3 style={styles.stepTitle}>4. Compete</h3>
                        <p style={styles.stepDesc}>
                            Challenge other agents, climb leaderboards, and earn rewards
                            on Solana.
                        </p>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section style={styles.section}>
                <h2 style={styles.sectionTitle}>Features</h2>
                <div style={styles.features}>
                    <div style={styles.feature}>
                        <div style={styles.featureIcon}>🧠</div>
                        <h3 style={styles.featureTitle}>Agent Training</h3>
                        <p style={styles.featureDesc}>
                            Your agent learns from your gameplay — accuracy, speed, stacking style,
                            column preferences, and more.
                        </p>
                    </div>
                    <div style={styles.feature}>
                        <div style={styles.featureIcon}>⚡</div>
                        <h3 style={styles.featureTitle}>Real-time Control</h3>
                        <p style={styles.featureDesc}>
                            Chat with your agent to control the Unity game in real-time via
                            SSE bridge — no page reloads.
                        </p>
                    </div>
                    <div style={styles.feature}>
                        <div style={styles.featureIcon}>💰</div>
                        <h3 style={styles.featureTitle}>Solana MPP</h3>
                        <p style={styles.featureDesc}>
                            Micropayments on Solana Devnet. Pay 1 USDC for premium data.
                            Agent handles payments autonomously.
                        </p>
                    </div>
                    <div style={styles.feature}>
                        <div style={styles.featureIcon}>🔗</div>
                        <h3 style={styles.featureTitle}>Seamless Wallet</h3>
                        <p style={styles.featureDesc}>
                            Connect once, use everywhere. Wallet is shared between the web UI,
                            Unity game, and AI agent.
                        </p>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer style={styles.footer}>
                <p style={styles.footerText}>StakeStack · Built on Solana · Powered by AI</p>
            </footer>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
                body { background: #080c14; margin: 0; }
                * { box-sizing: border-box; }
            `}</style>
        </div>
    )
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        fontFamily: "'Inter', sans-serif",
        color: '#e2e8f0',
        minHeight: '100vh',
        background: '#080c14',
    },
    nav: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 2rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    logo: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
    logoIcon: { fontSize: '1.5rem' },
    logoText: { fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9' },
    navLinks: { display: 'flex', alignItems: 'center', gap: '1.5rem' },
    navLink: {
        fontSize: '0.85rem',
        color: '#94a3b8',
        textDecoration: 'none',
        fontWeight: 500,
    },
    hero: {
        textAlign: 'center',
        padding: '6rem 2rem 4rem',
        maxWidth: '800px',
        margin: '0 auto',
    },
    heroBadge: {
        display: 'inline-block',
        padding: '0.4rem 1rem',
        borderRadius: '999px',
        background: 'rgba(139,92,246,0.1)',
        border: '1px solid rgba(139,92,246,0.2)',
        color: '#a78bfa',
        fontSize: '0.8rem',
        fontWeight: 500,
        marginBottom: '2rem',
    },
    heroTitle: {
        fontSize: '3.5rem',
        fontWeight: 800,
        color: '#f1f5f9',
        lineHeight: 1.1,
        marginBottom: '1.5rem',
    },
    heroAccent: {
        background: 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
    },
    heroDesc: {
        fontSize: '1.15rem',
        color: '#94a3b8',
        lineHeight: 1.7,
        maxWidth: '600px',
        margin: '0 auto 2.5rem',
    },
    heroCTA: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        flexWrap: 'wrap',
    },
    primaryBtn: {
        padding: '0.75rem 2rem',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        color: '#fff',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '0.95rem',
        boxShadow: '0 4px 14px rgba(124,58,237,0.3)',
    },
    secondaryBtn: {
        padding: '0.75rem 2rem',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        color: '#94a3b8',
        textDecoration: 'none',
        fontWeight: 500,
        fontSize: '0.95rem',
    },
    ctaHint: { fontSize: '0.8rem', color: '#64748b' },
    section: {
        padding: '4rem 2rem',
        maxWidth: '1100px',
        margin: '0 auto',
    },
    sectionTitle: {
        fontSize: '2rem',
        fontWeight: 700,
        color: '#f1f5f9',
        textAlign: 'center',
        marginBottom: '3rem',
    },
    steps: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1.5rem',
    },
    step: {
        padding: '2rem',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        textAlign: 'center',
    },
    stepIcon: { fontSize: '2.5rem', marginBottom: '1rem' },
    stepTitle: { fontSize: '1.1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' },
    stepDesc: { fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 },
    features: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1.5rem',
    },
    feature: {
        padding: '2rem',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
    },
    featureIcon: { fontSize: '2rem', marginBottom: '1rem' },
    featureTitle: { fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' },
    featureDesc: { fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, margin: 0 },
    footer: {
        padding: '2rem',
        textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.06)',
    },
    footerText: { fontSize: '0.8rem', color: '#334155' },
}
