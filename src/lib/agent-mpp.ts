/**
 * agent-mpp.ts — Server-side headless MPP payment helper.
 *
 * Uses a Solana keypair loaded from AGENT_PRIVATE_KEY to autonomously:
 *  1. Make a GET request to a paid endpoint
 *  2. Handle the 402 challenge
 *  3. Sign + broadcast the payment transaction
 *  4. Retry and return the actual data
 *
 * No browser wallet required — runs entirely server-side.
 */

import { createKeyPairSignerFromBytes } from '@solana/kit'
import { Mppx, solana } from '@solana/mpp/client'
import bs58 from 'bs58'

/** Load the agent's keypair signer from the AGENT_PRIVATE_KEY env var (base58). */
async function getAgentSigner() {
    const privateKeyBase58 = process.env.AGENT_PRIVATE_KEY
    if (!privateKeyBase58) {
        throw new Error('AGENT_PRIVATE_KEY is not set in environment variables')
    }
    const keyBytes = bs58.decode(privateKeyBase58)
    return createKeyPairSignerFromBytes(keyBytes)
}

/**
 * Calls a paid MPP endpoint server-side, handling the 402→pay→retry cycle
 * using the agent's Solana keypair.
 *
 * @param endpoint  Absolute URL of the paid endpoint (e.g. http://localhost:3000/api/paid-data)
 * @param amount    Amount in base units (e.g. '1000000' for 1 USDC)
 * @returns         The parsed JSON from the paid endpoint
 */
export async function agentFetchPaid(endpoint: string): Promise<unknown> {
    const signer = await getAgentSigner()

    const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com'

    const mppx = Mppx.create({
        methods: [
            solana.charge({
                signer,
                broadcast: true, // agent broadcasts + sends signature
                rpcUrl,
            }),
        ],
    })

    const response = await mppx.fetch(endpoint)

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`Paid endpoint failed with status ${response.status}: ${text}`)
    }

    return response.json()
}
