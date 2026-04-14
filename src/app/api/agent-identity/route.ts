/**
 * POST /api/agent-identity
 *
 * Register an AI agent onchain using ERC-8004.
 * Creates an onchain identity for the StakeStack agent on Base.
 *
 * Request body:
 *   { name, description, services[], wallet? }
 *
 * Response:
 *   { ok, agentId, txHash, agentUri, chain }
 *
 * GET /api/agent-identity?agentId=<id>
 *   Returns agent registration details.
 */

import { NextRequest } from 'next/server'
import { ethers } from 'ethers'

// ── ERC-8004 Identity Registry ABI (minimal) ────────────────────────────────

const IDENTITY_REGISTRY_ABI = [
    'function register(string agentURI, bytes metadata) external returns (uint256)',
    'function getAgentURI(uint256 agentId) external view returns (string)',
    'function ownerOf(uint256 agentId) external view returns (address)',
    'function balanceOf(address owner) external view returns (uint256)',
    'event AgentRegistered(uint256 indexed agentId, address indexed owner, string agentURI)',
]

// ── Chain config ─────────────────────────────────────────────────────────────

const CHAIN_CONFIGS: Record<string, {
    rpcUrl: string
    chainId: number
    registry: string
    name: string
}> = {
    base: {
        rpcUrl: process.env.BASE_RPC_URL ?? 'https://mainnet.base.org',
        chainId: 8453,
        registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        name: 'Base',
    },
    ethereum: {
        rpcUrl: process.env.ETH_RPC_URL ?? 'https://eth.llamarpc.com',
        chainId: 1,
        registry: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
        name: 'Ethereum',
    },
}

function getAgentWallet(): ethers.Wallet {
    const key = process.env.EVM_AGENT_PRIVATE_KEY
    if (!key) throw new Error('EVM_AGENT_PRIVATE_KEY is not set')
    return new ethers.Wallet(key)
}

// ── POST — Register agent ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            name = 'StakeStack Agent',
            description = 'AI agent for the StakeStack tile-stacking game. Plays autonomously using trained player profiles.',
            services = [],
            chain = 'base',
            agentUri,
        } = body as {
            name?: string
            description?: string
            services?: { name: string; endpoint: string; version: string }[]
            chain?: string
            agentUri?: string
        }

        const config = CHAIN_CONFIGS[chain]
        if (!config) {
            return Response.json(
                { error: `Unsupported chain: ${chain}. Use 'base' or 'ethereum'.` },
                { status: 400 }
            )
        }

        // Generate registration JSON
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://stakestack.rupturelabs.xyz'
        const registration = {
            type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
            name,
            description,
            services: services.length > 0 ? services : [
                { name: 'A2A', endpoint: `${baseUrl}/.well-known/agent-card.json`, version: '0.3.0' },
                { name: 'Game', endpoint: `${baseUrl}/api/game`, version: '1.0.0' },
            ],
            x402Support: true,
            active: true,
            supportedTrust: ['reputation', 'crypto-economic'],
        }

        // Use provided URI or note that it should be hosted
        const finalAgentUri = agentUri ?? `data:application/json,${encodeURIComponent(JSON.stringify(registration))}`

        // Register onchain
        const wallet = getAgentWallet()
        const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId)
        const signer = wallet.connect(provider)

        const registry = new ethers.Contract(config.registry, IDENTITY_REGISTRY_ABI, signer)

        console.log(`[agent-identity] Registering agent on ${config.name}...`)
        const tx = await registry.register(finalAgentUri, '0x', { gasLimit: 200_000 })
        const receipt = await tx.wait()

        // Parse AgentRegistered event to get agentId
        let agentId: number | null = null
        for (const log of receipt.logs) {
            try {
                const parsed = registry.interface.parseLog({
                    topics: log.topics as string[],
                    data: log.data,
                })
                if (parsed?.name === 'AgentRegistered') {
                    agentId = Number(parsed.args.agentId)
                    break
                }
            } catch {}
        }

        console.log(`[agent-identity] ✅ Registered agent #${agentId} on ${config.name}`)

        return Response.json({
            ok: true,
            agentId,
            txHash: receipt.hash,
            agentUri: finalAgentUri,
            registration,
            chain,
            chainId: config.chainId,
            registry: config.registry,
            explorer: `https://${chain === 'base' ? 'basescan.org' : 'etherscan.io'}/tx/${receipt.hash}`,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[agent-identity] Error:', msg)
        return Response.json({ error: msg }, { status: 500 })
    }
}

// ── GET — Query agent ───────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
    const agentId = request.nextUrl.searchParams.get('agentId')
    const chain = request.nextUrl.searchParams.get('chain') ?? 'base'

    if (!agentId) {
        return Response.json({ error: 'Missing agentId' }, { status: 400 })
    }

    const config = CHAIN_CONFIGS[chain]
    if (!config) {
        return Response.json({ error: `Unsupported chain: ${chain}` }, { status: 400 })
    }

    try {
        const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId)
        const registry = new ethers.Contract(config.registry, IDENTITY_REGISTRY_ABI, provider)

        const [agentUri, owner] = await Promise.all([
            registry.getAgentURI(agentId),
            registry.ownerOf(agentId),
        ])

        return Response.json({
            agentId: Number(agentId),
            agentUri,
            owner,
            chain,
            registry: config.registry,
        })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ error: msg }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
