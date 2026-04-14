import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { agentFetchPaid } from '@/lib/agent-mpp'
import { loadProfile } from '@/lib/trainingStore'
import { generateProfile } from '@/lib/profileGenerator'
import { loadMatches, getMatchCount } from '@/lib/trainingStore'
import { makePayment, getSupportedChains, getRecommendedChain } from '@/lib/payments'
import type { SupportedChain } from '@/lib/payments/types'

function getOpenAIClient() {
    return new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
    })
}

// ── Supported game actions ───────────────────────────────────────────────────
const GAME_ACTIONS = {
    bot:      'StartBotMode',
    practice: 'StartPracticeMode',
    menu:     'ExitToMainMenu',
    stats:    'GetPracticeStatus',
} as const

type GameActionKey = keyof typeof GAME_ACTIONS
type GameActionValue = (typeof GAME_ACTIONS)[GameActionKey]

/** Maps natural-language intent to a Unity game action. Returns null if no match. */
function detectGameAction(message: string): GameActionValue | null {
    const m = message.toLowerCase()
    if (/bot.?match|vs bot|play.?bot|bot.?mode|fight.?bot/i.test(m))           return GAME_ACTIONS.bot
    if (/practice|solo|train|sandbox|practice.?match/i.test(m))                 return GAME_ACTIONS.practice
    if (/main.?menu|exit|go back|menu|home/i.test(m))                           return GAME_ACTIONS.menu
    if (/stats|status|score|result|practice.?stat|how.*(doing|perform)/i.test(m)) return GAME_ACTIONS.stats
    return null
}

/** Human-readable labels for game actions */
const ACTION_LABEL: Record<GameActionValue, string> = {
    StartBotMode:       'Start Bot Match',
    StartPracticeMode:  'Start Practice Match',
    ExitToMainMenu:     'Exit to Main Menu',
    GetPracticeStatus:  'Get Practice Stats',
}

/** Post a command to the /api/game SSE bridge */
async function dispatchGameCommand(action: GameActionValue, wallet?: string): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/api/game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, wallet }),
    })
    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Game bridge error ${res.status}: ${text}`)
    }
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const { message, wallet } = await request.json()

        if (!message || typeof message !== 'string') {
            return Response.json({ error: 'Message is required' }, { status: 400 })
        }

        // ── Load training profile if wallet is provided ──────────────────
        let trainingProfile = null
        let trainingContext = ''
        if (wallet && typeof wallet === 'string') {
            trainingProfile = loadProfile(wallet)
            if (!trainingProfile) {
                // Try generating on the fly if enough matches exist
                const matchCount = getMatchCount(wallet)
                if (matchCount >= 5) {
                    const matches = loadMatches(wallet)
                    trainingProfile = generateProfile(wallet, matches)
                }
            }
            if (trainingProfile) {
                trainingContext =
                    `\n\nPLAYER TRAINING PROFILE (use this to play like the user):\n` +
                    `- Skill tier: ${trainingProfile.skillTier}\n` +
                    `- Accuracy: ${trainingProfile.overallAccuracy.toFixed(1)}%\n` +
                    `- Speed: ${trainingProfile.speedTier} (avg ${trainingProfile.overallAvgResponseTimeMs.toFixed(0)}ms)\n` +
                    `- Stacking style: ${trainingProfile.stackingStyle}\n` +
                    `- Preferred columns: ${trainingProfile.preferredColumns.map(c => c + 1).join(', ') || 'none detected'}\n` +
                    `- Weak columns: ${trainingProfile.weakColumns.map(c => c + 1).join(', ') || 'none detected'}\n` +
                    `- Win rate: ${trainingProfile.winRate.toFixed(1)}%\n` +
                    `- Avg score: ${trainingProfile.avgScore.toFixed(0)} | Best: ${trainingProfile.bestScore}\n` +
                    `- Consistency: ${trainingProfile.consistencyScore.toFixed(0)}/100\n` +
                    `- Improvement trend: ${trainingProfile.improvementTrend > 0 ? 'improving' : 'declining'}\n` +
                    `\nFull strategy:\n${trainingProfile.strategySummary}`
            } else {
                const matchCount = getMatchCount(wallet)
                trainingContext =
                    `\n\nPLAYER TRAINING STATUS: Not yet trained. ` +
                    `(${matchCount}/5 matches played for training). ` +
                    `Tell the user to play more games manually so their agent can learn their style.`
            }
        }

        // ── Step 1: Detect game vs data intent ──────────────────────────
        const gameAction = detectGameAction(message)
        const wantsData  = /data|fetch|paid|content|get|show|give|retrieve|access/i.test(message)

        let gameCmdResult: string | null = null
        let paidData: unknown = null
        let paymentMade = false
        let paymentError: string | null = null

        // ── Step 2a: Dispatch game command ───────────────────────────────
        if (gameAction) {
            try {
                await dispatchGameCommand(gameAction, wallet)
                gameCmdResult = ACTION_LABEL[gameAction]
                console.log(`[agent] ✅ Game command dispatched: ${gameAction}`)
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                console.error('[agent] ❌ Game command failed:', msg)
                gameCmdResult = `FAILED: ${msg}`
            }
        }

        // ── Step 2b: Autonomously pay & fetch if data requested ─────────
        let paymentChain: SupportedChain | null = null
        if (wantsData && !gameAction) {
            // Detect preferred chain from message or use default
            const recommendedChain = getRecommendedChain()
            const msgLower = message.toLowerCase()
            if (/base|ethereum|evm/i.test(msgLower)) {
                paymentChain = msgLower.includes('ethereum') ? 'ethereum' : 'base'
            } else if (/solana/i.test(msgLower)) {
                paymentChain = 'solana-devnet'
            } else {
                paymentChain = recommendedChain
            }

            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
            const endpoint = paymentChain.startsWith('solana-')
                ? `${baseUrl}/api/paid-data`
                : `${baseUrl}/api/paid-data/evm?chain=${paymentChain}`
            console.log(`[agent] Fetching paid endpoint on ${paymentChain}: ${endpoint}`)

            try {
                if (paymentChain.startsWith('solana-')) {
                    // Solana MPP payment
                    paidData = await agentFetchPaid(endpoint)
                } else {
                    // EVM x402 payment
                    const result = await makePayment({
                        amount: '1000000', // 1 USDC
                        chain: paymentChain,
                        recipient: process.env.EVM_RECIPIENT_ADDRESS ?? process.env.MPP_RECIPIENT_ADDRESS ?? '',
                    })
                    if (!result.success) throw new Error(result.error)
                    paidData = {
                        message: 'Here is your paid data! 🎉',
                        chain: paymentChain,
                        protocol: 'x402',
                        txHash: result.txHash,
                    }
                }
                paymentMade = true
                console.log(`[agent] ✅ Payment successful on ${paymentChain}:`, paidData)
            } catch (err) {
                paymentError = err instanceof Error ? err.message : String(err)
                console.error(`[agent] ❌ Payment/fetch failed on ${paymentChain}:`, paymentError)
            }
        }

        // ── Step 3: Build system prompt ──────────────────────────────────
        let systemPrompt =
            'You are an AI agent that autonomously controls the StakeStack Unity game AND can make ' +
            'multi-chain payments to access paid data. ' +
            'Supported payment chains: Solana (MPP), Base (x402/EIP-3009), Ethereum (x402/EIP-3009). ' +
            'Default chain: Base (cheapest). ' +
            'The game is a competitive tile-stacking game where players stack tiles on columns. ' +
            'Available game modes: Bot Match, Practice Match, Main Menu, and Practice Stats.' +
            trainingContext

        if (gameCmdResult && !gameCmdResult.startsWith('FAILED')) {
            systemPrompt +=
                `\n\nYou just sent the "${gameCmdResult}" command to the StakeStack Unity game. ` +
                `The command was delivered successfully. ` +
                (trainingProfile
                    ? `The game is now playing using the player's trained profile (${trainingProfile.skillTier}, ${trainingProfile.overallAccuracy.toFixed(0)}% accuracy). Confirm this to the user.`
                    : `Confirm to the user that you've executed this action in the game.`)
        } else if (gameCmdResult?.startsWith('FAILED')) {
            systemPrompt +=
                `\n\nYou attempted to send a game command but it failed: ${gameCmdResult}. ` +
                `Inform the user and suggest checking if the Unity game page is open.`
        } else if (paymentMade && paidData) {
            systemPrompt +=
                `\n\nYou just made a Solana USDC payment (1 USDC on Devnet) to access a paid API endpoint. ` +
                `The payment was successful and you received this data:\n${JSON.stringify(paidData, null, 2)}\n\n` +
                `Present this data to the user and confirm that you autonomously handled the payment.`
        } else if (paymentError) {
            systemPrompt +=
                `\n\nYou attempted to make a Solana USDC payment for paid data but it failed with: ${paymentError}. ` +
                `Inform the user about this error.`
        } else {
            systemPrompt +=
                '\n\nAnswer the user\'s question. You can:\n' +
                '- Control the game: "start bot match", "practice mode", "main menu", "get stats"\n' +
                '- Fetch paid data: use keywords like "fetch", "get data", "show me the paid content"\n' +
                '- Discuss their training profile and agent performance'
        }

        // ── Step 4: LLM cascade (free models) ───────────────────────────
        const FREE_MODELS = [
            'qwen/qwen3.6-plus-preview:free',
            'stepfun/step-3.5-flash:free',
            'nvidia/nemotron-3-super-120b-a12b:free',
            'meta-llama/llama-3.2-3b-instruct:free',
            'meta-llama/llama-3.3-70b-instruct:free',
        ]

        let lastError = ''
        for (const model of FREE_MODELS) {
            try {
                console.log(`[agent] Trying model: ${model}`)
                const response = await getOpenAIClient().chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user',   content: message },
                    ],
                })

                const reply = response.choices[0]?.message?.content ?? 'No response from agent.'
                console.log(`[agent] ✅ Got reply from ${model}`)

                return Response.json({
                    reply,
                    paymentMade,
                    paymentError,
                    paymentChain,
                    model,
                    gameAction,
                    gameCmdResult,
                    trainingProfile: trainingProfile ? {
                        skillTier: trainingProfile.skillTier,
                        accuracy: trainingProfile.overallAccuracy,
                        matchesTrained: trainingProfile.totalMatches,
                    } : null,
                })
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                if (msg.includes('429') || msg.includes('404') || msg.includes('rate')) {
                    console.warn(`[agent] Model ${model} failed (${msg.slice(0, 60)}), trying next...`)
                    lastError = msg
                    continue
                }
                throw err
            }
        }

        return Response.json(
            { error: `All free models rate-limited. Last error: ${lastError}. Try adding $1 credits at openrouter.ai/settings/credits` },
            { status: 429 }
        )
    } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[agent route] Error:', errMsg)
        return Response.json({ error: errMsg }, { status: 500 })
    }
}
