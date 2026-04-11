#!/usr/bin/env npx tsx
/**
 * skills-agent-example.ts
 *
 * A portable, standalone agent that reads the StakeStack skills and can
 * autonomously play the game and make Solana MPP payments.
 *
 * ─── Modes ───────────────────────────────────────────────────────────────────
 *
 *  Natural language (no wallet needed):
 *    npx tsx skills-agent-example.ts "start a bot match"
 *    npx tsx skills-agent-example.ts "get the paid data"
 *    npx tsx skills-agent-example.ts "go to main menu"
 *
 *  Check if wallet is eligible for Bot Mode (needs 5 matches):
 *    npx tsx skills-agent-example.ts --wallet <PUBKEY> --check
 *
 *  Autonomous Bot Loop (checks eligibility first, then plays continuously):
 *    npx tsx skills-agent-example.ts --wallet <PUBKEY> --bot-loop
 *    npx tsx skills-agent-example.ts --wallet <PUBKEY> --bot-loop --rounds 3
 *    npx tsx skills-agent-example.ts --wallet <PUBKEY> --bot-loop --delay 30
 *
 * ─── Requirements ─────────────────────────────────────────────────────────────
 *  - OPENROUTER_API_KEY env var (or set it in .env.local)
 *  - Your Next.js dev server running: npm run dev
 */

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL        = 'http://localhost:3000'
const SKILLS_ENDPOINT = `${BASE_URL}/api/skills`
const OPENROUTER_KEY  = process.env.OPENROUTER_API_KEY
const LLM_MODEL       = 'anthropic/claude-sonnet-4-5' // reads skills.md well

// ── Types ─────────────────────────────────────────────────────────────────────
interface SkillsTool {
    type: 'function'
    function: {
        name: string
        description: string
        parameters: Record<string, unknown>
    }
}

interface SkillsResponse {
    tools: SkillsTool[]
    systemPrompt: string
}

interface ChatMessage {
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    tool_call_id?: string
    name?: string
}

interface ToolCall {
    id: string
    type: 'function'
    function: {
        name: string
        arguments: string
    }
}

interface PlayerStatus {
    wallet: string
    matches: number
    botUnlocked: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sleep(ms: number) {
    return new Promise<void>(resolve => setTimeout(resolve, ms))
}

function parseArgs(): { wallet?: string; check: boolean; botLoop: boolean; rounds: number; delay: number; message: string } {
    const args = process.argv.slice(2)
    let wallet: string | undefined
    let check = false
    let botLoop = false
    let rounds = Infinity
    let delay = 15   // seconds between matches
    const rest: string[] = []

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--wallet' && args[i + 1]) {
            wallet = args[++i]
        } else if (args[i] === '--check') {
            check = true
        } else if (args[i] === '--bot-loop') {
            botLoop = true
        } else if (args[i] === '--rounds' && args[i + 1]) {
            rounds = parseInt(args[++i], 10)
        } else if (args[i] === '--delay' && args[i + 1]) {
            delay = parseInt(args[++i], 10)
        } else {
            rest.push(args[i])
        }
    }

    return { wallet, check, botLoop, rounds, delay, message: rest.join(' ') }
}

// ── Step 1: Fetch skills from the server ─────────────────────────────────────
async function fetchSkills(): Promise<SkillsResponse> {
    console.log(`\n📋 Fetching skills from ${SKILLS_ENDPOINT}…`)
    const res = await fetch(SKILLS_ENDPOINT)
    if (!res.ok) throw new Error(`Failed to fetch skills: ${res.status} ${await res.text()}`)
    const data = await res.json() as SkillsResponse
    console.log(`✅ Loaded ${data.tools.length} tools: ${data.tools.map((t: SkillsTool) => t.function.name).join(', ')}`)
    return data
}

// ── Check player eligibility ──────────────────────────────────────────────────
async function checkEligibility(wallet: string): Promise<PlayerStatus> {
    const res = await fetch(`${BASE_URL}/api/player/status?wallet=${encodeURIComponent(wallet)}`)
    if (!res.ok) throw new Error(`Status check failed: ${res.status}`)
    return res.json() as Promise<PlayerStatus>
}

// ── Send a game command directly (no LLM needed) ──────────────────────────────
async function sendGameCommand(action: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/api/game`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action }),
    })
    const data = await res.json() as { ok?: boolean; queued?: { id: string }; error?: string }
    if (!res.ok || data.error) throw new Error(`Game API error: ${data.error ?? res.status}`)
    console.log(`   ✅ ${action} sent (id: ${data.queued?.id})`)
}

// ── Step 2: Execute a tool call ───────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, string>): Promise<string> {
    console.log(`\n🔧 Executing tool: ${name}`, args)

    if (name === 'control_game') {
        const { action } = args
        const res = await fetch(`${BASE_URL}/api/game`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        })
        const data = await res.json() as { ok?: boolean; queued?: { id: string }; error?: string }
        if (!res.ok || data.error) throw new Error(`Game API error: ${data.error ?? res.status}`)
        console.log(`✅ Game command sent: ${action} (id: ${data.queued?.id})`)
        return JSON.stringify({ success: true, action, commandId: data.queued?.id })
    }

    if (name === 'check_bot_eligibility') {
        const { wallet } = args
        if (!wallet) throw new Error('check_bot_eligibility requires a wallet argument')
        const status = await checkEligibility(wallet)
        console.log(`✅ Eligibility: ${status.matches}/5 matches — bot ${status.botUnlocked ? 'UNLOCKED' : 'LOCKED'}`)
        return JSON.stringify(status)
    }

    if (name === 'fetch_paid_data') {
        const res = await fetch(`${BASE_URL}/api/paid-data`)
        const data = await res.json() as { message?: string; error?: string }
        if (!res.ok || data.error) throw new Error(`Paid data error: ${data.error ?? res.status}`)
        console.log(`✅ Paid data received:`, data)
        return JSON.stringify({ success: true, data })
    }

    throw new Error(`Unknown tool: ${name}`)
}

// ── Step 3: Run the agent loop (LLM-driven) ───────────────────────────────────
async function runAgent(userMessage: string) {
    if (!OPENROUTER_KEY) {
        throw new Error(
            'OPENROUTER_API_KEY is not set.\n' +
            'Add it to .env.local or run: OPENROUTER_API_KEY=your-key npx tsx skills-agent-example.ts "..."'
        )
    }

    const skills = await fetchSkills()

    const messages: ChatMessage[] = [
        { role: 'system', content: skills.systemPrompt },
        { role: 'user',   content: userMessage },
    ]

    console.log(`\n🤖 Agent processing: "${userMessage}"`)

    // Agentic loop — keep going until the model stops calling tools
    for (let iteration = 0; iteration < 5; iteration++) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method:  'POST',
            headers: {
                'Content-Type':  'application/json',
                Authorization:  `Bearer ${OPENROUTER_KEY}`,
            },
            body: JSON.stringify({
                model:       LLM_MODEL,
                messages,
                tools:       skills.tools,
                tool_choice: 'auto',
            }),
        })

        if (!res.ok) {
            const text = await res.text()
            throw new Error(`LLM error ${res.status}: ${text}`)
        }

        const completion = await res.json() as {
            choices: Array<{
                message: {
                    role: string
                    content: string | null
                    tool_calls?: ToolCall[]
                }
                finish_reason: string
            }>
        }

        const choice  = completion.choices[0]
        const msg     = choice.message
        const toolCalls: ToolCall[] = msg.tool_calls ?? []

        // Add assistant message to history
        messages.push({
            role:    'assistant',
            content: msg.content ?? '',
            ...(toolCalls.length > 0 ? { tool_calls: toolCalls } as unknown as object : {}),
        })

        // No more tool calls → final answer
        if (toolCalls.length === 0 || choice.finish_reason === 'stop') {
            console.log(`\n💬 Agent response:\n${msg.content}`)
            return msg.content
        }

        // Execute each tool call and append results
        for (const tc of toolCalls) {
            let result: string
            try {
                const args = JSON.parse(tc.function.arguments) as Record<string, string>
                result = await executeTool(tc.function.name, args)
            } catch (err) {
                result = JSON.stringify({ error: err instanceof Error ? err.message : String(err) })
            }

            messages.push({
                role:         'tool',
                tool_call_id: tc.id,
                name:         tc.function.name,
                content:      result,
            })
        }
    }

    throw new Error('Agent loop exceeded max iterations without a final answer.')
}

// ── Autonomous Bot Loop (no LLM needed — direct API calls) ────────────────────
async function runBotLoop(wallet: string, maxRounds: number, delaySec: number) {
    console.log(`\n🤖 Bot Loop starting for wallet: ${wallet.slice(0, 8)}…`)
    console.log(`   Rounds: ${maxRounds === Infinity ? '∞ (Ctrl+C to stop)' : maxRounds}`)
    console.log(`   Delay between matches: ${delaySec}s\n`)

    // 1. Eligibility check
    const status = await checkEligibility(wallet)
    console.log(`📊 Match history: ${status.matches}/5 played — bot mode ${status.botUnlocked ? '✅ UNLOCKED' : '🔒 LOCKED'}`)

    if (!status.botUnlocked) {
        console.log(`\n❌ Bot Mode is locked.`)
        console.log(`   You need ${5 - status.matches} more match(es).`)
        console.log(`   Play manually in the game, or test with:`)
        console.log(`   curl -X POST http://localhost:3000/api/player/record -H "Content-Type: application/json" -d '{"wallet":"${wallet}","result":"win"}'`)
        process.exit(1)
    }

    console.log(`\n🚀 Starting autonomous bot matches…\n`)

    let round = 0
    while (round < maxRounds) {
        round++
        console.log(`─── Round ${round}${maxRounds !== Infinity ? `/${maxRounds}` : ''} ───────────────────────────────────`)

        // Start bot match
        process.stdout.write(`   Starting bot match… `)
        await sendGameCommand('StartBotMode')

        // Wait for the match duration
        console.log(`   ⏳ Waiting ${delaySec}s for match to run…`)
        await sleep(delaySec * 1000)

        // Exit back to menu
        process.stdout.write(`   Exiting to main menu… `)
        await sendGameCommand('ExitToMainMenu')

        console.log(`   ✅ Round ${round} complete.\n`)

        // If more rounds left, wait a beat before the next
        if (round < maxRounds) {
            await sleep(2000)
        }
    }

    console.log(`\n🏁 Bot loop finished. ${round} round(s) completed.`)
}

// ── Entry point ───────────────────────────────────────────────────────────────
async function main() {
    const { wallet, check, botLoop, rounds, delay, message } = parseArgs()

    // --check: just print eligibility and exit
    if (check) {
        if (!wallet) {
            console.error('❌ --check requires --wallet <PUBKEY>')
            process.exit(1)
        }
        const status = await checkEligibility(wallet)
        console.log(`\n📊 Wallet: ${status.wallet}`)
        console.log(`   Matches played: ${status.matches}/5`)
        console.log(`   Bot Mode: ${status.botUnlocked ? '✅ UNLOCKED' : `🔒 LOCKED (need ${5 - status.matches} more)`}`)
        return
    }

    // --bot-loop: autonomous play loop
    if (botLoop) {
        if (!wallet) {
            console.error('❌ --bot-loop requires --wallet <PUBKEY>')
            process.exit(1)
        }
        await runBotLoop(wallet, rounds, delay)
        return
    }

    // Natural language mode (LLM-driven)
    if (!message) {
        console.error(`
Usage: npx tsx skills-agent-example.ts "<your message>"
       npx tsx skills-agent-example.ts --wallet <PUBKEY> --check
       npx tsx skills-agent-example.ts --wallet <PUBKEY> --bot-loop [--rounds N] [--delay SECONDS]

Examples:
  npx tsx skills-agent-example.ts "start a bot match"
  npx tsx skills-agent-example.ts "put me in practice mode"
  npx tsx skills-agent-example.ts "go back to main menu"
  npx tsx skills-agent-example.ts "get my practice stats"
  npx tsx skills-agent-example.ts "fetch the paid data"
  npx tsx skills-agent-example.ts --wallet GrtjuV...zuX --check
  npx tsx skills-agent-example.ts --wallet GrtjuV...zuX --bot-loop --rounds 5 --delay 60
`)
        process.exit(1)
    }

    await runAgent(message)
}

main().catch(err => {
    console.error('\n❌ Agent error:', err instanceof Error ? err.message : err)
    process.exit(1)
})
