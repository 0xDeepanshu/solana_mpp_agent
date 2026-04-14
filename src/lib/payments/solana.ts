/**
 * Solana MPP Payment Provider
 *
 * Wraps the existing @solana/mpp integration for Solana payments.
 * Uses the server-side agent wallet to auto-sign and broadcast transactions.
 */

import { createKeyPairSignerFromBytes } from '@solana/kit'
import { Mppx, solana } from '@solana/mpp/client'
import bs58 from 'bs58'
import type { PaymentProvider, PaymentRequest, PaymentResult, SupportedChain } from './types'

const CHAIN_CONFIG: Record<string, { rpcUrl: string; network: 'devnet' | 'mainnet' }> = {
    'solana-devnet': {
        rpcUrl: 'https://api.devnet.solana.com',
        network: 'devnet',
    },
    'solana-mainnet': {
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        network: 'mainnet',
    },
}

async function getAgentSigner() {
    const privateKeyBase58 = process.env.AGENT_PRIVATE_KEY
    if (!privateKeyBase58) {
        throw new Error('AGENT_PRIVATE_KEY is not set')
    }
    const keyBytes = bs58.decode(privateKeyBase58)
    return createKeyPairSignerFromBytes(keyBytes)
}

export function createSolanaProvider(chain: SupportedChain): PaymentProvider {
    const config = CHAIN_CONFIG[chain]
    if (!config) throw new Error(`Unsupported Solana chain: ${chain}`)

    return {
        chain,

        async pay(request: PaymentRequest): Promise<PaymentResult> {
            try {
                const signer = await getAgentSigner()

                const mppx = Mppx.create({
                    methods: [
                        solana.charge({
                            signer,
                            broadcast: true,
                            rpcUrl: config.rpcUrl,
                        }),
                    ],
                })

                // Build the MPP endpoint URL — the server-side agent
                // calls back to our own paid endpoint
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
                const endpoint = `${baseUrl}/api/paid-data?chain=${chain}`

                const response = await mppx.fetch(endpoint)

                if (!response.ok) {
                    const text = await response.text()
                    return {
                        success: false,
                        chain,
                        error: `MPP payment failed: ${response.status} ${text}`,
                    }
                }

                // Extract receipt from response headers
                const receipt = response.headers.get('X-MPP-Receipt')

                return {
                    success: true,
                    chain,
                    receipt: receipt ? { mppReceipt: receipt } : undefined,
                }
            } catch (err) {
                return {
                    success: false,
                    chain,
                    error: err instanceof Error ? err.message : String(err),
                }
            }
        },

        async verifyPayment(txHash: string): Promise<boolean> {
            try {
                const res = await fetch(config.rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: 'getTransaction',
                        params: [txHash, { commitment: 'confirmed' }],
                    }),
                })
                const data = await res.json()
                return data.result !== null
            } catch {
                return false
            }
        },
    }
}
