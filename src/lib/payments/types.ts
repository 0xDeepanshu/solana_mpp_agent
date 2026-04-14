/**
 * Multi-chain payment types for StakeStack.
 *
 * Supports:
 * - Solana MPP (Micro-Payment Protocol) — native on Solana
 * - EVM x402 (HTTP 402 Payment Protocol) — EIP-3009 gasless transfers on Base/Ethereum
 */

// ── Chain identifiers ───────────────────────────────────────────────────────

export type SupportedChain = 'solana-devnet' | 'solana-mainnet' | 'base' | 'ethereum'

export interface ChainConfig {
    chain: SupportedChain
    name: string
    rpcUrl: string
    /** USDC mint/address on this chain */
    usdcAddress: string
    /** USDC decimals (always 6 for USDC) */
    usdcDecimals: number
    /** Payment protocol to use */
    protocol: 'mpp' | 'x402'
    /** Chain ID for x402 (eip155:chainId) */
    eip155ChainId?: number
}

// ── Payment request ─────────────────────────────────────────────────────────

export interface PaymentRequest {
    /** Amount in base units (e.g., '1000000' for 1 USDC) */
    amount: string
    /** Target chain */
    chain: SupportedChain
    /** Recipient address */
    recipient: string
    /** Optional metadata */
    metadata?: Record<string, unknown>
}

// ── Payment result ──────────────────────────────────────────────────────────

export interface PaymentResult {
    success: boolean
    chain: SupportedChain
    /** Transaction signature/hash */
    txHash?: string
    /** Error message if failed */
    error?: string
    /** Payment receipt data */
    receipt?: unknown
}

// ── Agent identity (ERC-8004) ───────────────────────────────────────────────

export interface AgentIdentity {
    /** Agent name */
    name: string
    /** Description */
    description: string
    /** Service endpoints */
    services: {
        name: string
        endpoint: string
        version: string
    }[]
    /** Registration JSON URI (IPFS or URL) */
    agentUri: string
    /** Onchain agent ID (after registration) */
    agentId?: number
    /** Chain where registered */
    registeredChain?: SupportedChain
}

// ── Payment provider interface ──────────────────────────────────────────────

export interface PaymentProvider {
    /** Chain this provider handles */
    chain: SupportedChain
    /** Initiate a payment and return the result */
    pay(request: PaymentRequest): Promise<PaymentResult>
    /** Check if a payment was already made (for deduplication) */
    verifyPayment(txHash: string): Promise<boolean>
}
