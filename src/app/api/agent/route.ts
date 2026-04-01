import OpenAI from 'openai'
import { NextRequest } from 'next/server'
import { agentFetchPaid } from '@/lib/agent-mpp'

const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
})

// ── Route handler ───────────────────────────────────────────────────────────
// Instead of relying on tool-calling (not supported on free models),
// the agent always fetches paid data first, then sends it as context to the LLM.
// This way any free model works.

export async function POST(request: NextRequest) {
    try {
        const { message } = await request.json()

        if (!message || typeof message !== 'string') {
            return Response.json({ error: 'Message is required' }, { status: 400 })
        }

        // ── Step 1: Autonomously pay & fetch the protected data ──
        let paidData: unknown = null
        let paymentMade = false
        let paymentError: string | null = null

        // Only fetch paid data if the user is asking for it
        const wantsData = /data|fetch|paid|content|get|show|give|retrieve|access/i.test(message)

        if (wantsData) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
            const endpoint = `${baseUrl}/api/paid-data`
            console.log(`[agent] Fetching paid endpoint: ${endpoint}`)

            try {
                paidData = await agentFetchPaid(endpoint)
                paymentMade = true
                console.log('[agent] ✅ Payment successful, data received:', paidData)
            } catch (err) {
                paymentError = err instanceof Error ? err.message : String(err)
                console.error('[agent] ❌ Payment/fetch failed:', paymentError)
            }
        }

        // ── Step 2: Build context for the LLM ──
        let systemPrompt =
            'You are a helpful AI agent connected to a Solana MPP (Micro-Payment Protocol) system. ' +
            'MPP lets APIs charge for access using on-chain USDC payments on Solana. ' +
            'You have your own Solana wallet and can autonomously pay for data access.'

        if (paymentMade && paidData) {
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
                '\n\nAnswer the user\'s question directly. If they ask you to fetch paid data, ' +
                'tell them to use keywords like "fetch", "get data", or "show me the paid content" ' +
                'so you can trigger the payment flow.'
        }

        // ── Step 3: Try free models in order until one works ──
        // Free models on OpenRouter get rate-limited quickly; cascade through them.
        const FREE_MODELS = [
            'qwen/qwen3.6-plus-preview:free',       // Qwen 3.6 — less congested
            'stepfun/step-3.5-flash:free',           // StepFun Flash — fast
            'nvidia/nemotron-3-super-120b-a12b:free',// Nvidia Nemotron
            'meta-llama/llama-3.2-3b-instruct:free', // Tiny Llama — low load
            'meta-llama/llama-3.3-70b-instruct:free',// Llama 70B — last resort
        ]

        let lastError = ''
        for (const model of FREE_MODELS) {
            try {
                console.log(`[agent] Trying model: ${model}`)
                const response = await client.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: message },
                    ],
                })

                const reply = response.choices[0]?.message?.content ?? 'No response from agent.'
                console.log(`[agent] ✅ Got reply from ${model}`)

                return Response.json({ reply, paymentMade, paymentError, model })
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err)
                // Only continue cascade on rate-limit / not-found errors
                if (msg.includes('429') || msg.includes('404') || msg.includes('rate')) {
                    console.warn(`[agent] Model ${model} failed (${msg.slice(0, 60)}), trying next...`)
                    lastError = msg
                    continue
                }
                throw err // re-throw unexpected errors
            }
        }
        // All models exhausted
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
