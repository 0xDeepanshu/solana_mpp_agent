/**
 * /api/game — Game command bridge between the AI agent and the Unity WebGL instance.
 *
 * POST /api/game  { action: string, wallet?: string }  — Push a command onto the in-memory queue.
 * GET  /api/game                      — SSE stream that delivers queued commands to
 *                                       the Unity page and sends heartbeats every 3 s.
 *
 * Valid actions (from unity.md):
 *   StartBotMode | StartPracticeMode | StartMultiplayerMode | ExitToMainMenu | GetPracticeStatus
 *
 * Unity can POST to /api/game/state to update game state back to the web UI.
 */

import { NextRequest } from 'next/server'

// ── In-memory command queue (works in Next.js dev / single-process deploys) ──
interface GameCommand {
    action: string
    wallet?: string
    id: string
    ts: number
}

// ── Game state (updated by Unity, pushed to web clients) ────────────────────
interface GameState {
    status: 'idle' | 'playing' | 'paused' | 'finished'
    mode: string | null
    score: number
    level: number
    moves: number
    accuracy: number
    wallet: string | null
    matchId: string | null
    startedAt: number | null
    lastUpdate: number
}

// Module-level singleton
const commandQueue: GameCommand[] = []
const clients: Set<ReadableStreamDefaultController<Uint8Array>> = new Set()

// Current game state — Unity updates this, web UI reads it via SSE
let gameState: GameState = {
    status: 'idle',
    mode: null,
    score: 0,
    level: 1,
    moves: 0,
    accuracy: 100,
    wallet: null,
    matchId: null,
    startedAt: null,
    lastUpdate: Date.now(),
}

// Connected wallets registry (so Unity knows which wallet to use for training data)
const connectedWallets: Map<string, { connectedAt: number; lastSeen: number }> = new Map()

const encoder = new TextEncoder()

function sseEvent(data: object) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

function heartbeat() {
    return encoder.encode(`: heartbeat\n\n`)
}

function broadcastToClients(data: object) {
    for (const ctrl of clients) {
        try {
            ctrl.enqueue(sseEvent(data))
        } catch {
            clients.delete(ctrl)
        }
    }
}

// ── POST — Agent pushes a command ────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, wallet, gameState: stateUpdate } = body as {
            action?: string
            wallet?: string
            gameState?: Partial<GameState>
        }

        // ── Handle game state updates from Unity ────────────────────────
        if (stateUpdate && !action) {
            gameState = {
                ...gameState,
                ...stateUpdate,
                lastUpdate: Date.now(),
            }
            // Broadcast state update to all connected web clients
            broadcastToClients({ type: 'gameState', state: gameState })
            console.log(`[game] State updated: ${gameState.status} | score: ${gameState.score} | level: ${gameState.level}`)
            return Response.json({ ok: true, state: gameState })
        }

        // ── Handle wallet registration ──────────────────────────────────
        if (body.type === 'registerWallet' && wallet) {
            connectedWallets.set(wallet, { connectedAt: Date.now(), lastSeen: Date.now() })
            gameState.wallet = wallet
            broadcastToClients({ type: 'walletRegistered', wallet })
            console.log(`[game] Wallet registered: ${wallet.slice(0, 8)}…`)
            return Response.json({ ok: true, wallet })
        }

        // ── Handle game commands ────────────────────────────────────────
        const validActions = [
            'StartBotMode',
            'StartPracticeMode',
            'StartMultiplayerMode',
            'ExitToMainMenu',
            'GetPracticeStatus',
        ]

        if (!action || !validActions.includes(action)) {
            return Response.json(
                { error: `Invalid action. Must be one of: ${validActions.join(', ')}` },
                { status: 400 }
            )
        }

        const cmd: GameCommand = { action, wallet, id: crypto.randomUUID(), ts: Date.now() }
        commandQueue.push(cmd)

        // If wallet provided, associate with game state
        if (wallet) {
            gameState.wallet = wallet
            connectedWallets.set(wallet, { connectedAt: Date.now(), lastSeen: Date.now() })
        }

        console.log(`[game] Command queued: ${action} (${cmd.id}) wallet: ${wallet?.slice(0, 8) ?? 'none'}. Clients: ${clients.size}`)

        // Immediately push to all connected SSE clients
        broadcastToClients(cmd)

        return Response.json({ ok: true, queued: cmd })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

// ── GET — Unity page subscribes via SSE ──────────────────────────────────────
export function GET(request: NextRequest) {
    // Check if this is a state request (for the web dashboard)
    const mode = request.nextUrl.searchParams.get('mode')
    if (mode === 'state') {
        return Response.json(gameState)
    }

    let controller: ReadableStreamDefaultController<Uint8Array>
    let heartbeatTimer: ReturnType<typeof setInterval>

    const stream = new ReadableStream<Uint8Array>({
        start(ctrl) {
            controller = ctrl
            clients.add(ctrl)
            console.log(`[game] SSE client connected. Total: ${clients.size}`)

            // Send current game state immediately
            ctrl.enqueue(sseEvent({ type: 'connected', state: gameState }))

            // Drain any commands that arrived before this client connected
            while (commandQueue.length > 0) {
                const cmd = commandQueue.shift()!
                ctrl.enqueue(sseEvent(cmd))
            }

            // Heartbeat every 3 s to keep the connection alive
            heartbeatTimer = setInterval(() => {
                try {
                    ctrl.enqueue(heartbeat())
                } catch {
                    clearInterval(heartbeatTimer)
                    clients.delete(ctrl)
                }
            }, 3000)
        },
        cancel() {
            clearInterval(heartbeatTimer)
            clients.delete(controller)
            console.log(`[game] SSE client disconnected. Total: ${clients.size}`)
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}

// Force dynamic — this route must never be statically cached
export const dynamic = 'force-dynamic'
