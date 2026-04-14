---
created: 2026-04-14
updated: 2026-04-14
status: active
tags: [handoff, stakestack, developers, changelog, tasks]
---

# StakeStack Developer Handoff

> What's been built, what changed, and what needs doing. Read this before touching the code.

---

## Branch

```
feature/agent-training-system
```

All work is on this branch. Don't push to main yet — we're testing in simulator/browser first.

---

## What's Been Built (3 commits)

### Commit 1: Agent Training System

**Files added:**
```
src/lib/types/training.ts          — MoveRecord, MatchSummary, TrainingProfile types
src/lib/trainingStore.ts           — Persistent file-based training data store
src/lib/profileGenerator.ts        — Analyzes play data → generates strategy profiles
src/app/api/training/record/route.ts   — Unity posts match telemetry
src/app/api/training/profile/route.ts  — Get computed training profile
src/app/api/training/stats/route.ts    — Match history + aggregates
src/app/training/page.tsx          — Training dashboard UI
```

**Files modified:**
```
src/app/api/agent/route.ts         — Injects training profile into agent system prompt
src/app/api/game/route.ts          — Wallet context, game state sync via SSE
src/app/api/player/status/route.ts — Now includes training readiness
src/app/api/player/record/route.ts — Accepts full training data, auto-generates profiles
src/app/api/skills/route.ts        — Added training-related tools
src/app/agent/page.tsx             — Training-aware chat, wallet connection
src/lib/mpp.ts                     — Lazy-init for build compatibility
src/app/api/paid-data/route.ts     — Lazy-init for build compatibility
.gitignore                         — Added .data/ for training persistence
```

**What it does:**
- Unity sends per-move telemetry (tile type, target column, actual column, response time, etc.)
- Data stored in `.data/training/<wallet-prefix>/<matchId>.json`
- After 5 matches, profile generator crunches data into a strategy profile
- Profile injected into agent's LLM prompt so agent mimics the player's style
- Training dashboard shows overview (tier, accuracy, speed), history (match list), and strategy

### Commit 2: Premium UI Overhaul

**Files modified:**
```
src/app/globals.css    — Animation system, glass effects, gradient text, scrollbar
src/app/page.tsx       — Landing page with hero, stats, steps, features, CTA
src/app/agent/page.tsx — Refined chat UI, game state overlay, quick actions
src/app/training/page.tsx — Polished dashboard with tier badges, level bars
```

**Design system:**
- Linear-inspired dark theme (#08090a base)
- Text hierarchy: #f7f8f8 → #d0d6e0 → #8a8f98 → #62666d
- Semi-transparent borders (rgba white 0.05-0.08)
- CSS animations: fadeUp, glow pulse, gradient shift, float
- Inter + JetBrains Mono fonts

### Commit 3: Multi-Chain x402/MPP Payments + ERC-8004

**Files added:**
```
src/lib/payments/types.ts          — Multi-chain payment types
src/lib/payments/solana.ts         — Solana MPP provider
src/lib/payments/evm.ts            — EVM x402 provider (EIP-3009)
src/lib/payments/index.ts          — Unified payment router
src/app/api/paid-data/evm/route.ts — x402 402-challenge endpoint
src/app/api/agent-identity/route.ts — ERC-8004 agent registration
src/app/api/chains/route.ts        — List supported chains
```

**Files modified:**
```
src/app/api/agent/route.ts — Multi-chain payment routing, chain auto-detection
src/app/api/skills/route.ts — Added chain-aware tools (7 total)
package.json                — Added @x402/core, @x402/evm, ethers
```

**New packages:**
- `@x402/core` — x402 protocol types
- `@x402/evm` — EVM x402 implementation
- `@x402/fetch` — Client-side x402 fetch wrapper
- `ethers` — EVM interaction library

---

## New Endpoints Summary

| Endpoint | Method | New? | Purpose |
|---|---|---|---|
| `/api/training/record` | POST | ✅ | Unity posts match telemetry |
| `/api/training/profile` | GET | ✅ | Get training profile for wallet |
| `/api/training/stats` | GET | ✅ | Match history + aggregates |
| `/api/paid-data/evm` | GET | ✅ | x402 payment challenge for EVM |
| `/api/agent-identity` | POST/GET | ✅ | ERC-8004 agent registration |
| `/api/chains` | GET | ✅ | List supported payment chains |
| `/api/agent` | POST | Modified | Now multi-chain + training-aware |
| `/api/game` | POST/GET | Modified | Wallet context + game state sync |
| `/api/player/status` | GET | Modified | Now includes training readiness |
| `/api/player/record` | POST | Modified | Accepts full training data |
| `/api/skills` | GET | Modified | 7 tools (was 3) |

---

## Environment Variables (New)

```env
# EVM Payments (NEW — needed for x402)
EVM_AGENT_PRIVATE_KEY=***       # EVM wallet private key (no 0x prefix)
EVM_RECIPIENT_ADDRESS=0x***     # Where USDC payments go
BASE_RPC_URL=https://mainnet.base.org       # Optional, has default
ETH_RPC_URL=https://eth.llamarpc.com        # Optional, has default
PREFERRED_PAYMENT_CHAIN=base    # Optional, default: base

# Existing (unchanged)
SOLANA_RPC_URL=https://api.devnet.solana.com
MPP_SECRET_KEY=***
MPP_RECIPIENT_ADDRESS=***
AGENT_PRIVATE_KEY=***           # Solana base58
OPENROUTER_API_KEY=***
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

---

## What Needs Doing

### 🔴 Critical (Blocking)

#### Unity Integration
Nobody has touched the Unity side yet. The game needs to:
1. **SSE Listener** — Connect to `GET /api/game`, receive commands (StartBotMode, etc.)
2. **Wallet Registration** — `POST /api/game` with `{ type: "registerWallet", wallet }`
3. **Game State Updates** — `POST /api/game` with `{ gameState: { status, score, level, moves, accuracy } }`
4. **Training Data** — `POST /api/training/record` with full match telemetry on game end

See [[StakeStack Unity Integration Guide]] for complete C# code examples.

### 🟡 Important (Should Do Soon)

#### Persistent Storage
Training data is file-based (`.data/training/`). In-memory `matchStore` dies on restart.
- [ ] Move to SQLite or Postgres for production
- [ ] Or on-chain storage if we want trustless data

#### Authentication
All endpoints are currently open (auth guards commented out).
- [ ] Uncomment and configure `AGENT_API_KEY` on protected endpoints
- [ ] At minimum: protect `/api/game` (anyone can push commands)
- [ ] Consider: wallet-based auth instead of API keys

#### Leaderboard
No leaderboard yet.
- [ ] Design schema (wallet, score, win rate, tier)
- [ ] On-chain or indexed?
- [ ] UI page

### 🟢 Nice to Have

#### PvP Staking
- [ ] Two agents play, winner takes the pot
- [ ] Use x402 or Solana MPP for entry fees
- [ ] Smart contract for escrow + settlement

#### Replay System
- [ ] Training data already stores all moves
- [ ] Build a replay viewer that re-renders moves
- [ ] Share replay links

#### ERC-8004 Reputation
- [ ] After agent plays, users can post feedback onchain
- [ ] Build reputation display in agent profile
- [ ] Use for agent discovery

#### Mobile Responsive
- [ ] Agent page split-view needs tabbed layout on mobile
- [ ] Training dashboard needs responsive grid

#### x402 `upto` Scheme
- [ ] Support metered payments (pay per token, per second)
- [ ] Useful for premium agent features

---

## Quick Start for Devs

```bash
# Clone and checkout
git checkout feature/agent-training-system

# Install
npm install

# Set up env vars (copy .env.example if exists, or create .env.local)
# At minimum: OPENROUTER_API_KEY, MPP_SECRET_KEY, MPP_RECIPIENT_ADDRESS, AGENT_PRIVATE_KEY

# Run
npm run dev

# Build check
npm run build
```

---

## Architecture Decisions

**Why file-based storage?** Fast to prototype. No DB dependency for local dev. Easy to migrate later.

**Why x402 for EVM?** It's the standard for HTTP-native payments. Coinbase-backed, production-ready, works with USDC on any EVM chain. EIP-3009 makes it gasless for the recipient.

**Why Base as default EVM chain?** Cheapest major L2 (~$0.001 gas), Coinbase distribution, smart wallets, account abstraction support.

**Why ERC-8004?** Onchain agent identity is becoming the standard. Same contract address on 20+ chains. Lets agents discover and trust each other without pre-existing relationships.

**Why lazy-init for MPP/x402 clients?** Next.js evaluates modules at build time. If env vars aren't set during `next build`, the module-level `new Mppx()` throws. Lazy functions only instantiate at request time.

---

## Questions?

Ping harshitsiwach or check [[StakeStack]] for the project overview.
