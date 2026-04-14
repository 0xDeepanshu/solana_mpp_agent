/**
 * GET /api/chains
 *
 * Returns supported payment chains with their configurations.
 */

import { getSupportedChains } from '@/lib/payments'

export async function GET() {
    return Response.json({
        chains: getSupportedChains(),
        default: process.env.PREFERRED_PAYMENT_CHAIN ?? 'base',
        envVars: {
            solana: ['AGENT_PRIVATE_KEY', 'MPP_SECRET_KEY', 'MPP_RECIPIENT_ADDRESS'],
            evm: ['EVM_AGENT_PRIVATE_KEY', 'EVM_RECIPIENT_ADDRESS', 'BASE_RPC_URL', 'ETH_RPC_URL'],
        },
    })
}

export const dynamic = 'force-dynamic'
