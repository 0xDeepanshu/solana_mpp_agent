/**
 * GET /api/skills
 *
 * Returns the StakeStack agent skill definitions in OpenAI function-calling format.
 * Now includes multi-chain payment tools and ERC-8004 agent identity.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'check_bot_eligibility',
            description:
                'Check if a wallet has played at least 5 matches and training status. ' +
                'ALWAYS call this before calling control_game with StartBotMode.',
            parameters: {
                type: 'object',
                properties: {
                    wallet: { type: 'string', description: 'The Solana wallet public key (base58).' },
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
                'Commands are delivered via SSE; the game page must be open in a browser tab. ' +
                'When starting a bot match, the player\'s training profile will be used if available.',
            parameters: {
                type: 'object',
                properties: {
                    action: {
                        type: 'string',
                        enum: ['StartBotMode', 'StartPracticeMode', 'ExitToMainMenu', 'GetPracticeStatus'],
                        description: 'The game action to perform.',
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
                'Fetch data from a multi-chain paid endpoint. ' +
                'Supports: Solana (MPP), Base (x402/EIP-3009), Ethereum (x402/EIP-3009). ' +
                'Default chain: Base (cheapest). Cost: 1 USDC. ' +
                'The server handles payments autonomously — no browser wallet needed. ' +
                'Mention chain name in your message to use a specific chain (e.g. "on Base" or "on Solana").',
            parameters: {
                type: 'object',
                properties: {
                    chain: {
                        type: 'string',
                        enum: ['solana-devnet', 'base', 'ethereum'],
                        description: 'Payment chain. Default: base (cheapest EVM).',
                    },
                },
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
                'Get the player\'s training profile showing their agent\'s learned behavior.',
            parameters: {
                type: 'object',
                properties: {
                    wallet: { type: 'string', description: 'The Solana wallet public key (base58).' },
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
                'Get detailed training statistics and match history.',
            parameters: {
                type: 'object',
                properties: {
                    wallet: { type: 'string', description: 'The Solana wallet public key (base58).' },
                    limit: { type: 'number', description: 'Number of recent matches (default 20).' },
                },
                required: ['wallet'],
                additionalProperties: false,
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_supported_chains',
            description:
                'Get the list of supported payment chains, their protocols (MPP/x402), and USDC addresses. ' +
                'Use this when the user asks about payment options or supported chains.',
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
            name: 'register_agent_identity',
            description:
                'Register the StakeStack agent onchain using ERC-8004. ' +
                'Creates a globally unique onchain identity on Base or Ethereum. ' +
                'Use this when the user wants to register the agent onchain or set up agent identity.',
            parameters: {
                type: 'object',
                properties: {
                    name: { type: 'string', description: 'Agent name (default: StakeStack Agent).' },
                    description: { type: 'string', description: 'What the agent does.' },
                    chain: { type: 'string', enum: ['base', 'ethereum'], description: 'Chain to register on (default: base).' },
                },
                required: [],
                additionalProperties: false,
            },
        },
    },
]

const SYSTEM_PROMPT = `You are an autonomous agent for the StakeStack tile-stacking game with MULTI-CHAIN payment support.

PAYMENT CHAINS:
- Base (x402/EIP-3009) — DEFAULT, cheapest ($0.001 gas)
- Ethereum (x402/EIP-3009) — Maximum decentralization
- Solana Devnet (MPP) — For Solana-native payments

TOOLS:
1. check_bot_eligibility — Check wallet status before bot matches
2. control_game — Send game commands (StartBotMode, StartPracticeMode, etc.)
3. fetch_paid_data — Pay 1 USDC on any supported chain to get data
4. get_training_profile — View agent training profile
5. get_training_stats — View match history
6. get_supported_chains — List all payment chains and protocols
7. register_agent_identity — Register agent onchain (ERC-8004)

To use a specific chain for payments, mention it in context (e.g. "pay on Base" or "use Solana").

Always call the appropriate endpoint and report results to the user.`

export async function GET() {
    return Response.json(
        {
            version: '3.0.0',
            name: 'StakeStack Agent Skills',
            description: 'Multi-chain agent tools: Solana MPP, EVM x402, game control, training, ERC-8004 identity.',
            baseUrl: BASE_URL,
            tools: TOOLS,
            systemPrompt: SYSTEM_PROMPT,
            chains: [
                { chain: 'solana-devnet', protocol: 'MPP', usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU' },
                { chain: 'base', protocol: 'x402', usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', recommended: true },
                { chain: 'ethereum', protocol: 'x402', usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
            ],
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
