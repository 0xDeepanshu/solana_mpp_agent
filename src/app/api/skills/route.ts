/**
 * GET /api/skills
 *
 * Returns the StakeStack agent skill definitions in OpenAI function-calling
 * (tool-use) format. Any LLM agent can fetch this endpoint to discover what
 * tools are available and how to call them.
 *
 * Now includes training system tools.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

/** OpenAI-compatible tool definitions */
const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'check_bot_eligibility',
            description:
                'Check if a wallet has played at least 5 matches and training status. ' +
                'ALWAYS call this before calling control_game with StartBotMode. ' +
                'If botUnlocked is false, tell the user how many matches they still need.',
            parameters: {
                type: 'object',
                properties: {
                    wallet: {
                        type: 'string',
                        description: 'The Solana wallet public key (base58) to check eligibility for.',
                    },
                },
                required: ['wallet'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'control_game',
            description:
                'Send a command to the StakeStack Unity WebGL game. ' +
                'Use this when the user wants to start a game mode, go to the main menu, or check stats. ' +
                'Commands are delivered via SSE; the game page must be open in a browser tab. ' +
                'When starting a bot match, the player\'s training profile will be used if available.',
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
                            'StartBotMode = start a bot/AI match (uses training profile). ' +
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
    {
        type: 'function',
        function: {
            name: 'get_training_profile',
            description:
                'Get the player\'s training profile showing their agent\'s learned behavior. ' +
                'Shows accuracy, speed, stacking style, preferred columns, skill tier, and strategy summary. ' +
                'Use this when the user asks about their agent training, skill level, or wants to see how their agent will play.',
            parameters: {
                type: 'object',
                properties: {
                    wallet: {
                        type: 'string',
                        description: 'The Solana wallet public key (base58) to get training profile for.',
                    },
                },
                required: ['wallet'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_training_stats',
            description:
                'Get detailed training statistics and match history for the dashboard. ' +
                'Shows win/loss record, accuracy trends, score history, and per-match breakdown. ' +
                'Use this when the user asks about their training progress or match history.',
            parameters: {
                type: 'object',
                properties: {
                    wallet: {
                        type: 'string',
                        description: 'The Solana wallet public key (base58).',
                    },
                    limit: {
                        type: 'number',
                        description: 'Number of recent matches to return (default 20).',
                    },
                },
                required: ['wallet'],
                additionalProperties: false,
            },
        },
    },
]

/** Plain-text system prompt for agents that don't support structured tool-calling */
const SYSTEM_PROMPT = `You are an autonomous agent for the StakeStack tile-stacking game. You have access to five HTTP tools:

TOOL 0: check_bot_eligibility  ← ALWAYS call this before StartBotMode
  Endpoint: GET ${BASE_URL}/api/player/status?wallet=<PUBKEY>
  Returns: { wallet, matches, botUnlocked, training: { matchesPlayed, ready, skillTier, accuracy } }
  Bot Mode requires matches >= 5. If botUnlocked is false, tell the user how many more matches they need.

TOOL 1: control_game
  Endpoint: POST ${BASE_URL}/api/game
  Body: { "action": "StartBotMode" | "StartPracticeMode" | "ExitToMainMenu" | "GetPracticeStatus" }
  Use when the user wants to play the game or change game modes.
  IMPORTANT: Only call StartBotMode after check_bot_eligibility confirms botUnlocked === true.
  When the player has a training profile, the agent will play using their learned style.
  
  Natural language → action mapping:
  - "start a bot match", "play vs bot", "fight the AI" → StartBotMode  (only if eligible)
  - "practice mode", "solo mode", "train"             → StartPracticeMode
  - "go to main menu", "exit", "go back", "home"      → ExitToMainMenu
  - "get my stats", "how am I doing", "show score"    → GetPracticeStatus

TOOL 2: fetch_paid_data
  Endpoint: GET ${BASE_URL}/api/paid-data
  No body needed. The server auto-handles Solana MPP payment (1 USDC on Solana Devnet).
  Use when the user wants to fetch/access paid content.

TOOL 3: get_training_profile
  Endpoint: GET ${BASE_URL}/api/training/profile?wallet=<PUBKEY>
  Returns the player's training profile: skill tier, accuracy, speed, stacking style, strategy.
  Use when the user asks about their agent's training or skill level.

TOOL 4: get_training_stats
  Endpoint: GET ${BASE_URL}/api/training/stats?wallet=<PUBKEY>&limit=<N>
  Returns match history and aggregate training statistics.
  Use when the user wants to see their training progress or history.

Always call the appropriate HTTP endpoint and report the result to the user.`

// ── Handler ───────────────────────────────────────────────────────────────────
export async function GET() {
    return Response.json(
        {
            version: '2.0.0',
            name: 'StakeStack Agent Skills',
            description:
                'Tool definitions for autonomous StakeStack game control, Solana MPP payments, and agent training.',
            baseUrl: BASE_URL,
            tools: TOOLS,
            systemPrompt: SYSTEM_PROMPT,
        },
        {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-store',
            },
        }
    )
}

export const dynamic = 'force-dynamic'
