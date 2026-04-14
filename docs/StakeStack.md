---
created: 2026-04-14
updated: 2026-04-14
status: active
tags: [project, gaming, web3, solana, evm, ai, agent-training, unity, x402, erc-8004]
---

# StakeStack — AI Agent Tile Stacking Game

> Players train AI agents by playing tile-stacking games. Agents learn the player's style and compete autonomously on Solana + EVM.

---

## Overview

**Status:** 🟢 Active — Multi-chain payments, training system, premium UI built. Unity integration pending.
**Started:** 2026-04-14
**Location:** `~/Desktop/solana MPP/solana_mpp_agent`
**Branch:** `feature/agent-training-system`
**GitHub:** harshitsiwach (private)

## Concept

1. **Play** — User plays tile-stacking game in Unity WebGL manually
2. **Train** — After 5 games, system analyzes accuracy, speed, stacking patterns → generates agent strategy profile
3. **Deploy** — AI agent plays autonomously using the trained profile (mimics the user's style)
4. **Compete** — Agents compete, leaderboards, staking on Solana + EVM

## Tech Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS v4
- **Game Engine:** Unity WebGL (embedded via iframe)
- **AI/LLM:** OpenRouter free model cascade (Qwen, Step, Nemotron, Llama)
- **Solana:** @solana/mpp (Micro-Payment Protocol), @solana/connector, @solana/kit
- **EVM:** ethers.js, @x402/core, @x402/evm — EIP-3009 gasless transfers
- **Standards:** ERC-8004 (agent identity), x402 (HTTP payments), EIP-3009 (USDC transfers)
- **Storage:** File-based JSON (`.data/training/`)
- **Linting:** Biome
- **Language:** TypeScript

## Architecture

### Pages

| Route | Purpose |
|---|---|
| `/` | Landing page — hero, how-it-works, features (Linear-inspired premium dark) |
| `/agent` | Chat UI + Unity WebGL iframe (split view, training-aware) |
| `/training` | Training dashboard — overview, history, strategy tabs |

### API Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/agent` | POST | Chat agent — multi-chain payments, training profile injection |
| `/api/game` | POST | Push game command to Unity + game state updates |
| `/api/game` | GET | SSE stream — delivers commands to Unity, heartbeats |
| `/api/game?mode=state` | GET | Current game state JSON |
| `/api/paid-data` | GET | Solana MPP-gated endpoint (1 USDC devnet) |
| `/api/paid-data/evm` | GET | EVM x402-gated endpoint (Base/Ethereum) |
| `/api/player/status` | GET | Player progression — bot unlock + training readiness |
| `/api/player/record` | POST | Record match (legacy + full training data) |
| `/api/skills` | GET | OpenAI tool definitions (7 tools, multi-chain) |
| `/api/training/record` | POST | Unity posts match telemetry |
| `/api/training/profile` | GET | Get computed training profile |
| `/api/training/stats` | GET | Match history + aggregate stats |
| `/api/agent-identity` | POST | Register agent onchain (ERC-8004) |
| `/api/agent-identity` | GET | Query agent registration |
| `/api/chains` | GET | List supported payment chains |

### Core Libraries

| File | Purpose |
|---|---|
| `src/lib/types/training.ts` | MoveRecord, MatchSummary, TrainingProfile types |
| `src/lib/trainingStore.ts` | Persistent file-based store (`.data/training/`) |
| `src/lib/profileGenerator.ts` | Analyzes raw moves → generates strategy profile |
| `src/lib/mpp.ts` | Lazy-initialized Solana MPP client |
| `src/lib/agent-mpp.ts` | Server-side Solana MPP payment helper |
| `src/lib/matchStore.ts` | In-memory match count for bot unlock |
| `src/lib/payments/types.ts` | Multi-chain payment types |
| `src/lib/payments/solana.ts` | Solana MPP payment provider |
| `src/lib/payments/evm.ts` | EVM x402 payment provider (EIP-3009) |
| `src/lib/payments/index.ts` | Unified payment router |

## Multi-Chain Payment System

### Supported Chains

| Chain | Protocol | USDC Address | Gas Cost | Status |
|---|---|---|---|---|
| Solana Devnet | MPP | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` | ~$0.001 | ✅ |
| **Base** (default) | x402 / EIP-3009 | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | ~$0.001 | ✅ |
| Ethereum | x402 / EIP-3009 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | ~$0.04 | ✅ |

### How It Works

**Solana MPP (existing):**
1. Agent calls paid endpoint → 402 challenge
2. Server-side agent wallet signs Solana tx
3. Retries with payment → returns data

**EVM x402 (new):**
1. Agent detects chain from user message or uses Base default
2. Server-side EVM wallet signs EIP-3009 `transferWithAuthorization`
3. Submits tx to USDC contract on target chain
4. Returns tx hash + receipt

**Auto-detection:**
- "pay on Base" → Base x402
- "use Solana" → Solana MPP
- No chain specified → Base (cheapest)

### ERC-8004 Agent Identity

The agent can be registered onchain using ERC-8004:
- Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` (same on 20+ chains)
- Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- Deployed: Base, Ethereum, Arbitrum, Optimism, Polygon, and more

## Training System

### Data Flow

```
Unity (per move) → /api/training/record → trainingStore.saveMatch()
                                            ↓
                                    profileGenerator.generateProfile()
                                            ↓
                                    trainingStore.saveProfile()
                                            ↓
                            /api/agent reads profile → injects into LLM prompt
```

### Profile Generator Metrics

| Metric | Description |
|---|---|
| `overallAccuracy` | Correct placements / total moves (0-100%) |
| `skillTier` | beginner → intermediate → advanced → expert → master |
| `speedTier` | cautious → steady → quick → blazing |
| `stackingStyle` | center-first / left-to-right / right-to-left / spread / adaptive |
| `preferredColumns` | Columns the player uses most |
| `weakColumns` | Columns with low accuracy |
| `consistencyScore` | How similar performances are (0-100) |
| `improvementTrend` | Linear regression of accuracy (-100 to 100) |
| `strategySummary` | Natural language strategy for LLM agent |

**Minimum:** 5 matches before agent can use trained profile.

## UI Design System

Linear-inspired premium dark design:
- Backgrounds: `#08090a` → `#0f1011` → `#191a1b`
- Text: `#f7f8f8` → `#d0d6e0` → `#8a8f98` → `#62666d`
- Accent: `#7c3aed` (purple), `#22c55e` (green), `#06b6d4` (cyan)
- Borders: `rgba(255,255,255,0.05-0.08)`
- Fonts: Inter + JetBrains Mono
- Animations: fadeUp, glow pulse, gradient shift, float

## Environment Variables

```env
# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
MPP_SECRET_KEY=***
MPP_RECIPIENT_ADDRESS=***
AGENT_PRIVATE_KEY=***           # Base58, Solana

# EVM
EVM_AGENT_PRIVATE_KEY=***       # EVM wallet for x402 payments
EVM_RECIPIENT_ADDRESS=0x***     # Where EVM USDC payments go
BASE_RPC_URL=https://mainnet.base.org
ETH_RPC_URL=https://eth.llamarpc.com
PREFERRED_PAYMENT_CHAIN=base

# AI
OPENROUTER_API_KEY=***

# Optional
NEXT_PUBLIC_BASE_URL=http://localhost:3000
AGENT_API_KEY=***               # Auth guard (disabled)
```

## Quick Commands

```bash
npm run dev
npm run build
npx tsx skills-agent-example.ts "start a bot match"
npx tsx skills-agent-example.ts --wallet <PUBKEY> --check
```

## Links

- [[StakeStack Unity Integration Guide]] — Unity-side implementation
- [[StakeStack Developer Handoff]] — What changed, what's left
- [[Web3 Game Engine]] — G3Engine project (separate)
- [[Rupture Labs Branding]] — Neon green (#00ff41) primary

## Next Steps

- [ ] Unity implements SSE listener + training data POST
- [ ] Add persistent DB (replace file-based stores)
- [ ] Leaderboard (on-chain or indexed)
- [ ] PvP staking (winner takes pot)
- [ ] Replay system
- [ ] Auth on endpoints
- [ ] Mobile responsive
- [ ] ERC-8004 reputation system integration
- [ ] x402 `upto` payment scheme for metered agent services
