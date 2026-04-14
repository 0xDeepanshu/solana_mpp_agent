/**
 * EVM x402 Payment Provider
 *
 * Implements the x402 HTTP payment protocol using EIP-3009
 * (transferWithAuthorization) for gasless USDC transfers.
 *
 * Supports:
 * - Base (cheapest — recommended)
 * - Ethereum mainnet
 */

import { ethers } from 'ethers'
import type { PaymentProvider, PaymentRequest, PaymentResult, SupportedChain } from './types'

// ── Chain configs ────────────────────────────────────────────────────────────

const EVM_CHAINS: Record<string, {
    rpcUrl: string
    chainId: number
    usdcAddress: string
    name: string
}> = {
    base: {
        rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
        chainId: 8453,
        usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base
        name: 'Base',
    },
    ethereum: {
        rpcUrl: process.env.ETH_RPC_URL ?? 'https://eth.llamarpc.com',
        chainId: 1,
        usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
        name: 'Ethereum',
    },
}

// ── EIP-3009 ABI (transferWithAuthorization) ────────────────────────────────

const USDC_ABI = [
    'function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external',
    'function balanceOf(address) view returns (uint256)',
    'function nonces(address) view returns (uint256)',
    'function authorizationState(address authorizer, bytes32 nonce) view returns (bool)',
]

// ── EIP-712 domain ──────────────────────────────────────────────────────────

function getEIP712Domain(chainId: number, verifyingContract: string) {
    return {
        name: 'USDC',
        version: '2',
        chainId,
        verifyingContract,
    }
}

const AUTHORIZATION_TYPE = {
    TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
    ],
}

// ── Server-side signer (agent wallet) ───────────────────────────────────────

function getAgentWallet(): ethers.Wallet {
    const key = process.env.EVM_AGENT_PRIVATE_KEY
    if (!key) throw new Error('EVM_AGENT_PRIVATE_KEY is not set')
    return new ethers.Wallet(key)
}

export function createEVMProvider(chain: SupportedChain): PaymentProvider {
    const config = EVM_CHAINS[chain]
    if (!config) throw new Error(`Unsupported EVM chain: ${chain}`)

    return {
        chain,

        async pay(request: PaymentRequest): Promise<PaymentResult> {
            try {
                const wallet = getAgentWallet()
                const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId)
                const signer = wallet.connect(provider)

                const usdc = new ethers.Contract(config.usdcAddress, USDC_ABI, signer)

                // Check balance
                const balance: bigint = await usdc.balanceOf(wallet.address)
                const amount = BigInt(request.amount)
                if (balance < amount) {
                    return {
                        success: false,
                        chain,
                        error: `Insufficient USDC balance. Have ${ethers.formatUnits(balance, 6)}, need ${ethers.formatUnits(amount, 6)}`,
                    }
                }

                // Generate nonce
                const nonce = ethers.hexlify(ethers.randomBytes(32))

                // Authorization window: valid for 5 minutes
                const now = Math.floor(Date.now() / 1000)
                const validAfter = now - 60 // 1 min ago (clock skew)
                const validBefore = now + 300 // 5 min from now

                // Sign EIP-712 authorization
                const domain = getEIP712Domain(config.chainId, config.usdcAddress)
                const value = {
                    from: wallet.address,
                    to: request.recipient,
                    value: amount,
                    validAfter,
                    validBefore,
                    nonce,
                }

                const signature = await signer.signTypedData(domain, AUTHORIZATION_TYPE, value)
                const { v, r, s } = ethers.Signature.from(signature)

                // Submit transferWithAuthorization tx
                const tx = await usdc.transferWithAuthorization(
                    wallet.address,
                    request.recipient,
                    amount,
                    validAfter,
                    validBefore,
                    nonce,
                    v, r, s,
                    { gasLimit: 100_000 }
                )

                const receipt = await tx.wait()

                return {
                    success: true,
                    chain,
                    txHash: receipt.hash,
                    receipt: {
                        txHash: receipt.hash,
                        blockNumber: receipt.blockNumber,
                        from: wallet.address,
                        to: request.recipient,
                        amount: ethers.formatUnits(amount, 6),
                        chain: config.name,
                    },
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
                const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId)
                const receipt = await provider.getTransactionReceipt(txHash)
                return receipt !== null && receipt.status === 1
            } catch {
                return false
            }
        },
    }
}

// ── x402 middleware helper (for server-side 402 flow) ────────────────────────

/**
 * Creates an x402 payment challenge response.
 * The client reads this, signs an EIP-3009 authorization, and retries.
 */
export function createX402Challenge(chain: SupportedChain, amount: string, recipient: string) {
    const config = EVM_CHAINS[chain]
    if (!config) throw new Error(`Unsupported EVM chain: ${chain}`)

    return {
        x402Version: 1,
        accepts: [
            {
                scheme: 'exact',
                network: `eip155:${config.chainId}`,
                amount,
                token: config.usdcAddress,
                to: recipient,
            },
        ],
        error: 'X402_PAYMENT_REQUIRED',
    }
}

/**
 * Verifies an x402 payment from a client.
 * The client sends a signed EIP-3009 authorization in the request headers.
 */
export async function verifyX402Payment(
    chain: SupportedChain,
    paymentHeader: string
): Promise<{ valid: boolean; error?: string; txHash?: string }> {
    try {
        const config = EVM_CHAINS[chain]
        if (!config) return { valid: false, error: `Unsupported chain: ${chain}` }

        const payment = JSON.parse(paymentHeader)
        const { from, to, value, validAfter, validBefore, nonce, signature } = payment

        // Validate timing
        const now = Math.floor(Date.now() / 1000)
        if (now < validAfter || now > validBefore) {
            return { valid: false, error: 'Authorization expired or not yet valid' }
        }

        // Check if nonce was already used
        const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId)
        const usdc = new ethers.Contract(config.usdcAddress, USDC_ABI, provider)

        const used: boolean = await usdc.authorizationState(from, nonce)
        if (used) return { valid: false, error: 'Authorization nonce already used' }

        // Verify signature
        const domain = getEIP712Domain(config.chainId, config.usdcAddress)
        const expectedSigner = ethers.verifyTypedData(
            domain,
            AUTHORIZATION_TYPE,
            { from, to, value, validAfter, validBefore, nonce },
            signature
        )

        if (expectedSigner.toLowerCase() !== from.toLowerCase()) {
            return { valid: false, error: 'Invalid signature' }
        }

        // Settle the payment (server submits the tx)
        const agentWallet = getAgentWallet()
        const signer = agentWallet.connect(provider)
        const usdcWithSigner = new ethers.Contract(config.usdcAddress, USDC_ABI, signer)

        const { v, r, s } = ethers.Signature.from(signature)
        const tx = await usdcWithSigner.transferWithAuthorization(
            from, to, value, validAfter, validBefore, nonce, v, r, s,
            { gasLimit: 100_000 }
        )
        const receipt = await tx.wait()

        return { valid: true, txHash: receipt.hash }
    } catch (err) {
        return {
            valid: false,
            error: err instanceof Error ? err.message : String(err),
        }
    }
}
