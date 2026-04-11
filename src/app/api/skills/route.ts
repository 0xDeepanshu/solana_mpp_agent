/**
 * GET /api/skills
 *
 * Returns the StakeStack agent skill definitions in OpenAI function-calling
 * (tool-use) format. Any LLM agent can fetch this endpoint to discover what
 * tools are available and how to call them.
 *
 * Also returns a plain-text system prompt snippet for agents that don't
 * support structured tool-calling (e.g. basic chat agents).
 */

// ── AUTH GUARD (disabled — uncomment to enable) ──────────────────────────────
// import { NextRequest } from 'next/server'
//
// const AGENT_API_KEY = process.env.AGENT_API_KEY
//
// function checkAuth(request: NextRequest): Response | null {
//     if (!AGENT_API_KEY) return null // no key configured → open
//     const provided = request.headers.get('x-agent-key')
//     if (provided !== AGENT_API_KEY) {
//         return Response.json({ error: 'Unauthorized. Provide X-Agent-Key header.' }, { status: 401 })
//     }
//     return null
// }
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

/** OpenAI-compatible tool definitions */
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'control_game',
            description:
                'Send a command to the StakeStack Unity WebGL game. ' +
                'Use this when the user wants to start a game mode, go to the main menu, or check stats. ' +
                'Commands are delivered via SSE; the game page must be open in a browser tab.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: [
                            'StartBotMode',
                            'StartPracticeMode',
                            'ExitToMainMenu',
                            'GetPracticeStatus',
                        ],
                        description:
                            'The game action to perform. ' +
                            'StartBotMode = start a bot/AI match. ' +
                            'StartPracticeMode = start a practice/solo match. ' +
                            'ExitToMainMenu = exit to the main menu. ' +
                            'GetPracticeStatus = fetch practice stats from Unity.',
                    },
                },
                required: ['action'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'fetch_paid_data',
            description:
                'Fetch data from the Solana MPP-gated endpoint. ' +
                'The server automatically handles the 402 payment flow using its agent wallet — ' +
                'no browser wallet or manual signing needed. ' +
                'Cost: 1 USDC on Solana Devnet. ' +
                'Use this when the user asks to fetch paid content, access gated data, or retrieve paid information.',
            parameters: {
                type: 'object',
                properties: {},
                required: [],
                additionalProperties: false,
            },
        },
    },
]

/** Plain-text system prompt for agents that don't support structured tool-calling */
const SYSTEM_PROMPT = `You are an autonomous agent for the StakeStack game. You have access to two HTTP tools:

TOOL 1: control_game
  Endpoint: POST ${BASE_URL}/api/game
  Body: { "action": "StartBotMode" | "StartPracticeMode" | "ExitToMainMenu" | "GetPracticeStatus" }
  Use when the user wants to play the game or change game modes.
  
  Natural language → action mapping:
  - "start a bot match", "play vs bot", "fight the AI" → StartBotMode
  - "practice mode", "solo mode", "train"             → StartPracticeMode
  - "go to main menu", "exit", "go back", "home"      → ExitToMainMenu
  - "get my stats", "how am I doing", "show score"    → GetPracticeStatus

TOOL 2: fetch_paid_data
  Endpoint: GET ${BASE_URL}/api/paid-data
  No body needed. The server auto-handles Solana MPP payment (1 USDC on Solana Devnet).
  Use when the user wants to fetch/access paid content.

Always call the appropriate HTTP endpoint and report the result to the user.`

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET(/* request: NextRequest */) {
    // ── AUTH GUARD (disabled) ──────────────────────────────────────────────
    // const authError = checkAuth(request)
    // if (authError) return authError
    // ──────────────────────────────────────────────────────────────────────

    return Response.json(
        {
            version: '1.0.0',
            name: 'StakeStack Agent Skills',
            description:
                'Tool definitions for autonomous StakeStack game control and Solana MPP payments.',
            baseUrl: BASE_URL,
            tools: TOOLS,
            systemPrompt: SYSTEM_PROMPT,
            docs: `${BASE_URL}/skills.md`,
        },
        {
            headers: {
                'Access-Control-Allow-Origin': '*', // allow any agent/script to fetch
                'Cache-Control': 'no-store',
            },
        }
    )
}

export const dynamic = 'force-dynamic'
