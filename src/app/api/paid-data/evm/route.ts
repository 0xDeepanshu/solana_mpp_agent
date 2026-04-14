/**
 * GET /api/paid-data/evm
 *
 * x402-gated endpoint for EVM chains.
 * Returns a 402 Payment Required challenge if not paid.
 * Clients sign EIP-3009 authorizations and retry with payment headers.
 *
 * Supports: Base, Ethereum mainnet
 */

import { NextRequest } from 'next/server'
import { createX402Challenge, verifyX402Payment } from '@/lib/payments/evm'
import type { SupportedChain } from '@/lib/payments/types'

const DEFAULT_CHAIN: SupportedChain = 'base'
const DEFAULT_AMOUNT = '1000000' // 1 USDC
const RECIPIENT = process.env.EVM_RECIPIENT_ADDRESS ?? process.env.MPP_RECIPIENT_ADDRESS ?? ''

export async function GET(request: NextRequest) {
    const chain = (request.nextUrl.searchParams.get('chain') as SupportedChain) ?? DEFAULT_CHAIN
    const amount = request.nextUrl.searchParams.get('amount') ?? DEFAULT_AMOUNT

    // Check for x402 payment header
    const paymentHeader = request.headers.get('X-PAYMENT')

    if (!paymentHeader) {
        // No payment — return 402 challenge
        const challenge = createX402Challenge(chain, amount, RECIPIENT)
        return Response.json(challenge, {
            status: 402,
            headers: {
                'X-PAYMENT-REQUIRED': JSON.stringify(challenge),
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Expose-Headers': 'X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE',
            },
        })
    }

    // Has payment — verify and settle
    const result = await verifyX402Payment(chain, paymentHeader)

    if (!result.valid) {
        return Response.json(
            { error: result.error ?? 'Payment verification failed' },
            { status: 402 }
        )
    }

    // Payment verified — return data
    return Response.json(
        {
            message: 'Here is your paid data! 🎉',
            chain,
            protocol: 'x402',
            txHash: result.txHash,
        },
        {
            headers: {
                'X-PAYMENT-RESPONSE': JSON.stringify({
                    success: true,
                    txHash: result.txHash,
                    chain,
                }),
                'Access-Control-Allow-Origin': '*',
            },
        }
    )
}

// Handle preflight
export async function OPTIONS() {
    return new Response(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'X-PAYMENT, Content-Type',
            'Access-Control-Expose-Headers': 'X-PAYMENT-REQUIRED, X-PAYMENT-RESPONSE',
        },
    })
}

export const dynamic = 'force-dynamic'
