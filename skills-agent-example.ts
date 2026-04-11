#!/usr/bin/env npx tsx
/**
 * skills-agent-example.ts
 *
 * A portable, standalone agent that reads the StakeStack skills and can
 * autonomously play the game and make Solana MPP payments.
 *
 * Usage:
 *   npx tsx skills-agent-example.ts "start a bot match"
 *   npx tsx skills-agent-example.ts "get the paid data"
 *   npx tsx skills-agent-example.ts "go to main menu"
 *
 * Requirements:
 *   - OPENROUTER_API_KEY env var (or set it in .env.local)
 *   - Your Next.js dev server running: npm run dev
 *
 * This script is self-contained. You can copy it anywhere and give it to
 * any agent — it will fetch skills from /api/skills and use them.
 */

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL        = 'http://localhost:3000'  // ← change this if deploying
const SKILLS_ENDPOINT = `${BASE_URL}/api/skills`
const OPENROUTER_KEY  = process.env.OPENROUTER_API_KEY
const LLM_MODEL       = 'meta-llama/llama-3.3-70b-instruct:free' // free model

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

// ── Step 1: Fetch skills from the server ─────────────────────────────────────
async function fetchSkills(): Promise<SkillsResponse> {
    console.log(`\n📋 Fetching skills from ${SKILLS_ENDPOINT}…`)
    const res = await fetch(SKILLS_ENDPOINT)
    if (!res.ok) throw new Error(`Failed to fetch skills: ${res.status} ${await res.text()}`)
    const data = await res.json() as SkillsResponse
    console.log(`✅ Loaded ${data.tools.length} tools: ${data.tools.map((t: SkillsTool) => t.function.name).join(', ')}`)
    return data
}

// ── Step 2: Execute a tool call ───────────────────────────────────────────────
async function executeTool(name: string, args: Record<string, string>): Promise<string> {
    console.log(`\n🔧 Executing tool: ${name}`, args)

    if (name === 'control_game') {
        const { action } = args
        const res = await fetch(`${BASE_URL}/api/game`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            // ── AUTH GUARD (disabled — uncomment + add header when enabled) ──
            // headers: { 'Content-Type': 'application/json', 'X-Agent-Key': 'your-secret-key' },
            body: JSON.stringify({ action }),
        })
        const data = await res.json() as { ok?: boolean; queued?: { id: string }; error?: string }
        if (!res.ok || data.error) throw new Error(`Game API error: ${data.error ?? res.status}`)
        console.log(`✅ Game command sent: ${action} (id: ${data.queued?.id})`)
        return JSON.stringify({ success: true, action, commandId: data.queued?.id })
    }

    if (name === 'fetch_paid_data') {
        const res = await fetch(`${BASE_URL}/api/paid-data`, {
            // ── AUTH GUARD (disabled — uncomment + add header when enabled) ──
            // headers: { 'X-Agent-Key': 'your-secret-key' },
        })
        const data = await res.json() as { message?: string; error?: string }
        if (!res.ok || data.error) throw new Error(`Paid data error: ${data.error ?? res.status}`)
        console.log(`✅ Paid data received:`, data)
        return JSON.stringify({ success: true, data })
    }

    throw new Error(`Unknown tool: ${name}`)
}

// ── Step 3: Run the agent loop ────────────────────────────────────────────────
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
                model:    LLM_MODEL,
                messages,
                tools:    skills.tools,
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
                role:        'tool',
                tool_call_id: tc.id,
                name:        tc.function.name,
                content:     result,
            })
        }
    }

    throw new Error('Agent loop exceeded max iterations without a final answer.')
}

// ── Entry point ───────────────────────────────────────────────────────────────
const userInput = process.argv.slice(2).join(' ')

if (!userInput) {
    console.error(`
Usage: npx tsx skills-agent-example.ts "<your message>"

Examples:
  npx tsx skills-agent-example.ts "start a bot match"
  npx tsx skills-agent-example.ts "put me in practice mode"
  npx tsx skills-agent-example.ts "go back to main menu"
  npx tsx skills-agent-example.ts "get my practice stats"
  npx tsx skills-agent-example.ts "fetch the paid data"
`)
    process.exit(1)
}

runAgent(userInput).catch(err => {
    console.error('\n❌ Agent error:', err instanceof Error ? err.message : err)
    process.exit(1)
})
