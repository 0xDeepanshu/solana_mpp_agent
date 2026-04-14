'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAccount } from '@solana/connector'
import { ConnectButtonBaseUI } from '@/components/WalletConnect'

interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
    gameAction?: string | null
    paymentMade?: boolean
    trainingProfile?: { skillTier: string; accuracy: number; matchesTrained: number } | null
}

interface AgentStatus {
    type: 'idle' | 'thinking' | 'paying' | 'gaming' | 'fetching' | 'done' | 'error'
    detail?: string
}

interface TrainingStatus {
    matchesPlayed: number
    matchesRequired: number
    ready: boolean
    skillTier: string | null
    accuracy: number | null
}

const GAME_QUICK_PROMPTS = [
    { label: '▶ Bot Match', msg: 'Start a bot match in StakeStack' },
    { label: '🎯 Practice', msg: 'Start practice mode' },
    { label: '🏠 Menu', msg: 'Go to main menu' },
    { label: '📊 Stats', msg: 'Get my practice stats' },
]

const DATA_QUICK_PROMPTS = [
    { label: 'Fetch data', msg: 'Fetch the paid data' },
    { label: 'Pay & get', msg: 'Pay and get me the data' },
]

const TRAINING_QUICK_PROMPTS = [
    { label: '🧠 Profile', msg: 'Show my training profile' },
    { label: '📈 Progress', msg: 'How is my agent training going?' },
]

export default function AgentPage() {
    const { address } = useAccount()
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'system',
            content:
                'Agent online. I can play the StakeStack Unity game autonomously and make Solana MPP payments.\n\nPlay games to train your agent — after 5 games, I learn your play style and play just like you!',
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [status, setStatus] = useState<AgentStatus>({ type: 'idle' })
    const [unityLoaded, setUnityLoaded] = useState(false)
    const [splitView, setSplitView] = useState(true)
    const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null)
    const [gameState, setGameState] = useState<{
        status: string; score: number; level: number; moves: number; accuracy: number
    } | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    useEffect(() => {
        if (!address) { setTrainingStatus(null); return }
        fetch(`/api/player/status?wallet=${address}`)
            .then(r => r.json())
            .then(data => { if (data.training) setTrainingStatus(data.training) })
            .catch(() => {})
    }, [address])

    useEffect(() => {
        const es = new EventSource('/api/game')
        es.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type === 'gameState' && data.state) {
                    setGameState({
                        status: data.state.status,
                        score: data.state.score,
                        level: data.state.level,
                        moves: data.state.moves,
                        accuracy: data.state.accuracy,
                    })
                }
            } catch {}
        }
        return () => es.close()
    }, [])

    useEffect(() => {
        if (!address) return
        fetch('/api/game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'registerWallet', wallet: address }),
        }).catch(() => {})
    }, [address])

    const sendMessage = useCallback(
        async (text?: string) => {
            const msg = (text ?? input).trim()
            if (!msg || status.type !== 'idle') return

            const isGameCmd = /bot.?match|practice|main.?menu|stats|vs bot|play bot|go back/i.test(msg)

            const userMsg: Message = {
                id: crypto.randomUUID(),
                role: 'user',
                content: msg,
                timestamp: new Date(),
            }
            setMessages(prev => [...prev, userMsg])
            setInput('')
            setStatus({ type: isGameCmd ? 'gaming' : 'thinking' })

            try {
                if (!isGameCmd && /data|fetch|paid|content|get|show|give|retrieve|access/i.test(msg)) {
                    setStatus({ type: 'paying' })
                }

                const res = await fetch('/api/agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg, wallet: address }),
                })
                const data = await res.json()
                if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error')

                let replyContent = data.reply
                if (data.paymentMade) replyContent = `Payment made: 1 USDC on Solana Devnet\n\n${data.reply}`
                if (data.gameAction) replyContent = `Game command: ${data.gameCmdResult}\n\n${data.reply}`

                setMessages(prev => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: replyContent,
                        timestamp: new Date(),
                        gameAction: data.gameAction,
                        paymentMade: data.paymentMade,
                        trainingProfile: data.trainingProfile,
                    },
                ])
                setStatus({ type: 'done' })
                setTimeout(() => setStatus({ type: 'idle' }), 1500)
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                setMessages(prev => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: `Error: ${errMsg}`,
                        timestamp: new Date(),
                    },
                ])
                setStatus({ type: 'error', detail: errMsg })
                setTimeout(() => setStatus({ type: 'idle' }), 2000)
            }
        },
        [input, status.type, address]
    )

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
    }

    return (
        <div style={s.page}>
            {/* ── Top bar ────────────────────────────────── */}
            <header style={s.header}>
                <div style={s.headerLeft}>
                    <a href="/" style={s.logoLink}>
                        <div style={s.logoIcon}>
                            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
                                <rect x="2" y="16" width="8" height="10" rx="2" fill="#7c3aed" opacity="0.5" />
                                <rect x="10" y="10" width="8" height="16" rx="2" fill="#8b5cf6" opacity="0.7" />
                                <rect x="18" y="4" width="8" height="22" rx="2" fill="#a78bfa" />
                            </svg>
                        </div>
                    </a>
                    <div style={s.headerDivider} />
                    <div style={s.agentInfo}>
                        <span style={s.agentName}>Agent</span>
                        <StatusDot type={status.type} />
                    </div>
                </div>

                <div style={s.headerRight}>
                    {trainingStatus && (
                        <div style={{
                            ...s.trainingBadge,
                            ...(trainingStatus.ready ? s.trainingReady : s.trainingProgress),
                        }}>
                            {trainingStatus.ready
                                ? `🧠 ${trainingStatus.skillTier ?? 'Trained'}`
                                : `🔄 ${trainingStatus.matchesPlayed}/${trainingStatus.matchesRequired}`}
                        </div>
                    )}
                    {address && (
                        <div style={s.walletBadge}>
                            <span style={s.walletDot} />
                            {address.slice(0, 4)}...{address.slice(-4)}
                        </div>
                    )}
                    <button
                        style={s.splitToggle}
                        onClick={() => setSplitView(v => !v)}
                    >
                        {splitView ? '◧' : '◨'}
                    </button>
                </div>
            </header>

            {/* ── Workspace ──────────────────────────────── */}
            <div style={s.workspace}>
                {/* ── Chat ── */}
                <div style={s.chatPanel}>
                    {/* Chips */}
                    <div style={s.chips}>
                        <span style={s.chip}><span style={s.chipDot} /> Solana Devnet</span>
                        <span style={s.chip}>Unity WebGL</span>
                        <span style={s.chip}>1 USDC / call</span>
                        {trainingStatus && (
                            <span style={{
                                ...s.chip,
                                ...(trainingStatus.ready ? s.chipReady : s.chipTraining),
                            }}>
                                {trainingStatus.ready ? '🧠 Trained' : `🔄 Training ${trainingStatus.matchesPlayed}/${trainingStatus.matchesRequired}`}
                            </span>
                        )}
                    </div>

                    {/* Messages */}
                    <div style={s.messages}>
                        {messages.map((msg, i) => (
                            <div
                                key={msg.id}
                                style={{
                                    ...s.message,
                                    ...(msg.role === 'user' ? s.messageUser : {}),
                                    animationDelay: `${Math.min(i * 0.03, 0.2)}s`,
                                }}
                            >
                                <div style={{
                                    ...s.avatar,
                                    ...(msg.role === 'user' ? s.avatarUser : msg.role === 'system' ? s.avatarSystem : s.avatarAgent),
                                }}>
                                    {msg.role === 'user' ? 'U' : msg.role === 'system' ? 'i' : 'AI'}
                                </div>
                                <div style={s.msgBody}>
                                    {msg.gameAction && <span style={s.tagGame}>game cmd</span>}
                                    {msg.trainingProfile && (
                                        <span style={s.tagTraining}>
                                            {msg.trainingProfile.skillTier} · {msg.trainingProfile.accuracy.toFixed(0)}%
                                        </span>
                                    )}
                                    <div style={{
                                        ...s.bubble,
                                        ...(msg.role === 'user' ? s.bubbleUser : msg.role === 'system' ? s.bubbleSystem : s.bubbleAgent),
                                    }}>
                                        {msg.content}
                                    </div>
                                    <span style={s.timestamp}>
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}

                        {/* Typing indicator */}
                        {(status.type === 'thinking' || status.type === 'gaming' || status.type === 'paying') && (
                            <div style={s.typingRow}>
                                <div style={s.avatarAgent}>AI</div>
                                <div style={s.typingBubble}>
                                    <span style={s.typingDot} />
                                    <span style={{ ...s.typingDot, animationDelay: '0.2s' }} />
                                    <span style={{ ...s.typingDot, animationDelay: '0.4s' }} />
                                    <span style={s.typingLabel}>
                                        {status.type === 'thinking' ? 'Thinking...' :
                                         status.type === 'gaming' ? 'Sending command...' :
                                         'Signing transaction...'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div style={s.inputArea}>
                        <div style={s.quickBar}>
                            <span style={s.quickLabel}>Game</span>
                            {GAME_QUICK_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    style={s.quickBtn}
                                    onClick={() => sendMessage(p.msg)}
                                    disabled={status.type !== 'idle'}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <div style={s.quickDivider} />
                            <span style={s.quickLabel}>AI</span>
                            {TRAINING_QUICK_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    style={{ ...s.quickBtn, ...s.quickBtnGreen }}
                                    onClick={() => sendMessage(p.msg)}
                                    disabled={status.type !== 'idle' || !address}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <div style={s.quickDivider} />
                            <span style={s.quickLabel}>Pay</span>
                            {DATA_QUICK_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    style={{ ...s.quickBtn, ...s.quickBtnPurple }}
                                    onClick={() => sendMessage(p.msg)}
                                    disabled={status.type !== 'idle'}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div style={s.inputRow}>
                            <textarea
                                style={s.textarea}
                                placeholder={address ? 'Tell the agent anything...' : 'Connect wallet or ask anything...'}
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={status.type !== 'idle'}
                                rows={1}
                            />
                            <button
                                style={{
                                    ...s.sendBtn,
                                    ...(!input.trim() || status.type !== 'idle' ? s.sendBtnDisabled : {}),
                                }}
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || status.type !== 'idle'}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Game ── */}
                {splitView && (
                    <div style={s.gamePanel}>
                        <div style={s.gameHeader}>
                            <span style={{
                                ...s.gameDot,
                                ...(unityLoaded ? s.gameDotReady : {}),
                            }} />
                            <span style={s.gameTitle}>Unity WebGL</span>
                            <span style={s.gameStatus}>
                                {unityLoaded ? 'ready' : 'loading...'}
                            </span>
                        </div>
                        <div style={s.gameFrame}>
                            {!unityLoaded && (
                                <div style={s.gameOverlay}>
                                    <div style={s.spinner} />
                                    <span style={s.overlayText}>Loading Unity...</span>
                                </div>
                            )}
                            {gameState && gameState.status === 'playing' && (
                                <div style={s.stateOverlay}>
                                    <span style={s.stateChip}>
                                        <span style={s.stateDot} /> Live
                                    </span>
                                    <span style={s.stateChip}>Score {gameState.score}</span>
                                    <span style={s.stateChip}>Lv {gameState.level}</span>
                                    <span style={s.stateChip}>{gameState.moves} moves</span>
                                    <span style={s.stateChip}>{gameState.accuracy.toFixed(0)}%</span>
                                </div>
                            )}
                            <iframe
                                ref={iframeRef}
                                src="/unity/index.html"
                                title="StakeStack"
                                allow="fullscreen"
                                style={s.iframe}
                                onLoad={() => setTimeout(() => setUnityLoaded(true), 1000)}
                            />
                        </div>
                        <div style={s.gameControls}>
                            {GAME_QUICK_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    style={s.gameBtn}
                                    onClick={() => sendMessage(p.msg)}
                                    disabled={status.type !== 'idle'}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Connect bar */}
            {!address && (
                <div style={s.connectBar}>
                    <span style={s.connectText}>Connect wallet to train your agent</span>
                    <ConnectButtonBaseUI />
                </div>
            )}

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
                @keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.5} 40%{transform:translateY(-4px);opacity:1} }
                @keyframes spin { to{transform:rotate(360deg)} }
                @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
            `}</style>
        </div>
    )
}

function StatusDot({ type }: { type: string }) {
    const colors: Record<string, string> = {
        idle: '#22c55e', thinking: '#f59e0b', paying: '#8b5cf6',
        gaming: '#06b6d4', fetching: '#3b82f6', done: '#22c55e', error: '#ef4444',
    }
    const labels: Record<string, string> = {
        idle: 'Online', thinking: 'Thinking', paying: 'Paying',
        gaming: 'Gaming', fetching: 'Fetching', done: 'Done', error: 'Error',
    }
    return (
        <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            fontSize: '0.7rem',
            color: colors[type] || '#62666d',
            fontWeight: 500,
        }}>
            <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: colors[type] || '#62666d',
                boxShadow: `0 0 6px ${colors[type] || '#62666d'}44`,
                animation: type === 'thinking' || type === 'paying' || type === 'gaming' ? 'pulse 1.5s infinite' : 'none',
            }} />
            {labels[type] || 'Unknown'}
        </span>
    )
}

/* ── Styles ──────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
    page: {
        fontFamily: "'Inter', system-ui, sans-serif",
        color: '#f7f8f8',
        background: '#08090a',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
    },

    /* Header */
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 1rem',
        background: 'rgba(15, 16, 17, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
        zIndex: 10,
    },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
    logoLink: { textDecoration: 'none', display: 'flex' },
    logoIcon: {
        width: '32px', height: '32px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(124,58,237,0.08)',
        borderRadius: '8px',
        border: '1px solid rgba(124,58,237,0.15)',
    },
    headerDivider: {
        width: '1px', height: '20px',
        background: 'rgba(255,255,255,0.06)',
    },
    agentInfo: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
    agentName: {
        fontSize: '0.82rem', fontWeight: 600,
        color: '#f7f8f8', letterSpacing: '-0.01em',
    },
    headerRight: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
    trainingBadge: {
        padding: '0.25rem 0.65rem',
        borderRadius: '8px',
        fontSize: '0.7rem', fontWeight: 500,
        fontFamily: "'JetBrains Mono', monospace",
    },
    trainingReady: {
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.15)',
        color: '#4ade80',
    },
    trainingProgress: {
        background: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.15)',
        color: '#fbbf24',
    },
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
        boxShadow: '0 0 6px rgba(34,197,94,0.4)',
    },
    splitToggle: {
        width: '32px', height: '32px',
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: '#62666d',
        fontSize: '0.9rem',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
    },

    /* Workspace */
    workspace: {
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
    },

    /* Chat */
    chatPanel: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
    },
    chips: {
        display: 'flex', gap: '0.35rem',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        flexWrap: 'wrap',
        flexShrink: 0,
    },
    chip: {
        display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.05)',
        fontSize: '0.62rem',
        color: '#62666d',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
    },
    chipDot: {
        width: '4px', height: '4px', borderRadius: '50%',
        background: '#22c55e',
    },
    chipReady: { color: '#4ade80', borderColor: 'rgba(34,197,94,0.15)' },
    chipTraining: { color: '#fbbf24', borderColor: 'rgba(245,158,11,0.15)' },

    /* Messages */
    messages: {
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
    },
    message: {
        display: 'flex',
        gap: '0.6rem',
        animation: 'fadeUp 0.3s ease-out both',
        maxWidth: '85%',
    },
    messageUser: {
        flexDirection: 'row-reverse' as const,
        alignSelf: 'flex-end',
    },
    avatar: {
        width: '28px', height: '28px',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.65rem',
        fontWeight: 600,
        flexShrink: 0,
        alignSelf: 'flex-end',
        letterSpacing: '-0.02em',
    },
    avatarAgent: {
        background: 'linear-gradient(135deg, #7c3aed, #2563eb)',
        color: '#fff',
        boxShadow: '0 0 12px rgba(124,58,237,0.2)',
    },
    avatarUser: {
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: '#d0d6e0',
    },
    avatarSystem: {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: '#62666d',
    },
    msgBody: { minWidth: 0 },
    bubble: {
        padding: '0.65rem 0.9rem',
        borderRadius: '12px',
        fontSize: '0.82rem',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap' as const,
        wordBreak: 'break-word' as const,
    },
    bubbleAgent: {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        color: '#e2e4e7',
        borderBottomLeftRadius: '4px',
    },
    bubbleUser: {
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        color: '#fff',
        borderBottomRightRadius: '4px',
        boxShadow: '0 4px 16px rgba(124,58,237,0.2)',
    },
    bubbleSystem: {
        background: 'rgba(124,58,237,0.06)',
        border: '1px solid rgba(124,58,237,0.1)',
        color: '#a78bfa',
        fontSize: '0.78rem',
        borderRadius: '10px',
    },
    tagGame: {
        display: 'inline-flex',
        marginBottom: '4px', marginRight: '4px',
        padding: '1px 7px',
        borderRadius: '999px',
        background: 'rgba(6,182,212,0.1)',
        border: '1px solid rgba(6,182,212,0.2)',
        fontSize: '0.6rem',
        color: '#67e8f9',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
    },
    tagTraining: {
        display: 'inline-flex',
        marginBottom: '4px',
        padding: '1px 7px',
        borderRadius: '999px',
        background: 'rgba(34,197,94,0.1)',
        border: '1px solid rgba(34,197,94,0.2)',
        fontSize: '0.6rem',
        color: '#4ade80',
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 500,
    },
    timestamp: {
        display: 'block',
        fontSize: '0.6rem',
        color: '#3e3e44',
        marginTop: '0.2rem',
        fontFamily: "'JetBrains Mono', monospace",
    },

    /* Typing */
    typingRow: {
        display: 'flex',
        gap: '0.6rem',
        animation: 'fadeUp 0.2s ease-out',
    },
    typingBubble: {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '0.65rem 0.9rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '12px',
        borderBottomLeftRadius: '4px',
    },
    typingDot: {
        width: '4px', height: '4px',
        borderRadius: '50%',
        background: '#7c3aed',
        animation: 'bounce 1.2s infinite ease-in-out',
    },
    typingLabel: {
        fontSize: '0.68rem',
        color: '#8a8f98',
        marginLeft: '0.3rem',
        fontWeight: 500,
    },

    /* Input */
    inputArea: {
        padding: '0.5rem 1rem 0.75rem',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0,
    },
    quickBar: {
        display: 'flex',
        gap: '0.25rem',
        marginBottom: '0.5rem',
        flexWrap: 'wrap' as const,
        alignItems: 'center',
    },
    quickLabel: {
        fontSize: '0.58rem',
        fontWeight: 600,
        color: '#3e3e44',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.08em',
        marginRight: '0.15rem',
    },
    quickBtn: {
        padding: '0.2rem 0.55rem',
        borderRadius: '6px',
        background: 'rgba(6,182,212,0.06)',
        border: '1px solid rgba(6,182,212,0.12)',
        color: '#67e8f9',
        fontSize: '0.68rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.15s',
    },
    quickBtnGreen: {
        background: 'rgba(34,197,94,0.06)',
        borderColor: 'rgba(34,197,94,0.12)',
        color: '#4ade80',
    },
    quickBtnPurple: {
        background: 'rgba(124,58,237,0.06)',
        borderColor: 'rgba(124,58,237,0.12)',
        color: '#a78bfa',
    },
    quickDivider: {
        width: '1px', height: '14px',
        background: 'rgba(255,255,255,0.05)',
        margin: '0 0.3rem',
    },
    inputRow: {
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'flex-end',
    },
    textarea: {
        flex: 1,
        padding: '0.65rem 0.9rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        color: '#f7f8f8',
        fontSize: '0.82rem',
        fontFamily: "'Inter', sans-serif",
        outline: 'none',
        resize: 'none' as const,
        minHeight: '40px',
        maxHeight: '120px',
        transition: 'border-color 0.2s',
    },
    sendBtn: {
        width: '40px', height: '40px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        border: 'none',
        color: '#fff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.2s',
        boxShadow: '0 4px 12px rgba(124,58,237,0.2)',
    },
    sendBtnDisabled: {
        opacity: 0.35,
        cursor: 'not-allowed',
        boxShadow: 'none',
    },

    /* Game panel */
    gamePanel: {
        width: '420px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0a0b0c',
        borderLeft: '1px solid rgba(255,255,255,0.05)',
        animation: 'fadeUp 0.3s ease-out',
    },
    gameHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
    },
    gameDot: {
        width: '6px', height: '6px', borderRadius: '50%',
        background: '#3e3e44',
        transition: 'all 0.3s',
    },
    gameDotReady: {
        background: '#22c55e',
        boxShadow: '0 0 6px rgba(34,197,94,0.4)',
    },
    gameTitle: {
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#8a8f98',
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
    },
    gameStatus: {
        marginLeft: 'auto',
        fontSize: '0.62rem',
        color: '#3e3e44',
        fontFamily: "'JetBrains Mono', monospace",
    },
    gameFrame: {
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
    },
    iframe: {
        width: '100%',
        height: '100%',
        border: 'none',
        background: '#040608',
    },
    gameOverlay: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        background: 'rgba(10,11,12,0.95)',
        zIndex: 5,
    },
    spinner: {
        width: '36px', height: '36px',
        borderRadius: '50%',
        border: '2px solid rgba(124,58,237,0.15)',
        borderTopColor: '#7c3aed',
        animation: 'spin 0.9s linear infinite',
    },
    overlayText: {
        fontSize: '0.72rem',
        color: '#3e3e44',
    },
    stateOverlay: {
        position: 'absolute',
        top: '6px', left: '6px', right: '6px',
        display: 'flex',
        gap: '0.3rem',
        zIndex: 3,
        flexWrap: 'wrap' as const,
    },
    stateChip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.25rem',
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: '0.6rem',
        color: '#d0d6e0',
        fontFamily: "'JetBrains Mono', monospace",
    },
    stateDot: {
        width: '4px', height: '4px', borderRadius: '50%',
        background: '#22c55e',
    },
    gameControls: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px',
        padding: '8px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
    },
    gameBtn: {
        padding: '0.4rem',
        borderRadius: '7px',
        background: 'rgba(124,58,237,0.06)',
        border: '1px solid rgba(124,58,237,0.12)',
        color: '#a78bfa',
        fontSize: '0.7rem',
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        transition: 'all 0.15s',
        textAlign: 'center' as const,
    },

    /* Connect bar */
    connectBar: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0.4rem 1rem',
        background: 'rgba(124,58,237,0.04)',
        borderTop: '1px solid rgba(124,58,237,0.08)',
        flexShrink: 0,
    },
    connectText: {
        fontSize: '0.72rem',
        color: '#8a8f98',
    },
}
