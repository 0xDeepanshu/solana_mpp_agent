'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
    id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: Date
}

interface AgentStatus {
    type: 'idle' | 'thinking' | 'paying' | 'fetching' | 'done' | 'error'
    detail?: string
}

export default function AgentPage() {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'system',
            content:
                '🤖 Agent online. I can autonomously pay Solana MPP-protected endpoints using my on-chain wallet — no browser wallet needed. Try asking me to **fetch the paid data**.',
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [status, setStatus] = useState<AgentStatus>({ type: 'idle' })
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    async function sendMessage() {
        const text = input.trim()
        if (!text || status.type !== 'idle') return

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            timestamp: new Date(),
        }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setStatus({ type: 'thinking' })

        try {
            // Check if user wants data (mirrors server-side intent detection)
            const wantsData = /data|fetch|paid|content|get|show|give|retrieve|access/i.test(text)
            if (wantsData) {
                setStatus({ type: 'paying', detail: 'Agent is signing & broadcasting Solana tx...' })
            }

            const res = await fetch('/api/agent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text }),
            })

            const data = await res.json()

            if (!res.ok || data.error) {
                throw new Error(data.error ?? 'Unknown error')
            }

            // Prefix reply with payment confirmation badge if a payment was made
            const replyContent = data.paymentMade
                ? `💳 **Payment made:** 1 USDC on Solana Devnet\n\n${data.reply}`
                : data.reply

            setMessages(prev => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: replyContent,
                    timestamp: new Date(),
                },
            ])
            setStatus({ type: 'done' })
            setTimeout(() => setStatus({ type: 'idle' }), 2000)
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            setMessages(prev => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `❌ Error: ${msg}`,
                    timestamp: new Date(),
                },
            ])
            setStatus({ type: 'error', detail: msg })
            setTimeout(() => setStatus({ type: 'idle' }), 3000)
        }
    }

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
        fetching: '⟳ Fetching data...',
        done: '✓ Done',
        error: '✕ Error',
    }

    const statusColor: Record<AgentStatus['type'], string> = {
        idle: '#22c55e',
        thinking: '#f59e0b',
        paying: '#8b5cf6',
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
                }

                .agent-page {
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 0 1rem;
                }

                /* ── Header ── */
                .agent-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.25rem 0;
                    border-bottom: 1px solid rgba(139, 92, 246, 0.15);
                    flex-shrink: 0;
                }

                .agent-avatar {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #7c3aed, #2563eb);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.3rem;
                    box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);
                    flex-shrink: 0;
                }

                .agent-info { flex: 1; }

                .agent-name {
                    font-size: 1rem;
                    font-weight: 600;
                    color: #f1f5f9;
                    letter-spacing: -0.01em;
                }

                .agent-desc {
                    font-size: 0.75rem;
                    color: #64748b;
                    margin-top: 1px;
                }

                .agent-status-badge {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 999px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.06);
                    font-size: 0.72rem;
                    font-weight: 500;
                    transition: all 0.3s ease;
                    white-space: nowrap;
                }

                .status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    transition: all 0.3s ease;
                }

                /* ── Messages ── */
                .messages-area {
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem 0;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(139,92,246,0.2) transparent;
                }

                .messages-area::-webkit-scrollbar { width: 4px; }
                .messages-area::-webkit-scrollbar-thumb {
                    background: rgba(139,92,246,0.3);
                    border-radius: 99px;
                }

                .message {
                    display: flex;
                    gap: 0.75rem;
                    animation: fadeSlideIn 0.25s ease;
                }

                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                .message.user { flex-direction: row-reverse; }

                .msg-avatar {
                    width: 32px;
                    height: 32px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    flex-shrink: 0;
                    align-self: flex-end;
                }

                .msg-avatar.agent {
                    background: linear-gradient(135deg, #7c3aed, #2563eb);
                    box-shadow: 0 0 12px rgba(124,58,237,0.25);
                }

                .msg-avatar.user {
                    background: rgba(255,255,255,0.07);
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .msg-avatar.system {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.08);
                }

                .msg-body { max-width: 80%; }

                .msg-bubble {
                    padding: 0.85rem 1.1rem;
                    border-radius: 14px;
                    font-size: 0.88rem;
                    line-height: 1.6;
                    word-break: break-word;
                }

                .message.user .msg-bubble {
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    color: #fff;
                    border-bottom-right-radius: 4px;
                    box-shadow: 0 4px 20px rgba(124,58,237,0.25);
                }

                .message.assistant .msg-bubble {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #e2e8f0;
                    border-bottom-left-radius: 4px;
                }

                .message.system .msg-bubble {
                    background: rgba(139,92,246,0.08);
                    border: 1px solid rgba(139,92,246,0.15);
                    color: #a78bfa;
                    font-size: 0.82rem;
                    border-radius: 10px;
                }

                .msg-time {
                    font-size: 0.68rem;
                    color: #475569;
                    margin-top: 0.35rem;
                    padding: 0 0.25rem;
                }

                .message.user .msg-time { text-align: right; }

                /* ── Typing indicator ── */
                .typing-indicator {
                    display: flex;
                    gap: 0.75rem;
                    animation: fadeSlideIn 0.25s ease;
                }

                .typing-bubble {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 0.85rem 1.1rem;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.08);
                    border-radius: 14px;
                    border-bottom-left-radius: 4px;
                }

                .typing-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #7c3aed;
                    animation: typingBounce 1.2s infinite ease-in-out;
                }

                .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                .typing-dot:nth-child(3) { animation-delay: 0.4s; }

                @keyframes typingBounce {
                    0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
                    40% { transform: translateY(-5px); opacity: 1; }
                }

                .typing-label {
                    font-size: 0.75rem;
                    color: #a78bfa;
                    margin-left: 0.5rem;
                    font-weight: 500;
                }

                /* ── Payment banner ── */
                .payment-banner {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    background: rgba(139,92,246,0.1);
                    border: 1px solid rgba(139,92,246,0.25);
                    border-radius: 10px;
                    font-size: 0.8rem;
                    color: #a78bfa;
                    animation: fadeSlideIn 0.25s ease;
                }

                .payment-spinner {
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(139,92,246,0.3);
                    border-top-color: #7c3aed;
                    border-radius: 50%;
                    animation: spin 0.8s linear infinite;
                    flex-shrink: 0;
                }

                @keyframes spin { to { transform: rotate(360deg); } }

                /* ── Input area ── */
                .input-area {
                    padding: 1rem 0 1.25rem;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    flex-shrink: 0;
                }

                .input-row {
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-end;
                }

                .input-wrapper {
                    flex: 1;
                    position: relative;
                }

                .chat-input {
                    width: 100%;
                    padding: 0.85rem 1.1rem;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 14px;
                    color: #e2e8f0;
                    font-family: 'Inter', sans-serif;
                    font-size: 0.88rem;
                    outline: none;
                    resize: none;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease;
                    min-height: 48px;
                    max-height: 150px;
                }

                .chat-input::placeholder { color: #475569; }

                .chat-input:focus {
                    border-color: rgba(124,58,237,0.5);
                    box-shadow: 0 0 0 3px rgba(124,58,237,0.1);
                }

                .chat-input:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .send-btn {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: linear-gradient(135deg, #7c3aed, #6d28d9);
                    border: none;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                    box-shadow: 0 4px 15px rgba(124,58,237,0.3);
                }

                .send-btn:hover:not(:disabled) {
                    transform: scale(1.05);
                    box-shadow: 0 6px 20px rgba(124,58,237,0.4);
                }

                .send-btn:active:not(:disabled) { transform: scale(0.97); }

                .send-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                }

                .send-icon {
                    width: 18px;
                    height: 18px;
                    fill: none;
                    stroke: white;
                    stroke-width: 2;
                    stroke-linecap: round;
                    stroke-linejoin: round;
                }

                .hint-text {
                    margin-top: 0.6rem;
                    font-size: 0.72rem;
                    color: #334155;
                    text-align: center;
                }

                /* ── Quick prompts ── */
                .quick-prompts {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.75rem;
                }

                .quick-btn {
                    padding: 0.4rem 0.85rem;
                    background: rgba(139,92,246,0.08);
                    border: 1px solid rgba(139,92,246,0.2);
                    border-radius: 999px;
                    color: #a78bfa;
                    font-size: 0.75rem;
                    font-family: 'Inter', sans-serif;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }

                .quick-btn:hover {
                    background: rgba(139,92,246,0.16);
                    border-color: rgba(139,92,246,0.4);
                    color: #c4b5fd;
                }

                /* ── Info chips ── */
                .info-chips {
                    display: flex;
                    gap: 0.5rem;
                    padding: 0.75rem 0;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    margin-bottom: 0.25rem;
                    flex-wrap: wrap;
                }

                .chip {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.25rem 0.65rem;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 6px;
                    font-size: 0.7rem;
                    color: #64748b;
                    font-family: 'JetBrains Mono', monospace;
                }

                .chip-dot {
                    width: 5px;
                    height: 5px;
                    border-radius: 50%;
                    background: #22c55e;
                }
            `}</style>

            <div className="agent-page">
                {/* Header */}
                <header className="agent-header">
                    <div className="agent-avatar">🤖</div>
                    <div className="agent-info">
                        <div className="agent-name">MPP Payment Agent</div>
                        <div className="agent-desc">Powered by Llama 3.3 70B (free) · Solana Devnet · OpenRouter</div>
                    </div>
                    <div
                        className="agent-status-badge"
                        style={{ color: statusColor[status.type] }}
                    >
                        <div className="status-dot" style={{ background: statusColor[status.type] }} />
                        {statusLabel[status.type]}
                    </div>
                </header>

                {/* Info chips */}
                <div className="info-chips">
                    <div className="chip">
                        <div className="chip-dot" />
                        Solana Devnet
                    </div>
                    <div className="chip">🪙 USDC · 1 USDC per call</div>
                    <div className="chip">🔐 Agent auto-signs tx</div>
                    <div className="chip">🛠 Tool: fetch_paid_data</div>
                </div>

                {/* Messages */}
                <div className="messages-area">
                    {messages.map(msg => (
                        <div key={msg.id} className={`message ${msg.role}`}>
                            <div className={`msg-avatar ${msg.role === 'user' ? 'user' : msg.role === 'system' ? 'system' : 'agent'}`}>
                                {msg.role === 'user' ? '👤' : msg.role === 'system' ? '⚙️' : '🤖'}
                            </div>
                            <div className="msg-body">
                                <div className="msg-bubble" dangerouslySetInnerHTML={{
                                    __html: msg.content
                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\n/g, '<br/>')
                                }} />
                                <div className="msg-time">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Typing + paying indicators */}
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
                    <div className="quick-prompts">
                        {['Fetch the paid data', 'What can you access?', 'Pay and get me the data'].map(p => (
                            <button
                                key={p}
                                className="quick-btn"
                                onClick={() => setInput(p)}
                                disabled={status.type !== 'idle'}
                            >
                                {p}
                            </button>
                        ))}
                    </div>

                    <div className="input-row">
                        <div className="input-wrapper">
                            <textarea
                                id="chat-input"
                                className="chat-input"
                                placeholder="Ask the agent to fetch paid data..."
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
                            onClick={sendMessage}
                            disabled={!input.trim() || status.type !== 'idle'}
                            title="Send message"
                        >
                            <svg className="send-icon" viewBox="0 0 24 24">
                                <line x1="22" y1="2" x2="11" y2="13" />
                                <polygon points="22 2 15 22 11 13 2 9 22 2" />
                            </svg>
                        </button>
                    </div>
                    <p className="hint-text">
                        Press Enter to send · Agent autonomously handles Solana MPP payments
                    </p>
                </div>
            </div>
        </>
    )
}
