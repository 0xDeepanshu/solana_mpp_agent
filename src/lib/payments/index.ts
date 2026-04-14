/**
 * Unified Payment Router
 *
 * Routes payments to the correct provider based on chain.
 * Provides a single API for the agent to make payments on any supported chain.
 */

import type { PaymentProvider, PaymentRequest, PaymentResult, SupportedChain } from './types'
import { createSolanaProvider } from './solana'
import { createEVMProvider } from './evm'

const providers: Map<SupportedChain, PaymentProvider> = new Map()

function getProvider(chain: SupportedChain): PaymentProvider {
    if (!providers.has(chain)) {
        if (chain.startsWith('solana-')) {
            providers.set(chain, createSolanaProvider(chain))
        } else if (chain === 'base' || chain === 'ethereum') {
            providers.set(chain, createEVMProvider(chain))
        } else {
            throw new Error(`Unsupported chain: ${chain}`)
        }
    }
    return providers.get(chain)!
}

/**
 * Make a payment on the specified chain.
 */
export async function makePayment(request: PaymentRequest): Promise<PaymentResult> {
    const provider = getProvider(request.chain)
    console.log(`[payments] Processing ${request.chain} payment: ${request.amount} to ${request.recipient.slice(0, 8)}…`)
    return provider.pay(request)
}

/**
 * Verify a payment transaction on the specified chain.
 */
export async function verifyPayment(chain: SupportedChain, txHash: string): Promise<boolean> {
    const provider = getProvider(chain)
    return provider.verifyPayment(txHash)
}

/**
 * Get the recommended chain for payments.
 * Currently Base (cheapest EVM L2 with deep USDC liquidity).
 */
export function getRecommendedChain(): SupportedChain {
    return (process.env.PREFERRED_PAYMENT_CHAIN as SupportedChain) ?? 'base'
}

/**
 * Get USDC address for a chain.
 */
export function getUSDCAddress(chain: SupportedChain): string {
    const addresses: Record<SupportedChain, string> = {
        'solana-devnet': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
        'solana-mainnet': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
        'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        'ethereum': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    }
    return addresses[chain]
}

/**
 * List all supported chains with their configs.
 */
export function getSupportedChains() {
    return [
        {
            chain: 'solana-devnet' as SupportedChain,
            name: 'Solana Devnet',
            protocol: 'MPP',
            symbol: 'SOL',
            usdc: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
            recommended: false,
        },
        {
            chain: 'base' as SupportedChain,
            name: 'Base',
            protocol: 'x402',
            symbol: 'ETH',
            usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            recommended: true,
        },
        {
            chain: 'ethereum' as SupportedChain,
            name: 'Ethereum',
            protocol: 'x402',
            symbol: 'ETH',
            usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            recommended: false,
        },
    ]
}
