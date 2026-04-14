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
    { label: '▶ Bot Match', msg: 'Start a bot match in StakeStack', emoji: '🤖' },
    { label: '🎯 Practice', msg: 'Start practice mode', emoji: '🎯' },
    { label: '🏠 Main Menu', msg: 'Go to main menu', emoji: '🏠' },
    { label: '📊 Stats', msg: 'Get my practice stats', emoji: '📊' },
]

const DATA_QUICK_PROMPTS = [
    { label: 'Fetch paid data', msg: 'Fetch the paid data' },
    { label: 'Pay & get content', msg: 'Pay and get me the data' },
]

const TRAINING_QUICK_PROMPTS = [
    { label: '🧠 My Profile', msg: 'Show my training profile' },
    { label: '📈 Progress', msg: 'How is my agent training going?' },
]

export default function AgentPage() {
    const { address } = useAccount()
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'system',
            content:
                '🤖 Agent online. I can **play the StakeStack Unity game** autonomously and make **Solana MPP payments** — no browser wallet needed.\n\n' +
                '🎮 Play games to **train your agent** — after 5 games, I learn your play style and play just like you!\n\n' +
                'Try the game controls on the right or type a command below.',
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [status, setStatus] = useState<AgentStatus>({ type: 'idle' })
    const [unityLoaded, setUnityLoaded] = useState(false)
    const [splitView, setSplitView] = useState(true)
    const [trainingStatus, setTrainingStatus] = useState<TrainingStatus | null>(null)
    const [gameState, setGameState] = useState<{
        status: string
        score: number
        level: number
        moves: number
        accuracy: number
    } | null>(null)
    const bottomRef = useRef<HTMLDivElement>(null)
    const iframeRef = useRef<HTMLIFrameElement>(null)

    // Scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    // Fetch training status when wallet connects
    useEffect(() => {
        if (!address) {
            setTrainingStatus(null)
            return
        }
        fetch(`/api/player/status?wallet=${address}`)
            .then(r => r.json())
            .then(data => {
                if (data.training) {
                    setTrainingStatus(data.training)
                }
            })
            .catch(() => {})
    }, [address])

    // Subscribe to game state via SSE
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

    // Register wallet with game bridge when connected
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

            const isGameCmd = /bot.?match|practice|main.?menu|stats|vs bot|train|play bot|go back/i.test(msg)

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
                    setStatus({ type: 'paying', detail: 'Agent is signing & broadcasting Solana tx...' })
                }

                const res = await fetch('/api/agent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg, wallet: address }),
                })

                const data = await res.json()

                if (!res.ok || data.error) {
                    throw new Error(data.error ?? 'Unknown error')
                }

                // Update training status if returned
                if (data.trainingProfile) {
                    setTrainingStatus(prev =>
                        prev ? { ...prev, skillTier: data.trainingProfile.skillTier, accuracy: data.trainingProfile.accuracy } : prev
                    )
                }

                let replyContent = data.reply
                if (data.paymentMade) {
                    replyContent = `💳 **Payment made:** 1 USDC on Solana Devnet\n\n${data.reply}`
                }
                if (data.gameAction) {
                    replyContent = `🎮 **Game command sent:** ${data.gameCmdResult}\n\n${data.reply}`
                }

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
                setTimeout(() => setStatus({ type: 'idle' }), 2000)
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                setMessages(prev => [
                    ...prev,
                    {
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: `❌ Error: ${errMsg}`,
                        timestamp: new Date(),
                    },
                ])
                setStatus({ type: 'error', detail: errMsg })
                setTimeout(() => setStatus({ type: 'idle' }), 3000)
            }
        },
        [input, status.type, address]
    )

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage()
        }
    }

    const statusLabel: Record<AgentStatus['type'], string> = {
        idle: '● Online',
        thinking: '◌ Thinking...',
        paying: '⟳ Paying on-chain...',
        gaming: '🎮 Sending game cmd...',
        fetching: '⟳ Fetching data...',
        done: '✓ Done',
        error: '✕ Error',
    }

    const statusColor: Record<AgentStatus['type'], string> = {
        idle: '#22c55e',
        thinking: '#f59e0b',
        paying: '#8b5cf6',
        gaming: '#06b6d4',
        fetching: '#3b82f6',
        done: '#22c55e',
        error: '#ef4444',
    }

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

                body {
                    background: #080c14;
                    font-family: 'Inter', sans-serif;
                    color: #e2e8f0;
                    min-height: 100vh;
                    overflow: hidden;
                }

                /* ── Top bar ── */
                .top-bar {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 0.75rem 1.25rem;
                    background: rgba(8,12,20,0.98);
                    border-bottom: 1px solid rgba(139,92,246,0.2);
                    flex-shrink: 0;
                    z-index: 10;
                }

                .agent-avatar {
                    width: 38px; height: 38px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #7c3aed, #2563eb);
                    display: flex; align-items: center; justify-content: center;
                    font-size: 1.15rem;
                    box-shadow: 0 0 18px rgba(124,58,237,0.35);
                    flex-shrink: 0;
                }

                .agent-info { flex: 1; }
                .agent-name {
                    font-size: 0.95rem; font-weight: 600;
                    color: #f1f5f9; letter-spacing: -0.01em;
                }
                .agent-desc { font-size: 0.7rem; color: #64748b; margin-top: 1px; }

                .top-bar-right { display: flex; align-items: center; gap: 0.6rem; margin-left: auto; }

                .status-badge {
                    display: flex; align-items: center; gap: 0.4rem;
                    padding: 0.2rem 0.65rem;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.07);
                    font-size: 0.7rem; font-weight: 500;
                    transition: all 0.3s ease; white-space: nowrap;
                }
                .status-dot {
                    width: 6px; height: 6px; border-radius: 50%;
                    transition: all 0.3s ease;
                }

                .wallet-badge {
                    display: flex; align-items: center; gap: 0.4rem;
                    padding: 0.25rem 0.6rem;
                    border-radius: 8px;
                    background: rgba(34,197,94,0.08);
                    border: 1px solid rgba(34,197,94,0.2);
                    font-size: 0.68rem; color: #22c55e;
                    font-family: 'JetBrains Mono', monospace;
                }

                .training-badge {
                    display: flex; align-items: center; gap: 0.4rem;
                    padding: 0.25rem 0.6rem;
                    border-radius: 8px;
                    font-size: 0.68rem; font-weight: 500;
                }
                .training-badge.ready {
                    background: rgba(34,197,94,0.08);
                    border: 1px solid rgba(34,197,94,0.2);
                    color: #22c55e;
                }
                .training-badge.training {
                    background: rgba(245,158,11,0.08);
                    border: 1px solid rgba(245,158,11,0.2);
                    color: #f59e0b;
                }

                .split-toggle {
                    display: flex; align-items: center; gap: 0.4rem;
                    padding: 0.3rem 0.75rem;
                    border-radius: 8px;
                    background: rgba(139,92,246,0.1);
                    border: 1px solid rgba(139,92,246,0.25);
                    color: #a78bfa; font-size: 0.72rem; font-weight: 500;
                    font-family: 'Inter', sans-serif;
                    cursor: pointer; transition: all 0.15s ease;
                }
                .split-toggle:hover {
                    background: rgba(139,92,246,0.2);
                    border-color: rgba(139,92,246,0.5);
                    color: #c4b5fd;
                }

                /* ── Main layout ── */
                .workspace {
                    display: flex;
                    height: calc(100vh - 57px);
                    overflow: hidden;
                }

                /* ── Chat panel ── */
                .chat-panel {
                    display: flex; flex-direction: column;
                    flex: 1; min-width: 0;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    transition: flex 0.3s ease;
                }

                /* ── Game panel ── */
                .game-panel {
                    display: flex; flex-direction: column;
                    width: 440px; flex-shrink: 0;
                    background: #060a10;
                    transition: width 0.3s ease, opacity 0.3s ease;
                    overflow: hidden;
                }
                .game-panel.hidden {
                    width: 0; opacity: 0; pointer-events: none;
                }

                .game-panel-header {
                    display: flex; align-items: center; gap: 0.6rem;
                    padding: 0.6rem 0.9rem;
                    border-bottom: 1px solid rgba(139,92,246,0.15);
                    background: rgba(8,12,20,0.8);
                    flex-shrink: 0;
                }
                .game-panel-title {
                    font-size: 0.78rem; font-weight: 600; color: #94a3b8;
                    letter-spacing: 0.05em; text-transform: uppercase;
                }

                .unity-dot {
                    width: 7px; height: 7px; border-radius: 50%;
                    background: #334155; flex-shrink: 0;
                    transition: background 0.3s ease;
                }
                .unity-dot.ready { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.4); }

                .game-frame-wrap {
                    flex: 1; overflow: hidden; position: relative;
                }
                .game-frame-wrap iframe {
                    width: 100%; height: 100%;
                    border: none;
                    background: #040608;
                }

                /* Overlay while game not ready */
                .game-loading-overlay {
                    position: absolute; inset: 0;
                    display: flex; flex-direction: column;
                    align-items: center; justify-content: center;
                    gap: 1rem;
                    background: rgba(6,10,16,0.96);
                    z-index: 5;
                    pointer-events: none;
                    transition: opacity 0.4s ease;
                }
                .game-loading-overlay.hidden { opacity: 0; }

                .loading-ring {
                    width: 44px; height: 44px;
                    border-radius: 50%;
                    border: 3px solid rgba(139,92,246,0.15);
                    border-top-color: #7c3aed;
                    animation: spin 0.9s linear infinite;
                }
                @keyframes spin { to { transform: rotate(360deg); } }

                .loading-text { font-size: 0.78rem; color: #475569; }

                /* Game state overlay on top of iframe */
                .game-state-overlay {
                    position: absolute;
                    top: 8px; left: 8px; right: 8px;
                    display: flex; gap: 0.4rem;
                    z-index: 3;
                    flex-wrap: wrap;
                }
                .game-state-chip {
                    padding: 0.25rem 0.6rem;
                    border-radius: 6px;
                    background: rgba(0,0,0,0.7);
                    backdrop-filter: blur(8px);
                    border: 1px solid rgba(255,255,255,0.1);
                    font-size: 0.65rem;
                    font-family: 'JetBrains Mono', monospace;
                    color: #e2e8f0;
                    display: flex; align-items: center; gap: 0.3rem;
                }
                .game-state-chip .dot {
                    width: 5px; height: 5px; border-radius: 50%;
                }

                /* Quick game controls below iframe */
                .game-controls {
                    display: grid; grid-template-columns: 1fr 1fr;
                    gap: 6px; padding: 10px;
                    border-top: 1px solid rgba(139,92,246,0.1);
                    background: rgba(8,12,20,0.9);
                    flex-shrink: 0;
                }
                .game-ctrl-btn {
                    padding: 0.5rem 0.6rem;
                    background: rgba(139,92,246,0.08);
                    border: 1px solid rgba(139,92,246,0.18);
                    border-radius: 8px; color: #a78bfa;
                    font-size: 0.75rem; font-weight: 500;
                    font-family: 'Inter', sans-serif;
                    cursor: pointer; transition: all 0.15s ease;
                    text-align: center;
                }
                .game-ctrl-btn:hover:not(:disabled) {
                    background: rgba(139,92,246,0.2);
                    border-color: rgba(139,92,246,0.45);
                    color: #c4b5fd;
                    transform: translateY(-1px);
                }
                .game-ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                /* ── Info chips ── */
                .info-chips {
                    display: flex; gap: 0.4rem;
                    padding: 0.6rem 1rem;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    flex-wrap: wrap; flex-shrink: 0;
                }
                .chip {
                    display: flex; align-items: center; gap: 0.3rem;
                    padding: 0.2rem 0.55rem;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 6px; font-size: 0.67rem;
                    color: #64748b; font-family: 'JetBrains Mono', monospace;
                }
                .chip-dot { width: 5px; height: 5px; border-radius: 50%; background: #22c55e; }
                .chip-ready { color: #22c55e; border-color: rgba(34,197,94,0.2); }
                .chip-training { color: #f59e0b; border-color: rgba(245,158,11,0.2); }

                /* ── Messages ── */
                .messages-area {
                    flex: 1; overflow-y: auto;
                    padding: 1rem 1rem;
                    display: flex; flex-direction: column; gap: 0.9rem;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(139,92,246,0.2) transparent;
                }
                .messages-area::-webkit-scrollbar { width: 3px; }
                .messages-area::-webkit-scrollbar-thumb {
                    background: rgba(139,92,246,0.3); border-radius: 99px;
                }

                .message {
                    display: flex; gap: 0.65rem;
                    animation: fadeUp 0.22s ease;
                }
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .message.user { flex-direction: row-reverse; }

                .msg-avatar {
                    width: 30px; height: 30px; border-radius: 8px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.8rem; flex-shrink: 0; align-self: flex-end;
                }
                .msg-avatar.agent { background: linear-gradient(135deg, #7c3aed, #2563eb); box-shadow: 0 0 10px rgba(124,58,237,0.25); }
                .msg-avatar.user  { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1); }
                .msg-avatar.system{ background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }

                .msg-body { max-width: 82%; }

                .msg-bubble {
                    padding: 0.75rem 1rem; border-radius: 13px;
                    font-size: 0.85rem; line-height: 1.6; word-break: break-word;
                }
                .message.user .msg-bubble {
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: #fff; border-bottom-right-radius: 4px;
                    box-shadow: 0 4px 18px rgba(124,58,237,0.22);
                }
                .message.assistant .msg-bubble {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #e2e8f0; border-bottom-left-radius: 4px;
                }
                .message.system .msg-bubble {
                    background: rgba(139,92,246,0.07);
                    border: 1px solid rgba(139,92,246,0.14);
                    color: #a78bfa; font-size: 0.8rem; border-radius: 10px;
                }

                /* Game action tag on assistant bubble */
                .msg-game-tag {
                    display: inline-flex; align-items: center; gap: 4px;
                    margin-bottom: 6px; padding: 2px 8px;
                    background: rgba(6,182,212,0.12);
                    border: 1px solid rgba(6,182,212,0.25);
                    border-radius: 999px; font-size: 0.68rem;
                    color: #67e8f9; font-family: 'JetBrains Mono', monospace;
                }
                .msg-training-tag {
                    display: inline-flex; align-items: center; gap: 4px;
                    margin-bottom: 6px; padding: 2px 8px;
                    background: rgba(34,197,94,0.12);
                    border: 1px solid rgba(34,197,94,0.25);
                    border-radius: 999px; font-size: 0.68rem;
                    color: #4ade80; font-family: 'JetBrains Mono', monospace;
                }

                .msg-time {
                    font-size: 0.65rem; color: #334155;
                    margin-top: 0.3rem; padding: 0 0.2rem;
                }
                .message.user .msg-time { text-align: right; }

                /* ── Typing / status indicators ── */
                .typing-indicator {
                    display: flex; gap: 0.65rem;
                    animation: fadeUp 0.22s ease;
                }
                .typing-bubble {
                    display: flex; align-items: center; gap: 4px;
                    padding: 0.75rem 1rem;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 13px; border-bottom-left-radius: 4px;
                }
                .typing-dot {
                    width: 5px; height: 5px; border-radius: 50%;
                    background: #7c3aed;
                    animation: bounce 1.2s infinite ease-in-out;
                }
                .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                .typing-dot:nth-child(3) { animation-delay: 0.4s; }
                @keyframes bounce {
                    0%,80%,100% { transform: translateY(0); opacity: 0.5; }
                    40%          { transform: translateY(-4px); opacity: 1; }
                }
                .typing-label { font-size: 0.72rem; color: #a78bfa; margin-left: 0.4rem; font-weight: 500; }

                .gaming-pulse {
                    display: flex; align-items: center; gap: 6px;
                    padding: 0.6rem 0.9rem;
                    background: rgba(6,182,212,0.08);
                    border: 1px solid rgba(6,182,212,0.2);
                    border-radius: 10px; font-size: 0.78rem; color: #67e8f9;
                    animation: fadeUp 0.22s ease;
                }
                .gaming-spinner {
                    width: 14px; height: 14px;
                    border: 2px solid rgba(6,182,212,0.25);
                    border-top-color: #06b6d4;
                    border-radius: 50%;
                    animation: spin 0.7s linear infinite;
                    flex-shrink: 0;
                }

                .payment-banner {
                    display: flex; align-items: center; gap: 0.65rem;
                    padding: 0.6rem 0.9rem;
                    background: rgba(139,92,246,0.08);
                    border: 1px solid rgba(139,92,246,0.22);
                    border-radius: 10px; font-size: 0.78rem; color: #a78bfa;
                    animation: fadeUp 0.22s ease;
                }
                .payment-spinner {
                    width: 14px; height: 14px;
                    border: 2px solid rgba(139,92,246,0.25);
                    border-top-color: #7c3aed;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    flex-shrink: 0;
                }

                /* ── Input area ── */
                .input-area {
                    padding: 0.75rem 1rem 1rem;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    flex-shrink: 0;
                }

                /* Tab row */
                .prompt-tabs {
                    display: flex; gap: 0.35rem; margin-bottom: 0.6rem;
                    flex-wrap: wrap;
                }
                .prompt-tab-label {
                    font-size: 0.65rem; color: #334155; font-weight: 600;
                    text-transform: uppercase; letter-spacing: 0.06em;
                    padding: 0.2rem 0; white-space: nowrap;
                    display: flex; align-items: center;
                }
                .tab-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.06); margin: 0 4px; }

                .quick-btn {
                    padding: 0.3rem 0.7rem;
                    border-radius: 999px; font-family: 'Inter', sans-serif;
                    font-size: 0.72rem; cursor: pointer; transition: all 0.15s ease;
                }
                .quick-btn.game {
                    background: rgba(6,182,212,0.08);
                    border: 1px solid rgba(6,182,212,0.2);
                    color: #67e8f9;
                }
                .quick-btn.game:hover {
                    background: rgba(6,182,212,0.18);
                    border-color: rgba(6,182,212,0.45);
                    color: #a5f3fc;
                }
                .quick-btn.data {
                    background: rgba(139,92,246,0.08);
                    border: 1px solid rgba(139,92,246,0.2);
                    color: #a78bfa;
                }
                .quick-btn.data:hover {
                    background: rgba(139,92,246,0.18);
                    border-color: rgba(139,92,246,0.45);
                    color: #c4b5fd;
                }
                .quick-btn.training {
                    background: rgba(34,197,94,0.08);
                    border: 1px solid rgba(34,197,94,0.2);
                    color: #4ade80;
                }
                .quick-btn.training:hover {
                    background: rgba(34,197,94,0.18);
                    border-color: rgba(34,197,94,0.45);
                    color: #86efac;
                }
                .quick-btn:disabled { opacity: 0.35; cursor: not-allowed; }

                .input-row {
                    display: flex; gap: 0.6rem; align-items: flex-end;
                }
                .input-wrapper { flex: 1; position: relative; }
                .chat-input {
                    width: 100%; padding: 0.78rem 1rem;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 13px; color: #e2e8f0;
                    font-family: 'Inter', sans-serif; font-size: 0.85rem;
                    outline: none; resize: none;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    min-height: 46px; max-height: 130px;
                }
                .chat-input::placeholder { color: #334155; }
                .chat-input:focus {
                    border-color: rgba(124,58,237,0.5);
                    box-shadow: 0 0 0 3px rgba(124,58,237,0.08);
                }
                .chat-input:disabled { opacity: 0.5; cursor: not-allowed; }

                .send-btn {
                    width: 46px; height: 46px; border-radius: 11px;
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    border: none; cursor: pointer;
                    display: flex; align-items: center; justify-content: center;
                    transition: all 0.2s ease; flex-shrink: 0;
                    box-shadow: 0 4px 14px rgba(124,58,237,0.3);
                }
                .send-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 6px 20px rgba(124,58,237,0.4);
                }
                .send-btn:active:not(:disabled) { transform: scale(0.96); }
                .send-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

                .send-icon {
                    width: 17px; height: 17px; fill: none;
                    stroke: white; stroke-width: 2;
                    stroke-linecap: round; stroke-linejoin: round;
                }

                .hint-text {
                    margin-top: 0.5rem; font-size: 0.68rem;
                    color: #1e293b; text-align: center;
                }

                .connect-bar {
                    display: flex; align-items: center; justify-content: center;
                    gap: 0.75rem;
                    padding: 0.5rem 1rem;
                    background: rgba(139,92,246,0.05);
                    border-bottom: 1px solid rgba(139,92,246,0.1);
                }
                .connect-text { font-size: 0.75rem; color: #94a3b8; }
                .connect-link {
                    font-size: 0.75rem; color: #a78bfa;
                    text-decoration: none; font-weight: 500;
                }
            `}</style>

            {/* ── Top bar ─────────────────────────────────────── */}
            <div className="top-bar">
                <div className="agent-avatar">🤖</div>
                <div className="agent-info">
                    <div className="agent-name">StakeStack Agent</div>
                    <div className="agent-desc">
                        {address
                            ? `Connected · ${address.slice(0, 4)}...${address.slice(-4)} · ${trainingStatus?.ready ? 'Trained' : 'Training'}`
                            : 'Connect wallet to train your agent'}
                    </div>
                </div>
                <div className="top-bar-right">
                    {trainingStatus && (
                        <div className={`training-badge ${trainingStatus.ready ? 'ready' : 'training'}`}>
                            {trainingStatus.ready
                                ? `🧠 ${trainingStatus.skillTier ?? 'Trained'} · ${trainingStatus.accuracy?.toFixed(0) ?? '?'}%`
                                : `🔄 ${trainingStatus.matchesPlayed}/${trainingStatus.matchesRequired}`}
                        </div>
                    )}
                    {address && (
                        <div className="wallet-badge">
                            🔗 {address.slice(0, 4)}...{address.slice(-4)}
                        </div>
                    )}
                    <div className="status-badge" style={{ color: statusColor[status.type] }}>
                        <div className="status-dot" style={{ background: statusColor[status.type] }} />
                        {statusLabel[status.type]}
                    </div>
                    <button
                        className="split-toggle"
                        onClick={() => setSplitView(v => !v)}
                        title={splitView ? 'Hide game panel' : 'Show game panel'}
                    >
                        {splitView ? '⬛ Hide Game' : '🎮 Show Game'}
                    </button>
                </div>
            </div>

            {/* ── Connect bar (when no wallet) ── */}
            {!address && (
                <div className="connect-bar">
                    <span className="connect-text">Connect your wallet to train your agent and track progress</span>
                    <ConnectButtonBaseUI />
                </div>
            )}

            {/* ── Workspace ────────────────────────────────────── */}
            <div className="workspace">
                {/* ── Chat Panel ─────────────────────────────── */}
                <div className="chat-panel">
                    {/* Info chips */}
                    <div className="info-chips">
                        <div className="chip">
                            <div className="chip-dot" />
                            Solana Devnet
                        </div>
                        <div className="chip">🎮 Unity WebGL</div>
                        <div className="chip">🪙 USDC · 1 per call</div>
                        <div className="chip">🔐 Agent auto-signs</div>
                        <div className="chip">📡 SSE bridge</div>
                        {trainingStatus && (
                            <div className={`chip ${trainingStatus.ready ? 'chip-ready' : 'chip-training'}`}>
                                {trainingStatus.ready ? '🧠 Agent trained' : `🔄 Training ${trainingStatus.matchesPlayed}/${trainingStatus.matchesRequired}`}
                            </div>
                        )}
                    </div>

                    {/* Messages */}
                    <div className="messages-area">
                        {messages.map(msg => (
                            <div key={msg.id} className={`message ${msg.role}`}>
                                <div
                                    className={`msg-avatar ${
                                        msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'agent'
                                    }`}
                                >
                                    {msg.role === 'user' ? '👤' : msg.role === 'system' ? '⚙️' : '🤖'}
                                </div>
                                <div className="msg-body">
                                    {msg.gameAction && <div className="msg-game-tag">🎮 game cmd</div>}
                                    {msg.trainingProfile && (
                                        <div className="msg-training-tag">
                                            🧠 using {msg.trainingProfile.skillTier} profile · {msg.trainingProfile.accuracy.toFixed(0)}% accuracy
                                        </div>
                                    )}
                                    <div
                                        className="msg-bubble"
                                        dangerouslySetInnerHTML={{
                                            __html: msg.content
                                                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                .replace(/\n/g, '<br/>'),
                                        }}
                                    />
                                    <div className="msg-time">
                                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {/* Status indicators */}
                        {status.type === 'thinking' && (
                            <div className="typing-indicator">
                                <div className="msg-avatar agent">🤖</div>
                                <div className="typing-bubble">
                                    <div className="typing-dot" />
                                    <div className="typing-dot" />
                                    <div className="typing-dot" />
                                    <span className="typing-label">Thinking...</span>
                                </div>
                            </div>
                        )}

                        {status.type === 'gaming' && (
                            <>
                                <div className="typing-indicator">
                                    <div className="msg-avatar agent">🤖</div>
                                    <div className="typing-bubble">
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                        <span className="typing-label">Sending game command...</span>
                                    </div>
                                </div>
                                <div className="gaming-pulse">
                                    <div className="gaming-spinner" />
                                    <span>Agent is controlling the Unity game via SSE bridge</span>
                                </div>
                            </>
                        )}

                        {status.type === 'paying' && (
                            <>
                                <div className="typing-indicator">
                                    <div className="msg-avatar agent">🤖</div>
                                    <div className="typing-bubble">
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                        <div className="typing-dot" />
                                        <span className="typing-label">Processing payment...</span>
                                    </div>
                                </div>
                                <div className="payment-banner">
                                    <div className="payment-spinner" />
                                    <span>Agent is signing &amp; broadcasting Solana transaction — 1 USDC on Devnet</span>
                                </div>
                            </>
                        )}

                        <div ref={bottomRef} />
                    </div>

                    {/* Input */}
                    <div className="input-area">
                        <div className="prompt-tabs">
                            <span className="prompt-tab-label">🎮</span>
                            {GAME_QUICK_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    className="quick-btn game"
                                    onClick={() => sendMessage(p.msg)}
                                    disabled={status.type !== 'idle'}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <div className="tab-divider" />
                            <span className="prompt-tab-label">🧠</span>
                            {TRAINING_QUICK_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    className="quick-btn training"
                                    onClick={() => sendMessage(p.msg)}
                                    disabled={status.type !== 'idle' || !address}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <div className="tab-divider" />
                            <span className="prompt-tab-label">💳</span>
                            {DATA_QUICK_PROMPTS.map(p => (
                                <button
                                    key={p.label}
                                    className="quick-btn data"
                                    onClick={() => sendMessage(p.msg)}
                                    disabled={status.type !== 'idle'}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        <div className="input-row">
                            <div className="input-wrapper">
                                <textarea
                                    id="chat-input"
                                    className="chat-input"
                                    placeholder={
                                        address
                                            ? 'Tell the agent to play the game, check training, or fetch paid data…'
                                            : 'Connect wallet first, or just ask the agent anything…'
                                    }
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={status.type !== 'idle'}
                                    rows={1}
                                />
                            </div>
                            <button
                                id="send-btn"
                                className="send-btn"
                                onClick={() => sendMessage()}
                                disabled={!input.trim() || status.type !== 'idle'}
                                title="Send message"
                            >
                                <svg className="send-icon" viewBox="0 0 24 24">
                                    <line x1="22" y1="2" x2="11" y2="13" />
                                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                                </svg>
                            </button>
                        </div>
                        <p className="hint-text">Enter to send · Game cmds via SSE · Training data from Unity · Payments on Solana Devnet</p>
                    </div>
                </div>

                {/* ── Game Panel ─────────────────────────────── */}
                <div className={`game-panel ${splitView ? '' : 'hidden'}`}>
                    <div className="game-panel-header">
                        <div className={`unity-dot ${unityLoaded ? 'ready' : ''}`} />
                        <span className="game-panel-title">StakeStack · Unity WebGL</span>
                        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', color: '#334155', fontFamily: 'monospace' }}>
                            {unityLoaded ? '✓ ready' : 'loading…'}
                        </span>
                    </div>

                    <div className="game-frame-wrap">
                        {/* Loading overlay */}
                        <div className={`game-loading-overlay ${unityLoaded ? 'hidden' : ''}`}>
                            <div className="loading-ring" />
                            <span className="loading-text">Loading Unity WebGL…</span>
                        </div>

                        {/* Game state overlay */}
                        {gameState && gameState.status === 'playing' && (
                            <div className="game-state-overlay">
                                <div className="game-state-chip">
                                    <div className="dot" style={{ background: '#22c55e' }} />
                                    Playing
                                </div>
                                <div className="game-state-chip">Score: {gameState.score}</div>
                                <div className="game-state-chip">Level: {gameState.level}</div>
                                <div className="game-state-chip">Moves: {gameState.moves}</div>
                                <div className="game-state-chip">Accuracy: {gameState.accuracy.toFixed(0)}%</div>
                            </div>
                        )}

                        <iframe
                            ref={iframeRef}
                            id="unity-frame"
                            src="/unity/index.html"
                            title="StakeStack Unity Game"
                            allow="fullscreen"
                            onLoad={() => {
                                setTimeout(() => setUnityLoaded(true), 1000)
                            }}
                        />
                    </div>

                    {/* Quick game controls */}
                    <div className="game-controls">
                        {GAME_QUICK_PROMPTS.map(p => (
                            <button
                                key={p.label}
                                className="game-ctrl-btn"
                                onClick={() => sendMessage(p.msg)}
                                disabled={status.type !== 'idle'}
                                title={p.msg}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </>
    )
}
