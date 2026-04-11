/**
 * /api/game — Game command bridge between the AI agent and the Unity WebGL instance.
 *
 * POST /api/game  { action: string }  — Push a command onto the in-memory queue.
 * GET  /api/game                      — SSE stream that delivers queued commands to
 *                                       the Unity page and sends heartbeats every 3 s.
 *
 * Valid actions (from unity.md):
 *   StartBotMode | StartPracticeMode | StartMultiplayerMode | ExitToMainMenu | GetPracticeStatus
 */

import { NextRequest } from 'next/server'

// ── In-memory command queue (works in Next.js dev / single-process deploys) ──
// Each entry: { action: string, id: string, ts: number }
interface GameCommand {
    action: string
    id: string
    ts: number
}

// Module-level singleton — survives across requests in the same process.
const commandQueue: GameCommand[] = []
// Registered SSE clients (one per open Unity tab)
const clients: Set<ReadableStreamDefaultController<Uint8Array>> = new Set()

const encoder = new TextEncoder()

function sseEvent(data: object) {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
}

function heartbeat() {
    return encoder.encode(`: heartbeat\n\n`)
}

// ── AUTH GUARD (disabled — uncomment to enable) ──────────────────────────────
// const AGENT_API_KEY = process.env.AGENT_API_KEY
//
// function checkAuth(req: NextRequest): Response | null {
//     if (!AGENT_API_KEY) return null // no key configured → open
//     const provided = req.headers.get('x-agent-key')
//     if (provided !== AGENT_API_KEY) {
//         return Response.json({ error: 'Unauthorized. Provide X-Agent-Key header.' }, { status: 401 })
//     }
//     return null
// }
// ─────────────────────────────────────────────────────────────────────────────

// ── POST — Agent pushes a command ────────────────────────────────────────────
export async function POST(request: NextRequest) {
    // ── AUTH GUARD (disabled) ────────────────────────────────────────────────
    // const authError = checkAuth(request)
    // if (authError) return authError
    // ────────────────────────────────────────────────────────────────────────
    try {
        const body = await request.json()
        const { action } = body as { action?: string }

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

        const cmd: GameCommand = { action, id: crypto.randomUUID(), ts: Date.now() }
        commandQueue.push(cmd)
        console.log(`[game] Command queued: ${action} (${cmd.id}). Clients: ${clients.size}`)

        // Immediately push to all connected SSE clients
        for (const ctrl of clients) {
            try {
                ctrl.enqueue(sseEvent(cmd))
            } catch {
                // If the client disconnected, remove it
                clients.delete(ctrl)
            }
        }

        return Response.json({ ok: true, queued: cmd })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

// ── GET — Unity page subscribes via SSE ──────────────────────────────────────
export function GET() {
    let controller: ReadableStreamDefaultController<Uint8Array>
    let heartbeatTimer: ReturnType<typeof setInterval>

    const stream = new ReadableStream<Uint8Array>({
        start(ctrl) {
            controller = ctrl
            clients.add(ctrl)
            console.log(`[game] SSE client connected. Total: ${clients.size}`)

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
            'X-Accel-Buffering': 'no', // Nginx / Vercel: disable buffering
        },
    })
}

// Force dynamic — this route must never be statically cached
export const dynamic = 'force-dynamic'
