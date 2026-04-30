# Stackmon (StakeStack) — Complete Project Specification

> **Purpose**: This document contains everything needed to rebuild this project from scratch, create a documentation website, or hand off to any AI agent for development.

**Live Domain**: `stackmon.fun`

---

## 1. Project Overview

**Stackmon** (formerly **StakeStack**) is a competitive blockchain staking game built as a **Next.js 16** web application that integrates:

1. **Unity WebGL Game** — A competitive staking game embedded via iframe
2. **Solana Micro-Payment Protocol (MPP)** — 402 Payment Required flows for paid data access
3. **Autonomous AI Agent** — An LLM-powered agent that can play the game and make payments without human intervention
4. **Redis-backed Session Management** — Persistent player stats, match history, and bot-unlock sessions
5. **Custom Solana Wallet UI** — Phantom, Solflare, Backpack wallet support with custom-styled components

### Core Game Loop

1. Player connects Solana wallet
2. Player plays **5 practice matches** in the Unity game
3. After 5 matches → **Bot Mode unlocks** (24-hour session stored in Redis)
4. AI agent can now autonomously play bot matches via SSE command bridge
5. Players/agents can also pay 1 USDC (devnet) to access gated data endpoints

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| UI Components | Base UI (`@base-ui/react`) | 1.3.0 |
| Icons | Lucide React | 1.7.0 |
| Blockchain | Solana (Devnet) | — |
| Wallet Adapter | `@solana/connector` + `@solana/wallet-adapter-react` | 0.2.4 / 0.15.39 |
| Payment Protocol | `@solana/mpp` (client + server) | 0.1.1 |
| Crypto Utils | `@solana/kit`, `bs58` | — |
| Database | Redis (via `redis` npm package) | 5.12.1 |
| AI/LLM | OpenAI SDK → OpenRouter proxy | 6.33.0 |
| AI (alt) | Anthropic SDK | 0.80.0 |
| Linter/Formatter | Biome | 2.2.0 |
| Fonts | Geist, Geist Mono (via `next/font/google`) | — |
| Agent Page Fonts | Inter, JetBrains Mono (via Google Fonts CDN) | — |

### Key Solana Constants

| Constant | Value |
|----------|-------|
| Network | Devnet |
| USDC Mint (Devnet) | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| USDC Mint (Mainnet) | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Payment Amount | 1 USDC (1,000,000 base units, 6 decimals) |

---

## 3. Environment Variables

Create a `.env.local` file with these keys:

```env
# ── Solana MPP (Server-side payment verification) ──
MPP_SECRET_KEY=<base58-encoded-server-keypair>
MPP_RECIPIENT_ADDRESS=<solana-pubkey-receiving-payments>

# ── Agent Wallet (Server-side autonomous payments) ──
AGENT_PRIVATE_KEY=<base58-encoded-agent-keypair>

# ── Solana RPC ──
SOLANA_RPC_URL=https://api.devnet.solana.com

# ── Base URL (for internal API calls) ──
NEXT_PUBLIC_BASE_URL=https://stackmon.fun

# ── Redis Cloud ──
REDIS_HOST=<your-redis-host>
REDIS_PORT=<your-redis-port>
REDIS_USERNAME=default
REDIS_PASSWORD=<your-redis-password>

# ── LLM (AI Agent) ──
OPENROUTER_API_KEY=<your-openrouter-key>
```

### Variable Descriptions

| Variable | Used By | Purpose |
|----------|---------|---------|
| `MPP_SECRET_KEY` | `src/lib/mpp.ts` | Server keypair for verifying/creating MPP payment challenges |
| `MPP_RECIPIENT_ADDRESS` | `src/lib/mpp.ts` | Wallet that receives USDC payments |
| `AGENT_PRIVATE_KEY` | `src/lib/agent-mpp.ts` | Agent's Solana keypair for autonomous headless payments |
| `SOLANA_RPC_URL` | `src/lib/agent-mpp.ts` | RPC endpoint for broadcasting transactions |
| `NEXT_PUBLIC_BASE_URL` | Multiple API routes | Base URL for internal fetch calls |
| `REDIS_HOST` | `src/lib/redis.ts` | Redis Cloud hostname |
| `REDIS_PORT` | `src/lib/redis.ts` | Redis Cloud port (default: 6379) |
| `REDIS_USERNAME` | `src/lib/redis.ts` | Redis username (default: "default") |
| `REDIS_PASSWORD` | `src/lib/redis.ts` | Redis auth password |
| `OPENROUTER_API_KEY` | `src/app/api/agent/route.ts` | API key for OpenRouter LLM proxy |

---

## 4. Directory Structure

```
solana_mpp/
├── public/
│   └── unity/                    # Unity WebGL build output
│       ├── index.html            # Unity loader page
│       ├── Build/                # Compiled WASM + JS
│       ├── StreamingAssets/       # Unity streaming data
│       └── TemplateData/         # Unity template assets
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout (Geist fonts, Providers wrapper)
│   │   ├── page.tsx              # Home page — wallet connect + MPP pay button
│   │   ├── globals.css           # Tailwind v4 import + CSS variables
│   │   ├── favicon.ico
│   │   │
│   │   ├── agent/
│   │   │   └── page.tsx          # Full-page AI agent chat UI (793 lines)
│   │   │
│   │   └── api/
│   │       ├── agent/route.ts    # POST — AI agent endpoint (LLM + game + payment)
│   │       ├── game/
│   │       │   ├── route.ts      # POST: queue command / GET: SSE stream
│   │       │   └── finished/
│   │       │       └── route.ts  # POST: Unity signals match end / GET: long-poll
│   │       ├── paid-data/
│   │       │   └── route.ts      # GET — MPP-gated paid endpoint (402 flow)
│   │       ├── player/
│   │       │   ├── record/
│   │       │   │   └── route.ts  # POST — record a completed match
│   │       │   └── status/
│   │       │       └── route.ts  # GET — full player stats from Redis
│   │       ├── session/
│   │       │   └── route.ts      # GET: session status / POST: authorize bot match
│   │       ├── skills/
│   │       │   └── route.ts      # GET — OpenAI-format tool definitions
│   │       └── debug/
│   │           ├── redis/route.ts    # GET — Redis connection health check
│   │           └── players/route.ts  # GET — list all players (debug only)
│   │
│   ├── components/
│   │   ├── WalletConnect.tsx     # Main connect button + dropdown trigger
│   │   ├── WalletDropdown.tsx    # Connected wallet details panel
│   │   └── WalletModal.tsx       # Wallet selection dialog
│   │
│   ├── lib/
│   │   ├── mpp.ts               # Server-side MPP instance (Mppx.create)
│   │   ├── agent-mpp.ts         # Headless agent payment helper
│   │   ├── redis.ts             # Redis client singleton with reconnect
│   │   └── matchStore.ts        # DEPRECATED — in-memory store (use Redis)
│   │
│   ├── providers.tsx            # Solana ConnectorKit provider wrapper
│   └── proxy.ts                 # CORS proxy for Unity WebGL (replaces middleware)
│
├── skills.md                     # Agent skills documentation
├── skills-agent-example.ts       # Standalone agent bot script
├── unity.md                      # Unity JS→C# bridge reference
├── package.json
├── next.config.ts
├── tsconfig.json
├── biome.json
└── postcss.config.mjs
```

---

## 5. Redis Data Model

All persistent state lives in Redis. Here are the key patterns:

| Redis Key | Type | TTL | Description |
|-----------|------|-----|-------------|
| `match:<matchId>` | Hash | 30 days | Full match record: `matchId`, `wallet`, `score`, `timestamp` |
| `player_matches:<wallet>` | List | None | Ordered list of matchIds (append via `rPush`) |
| `practice_matches:<wallet>` | String (int) | None | Running counter of practice matches toward 5 |
| `bot_session:<wallet>` | String ("1") | 24 hours | Bot mode unlock token; exists = bot unlocked |

### Session Unlock Flow

```
Player completes match
  → POST /api/game/finished or POST /api/player/record
    → redis.incr("practice_matches:<wallet>")
    → if count >= 5:
        → redis.set("bot_session:<wallet>", "1", EX=86400)
        → redis.del("practice_matches:<wallet>")
        → Bot Mode UNLOCKED for 24 hours
```

---

## 6. API Reference

### 6.1 `POST /api/game` — Send Game Command

Pushes a command to the SSE queue. Unity clients receive it instantly.

**Request:**
```json
{ "action": "StartBotMode" }
```

**Valid Actions:** `StartBotMode`, `StartPracticeMode`, `StartMultiplayerMode`, `ExitToMainMenu`, `GetPracticeStatus`

**Response (200):**
```json
{ "ok": true, "queued": { "action": "StartBotMode", "id": "<uuid>", "ts": 1712345678901 } }
```

### 6.2 `GET /api/game` — SSE Stream

Unity page subscribes to this endpoint. Receives:
- Queued commands as `data: {...}\n\n`
- Heartbeats every 3s as `: heartbeat\n\n`

Headers: `Content-Type: text/event-stream`

### 6.3 `POST /api/game/finished` — Match End Signal

Called by Unity when a match ends. Records match in Redis, increments counter, optionally unlocks bot mode.

**Request:**
```json
{ "wallet": "<pubkey>", "score": 85 }
```

**Response (200):**
```json
{
  "ok": true,
  "matchId": "<uuid>",
  "wallet": "<pubkey>",
  "score": 85,
  "timestamp": 1712345678901,
  "matches": 3,
  "botUnlocked": false
}
```

When `botUnlocked` becomes `true`, also returns: `sessionExpiresAt`, `averageScore`.

### 6.4 `GET /api/game/finished?timeout=120` — Long-Poll

Agent waits here for Unity to signal game end. Returns 408 on timeout.

### 6.5 `GET /api/paid-data` — MPP-Gated Endpoint

Uses `@solana/mpp/server` to gate access behind a 1 USDC payment.

**Flow:**
1. Client calls GET with MPP headers
2. If unpaid → returns `402` with payment challenge
3. Client signs tx, retries with receipt
4. Server verifies → returns `200` with data

**Response (200):**
```json
{ "message": "Here is your paid data! 🎉" }
```

### 6.6 `POST /api/agent` — AI Agent Endpoint

The main AI endpoint. Detects intent from natural language, dispatches game commands or makes autonomous payments, then generates an LLM response.

**Request:**
```json
{ "message": "start a bot match" }
```

**Response (200):**
```json
{
  "reply": "I've started a bot match...",
  "paymentMade": false,
  "paymentError": null,
  "model": "qwen/qwen3.6-plus-preview:free",
  "gameAction": "StartBotMode",
  "gameCmdResult": "Start Bot Match"
}
```

**LLM Model Cascade (free tier):**
1. `qwen/qwen3.6-plus-preview:free`
2. `stepfun/step-3.5-flash:free`
3. `nvidia/nemotron-3-super-120b-a12b:free`
4. `meta-llama/llama-3.2-3b-instruct:free`
5. `meta-llama/llama-3.3-70b-instruct:free`

### 6.7 `GET /api/player/status?wallet=<pubkey>` — Player Stats

**Response (bot unlocked):**
```json
{
  "wallet": "<pubkey>",
  "botUnlocked": true,
  "sessionTtl": 82800,
  "totalMatches": 7,
  "averageScore": 72,
  "recentMatches": [
    { "matchId": "<uuid>", "score": 85, "timestamp": 1712345678901 }
  ]
}
```

**Response (bot locked):**
```json
{
  "wallet": "<pubkey>",
  "botUnlocked": false,
  "matches": 3,
  "totalMatches": 3,
  "averageScore": 65,
  "recentMatches": [...]
}
```

### 6.8 `POST /api/player/record` — Record Match (Alternative)

Same behavior as `POST /api/game/finished` but without waking long-poll waiters.

**Request:**
```json
{ "wallet": "<pubkey>", "score": 90 }
```

### 6.9 `GET /api/session?wallet=<pubkey>` — Full Session Status

Returns session unlock status plus detailed stats.

### 6.10 `POST /api/session` — Authorize Bot Match

**Request:** `{ "wallet": "<pubkey>" }`

**Response (200):** `{ "ok": true, "ttl": 82800 }`
**Response (403):** `{ "error": "Bot mode not unlocked...", "matches": 3, "matchesRequired": 5 }`

### 6.11 `GET /api/skills` — Tool Definitions

Returns OpenAI-compatible function-calling tool definitions + a system prompt.

**Response:**
```json
{
  "version": "1.0.0",
  "name": "StakeStack Agent Skills",
  "description": "Tool definitions for autonomous StakeStack game control...",
  "baseUrl": "http://localhost:3000",
  "tools": [ /* 3 tool definitions */ ],
  "systemPrompt": "You are an autonomous agent...",
  "docs": "http://localhost:3000/skills.md"
}
```

**Tools defined:**
1. `check_bot_eligibility` — params: `{ wallet: string }`
2. `control_game` — params: `{ action: enum }`
3. `fetch_paid_data` — no params

### 6.12 Debug Endpoints (Remove for Production)

- `GET /api/debug/redis` — Redis connection health
- `GET /api/debug/players` — List all players with stats

---

## 7. Pages & Frontend

### 7.1 Home Page (`/`)

Simple page with:
- Solana wallet connect button (`ConnectButtonBaseUI`)
- "Pay 1 USDC to get data" button (uses client-side MPP)
- Shows connected address, payment result, errors

Uses `@solana/connector` hooks: `useAccount()`, `useKitTransactionSigner()`

Client-side MPP flow:
```typescript
const mppx = Mppx.create({
  methods: [solana.charge({
    signer,          // from useKitTransactionSigner
    broadcast: true,
    rpcUrl: 'https://api.devnet.solana.com',
  })],
})
const response = await mppx.fetch('/api/paid-data')
```

### 7.2 Agent Page (`/agent`)

Full-screen split-view chat interface:

**Left panel** — Chat with the AI agent:
- Message history with user/assistant/system roles
- Typing indicators, payment status banners, game command tags
- Quick-prompt buttons for game controls and data access
- Real-time status badge (Online, Thinking, Paying, Gaming, etc.)

**Right panel** — Unity WebGL game:
- Embedded via `<iframe src="/unity/index.html">`
- Loading overlay with spinner
- 4 quick game control buttons below the iframe
- Toggleable via "Show/Hide Game" button

**Design**: Dark theme (#080c14 background), purple/cyan accent colors, glassmorphic elements, smooth animations, JetBrains Mono for code elements.

### 7.3 Wallet Components

Three custom components using `@solana/connector/react` + `@base-ui/react`:

1. **WalletConnect** — Main button. Shows "Connect Wallet" or address dropdown
2. **WalletModal** — Dialog for selecting wallet (Phantom, Solflare, etc.)
3. **WalletDropdown** — Connected state panel with balance, tokens, tx history, disconnect

---

## 8. Core Libraries

### 8.1 `src/lib/mpp.ts` — Server MPP

```typescript
import { Mppx, solana } from '@solana/mpp/server'

export const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY!,
  methods: [
    solana.charge({
      recipient: process.env.MPP_RECIPIENT_ADDRESS!,
      currency: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
      decimals: 6,
      network: 'devnet',
    }),
  ],
})
```

### 8.2 `src/lib/agent-mpp.ts` — Headless Agent Payments

Loads keypair from `AGENT_PRIVATE_KEY` (base58), creates a client-side MPP instance with `@solana/kit`'s `createKeyPairSignerFromBytes`, auto-handles the 402→pay→retry cycle.

### 8.3 `src/lib/redis.ts` — Redis Singleton

Singleton pattern with connection deduplication. Config via `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`. Max 3 retries, 10s connect timeout.

### 8.4 `src/proxy.ts` — CORS Proxy

Next.js 16 proxy (replaces middleware). Adds `Access-Control-Allow-Origin: *` to all `/api/*` routes. Handles OPTIONS preflight.

### 8.5 `src/providers.tsx` — Solana Provider

```typescript
import { AppProvider } from '@solana/connector/react'
import { getDefaultConfig } from '@solana/connector/headless'

const config = getDefaultConfig({ appName: 'My App' })
// Wraps children in <AppProvider connectorConfig={config}>
```

---

## 9. Unity WebGL Integration

### Bridge Architecture

```
AI Agent (LLM)
    ↓ POST /api/game { action }
Next.js API (in-memory queue)
    ↓ SSE stream (GET /api/game)
Agent Page (browser)
    ↓ iframe.contentWindow postMessage / SendMessage
Unity WebGL Instance (ApiManager object)
    ↓ match ends
Unity calls POST /api/game/finished
    ↓
Redis (match records, counters, sessions)
```

### Unity JS → C# Commands

All commands target the `ApiManager` GameObject:

```javascript
myUnityInstance.SendMessage('ApiManager', 'StartBotMode')
myUnityInstance.SendMessage('ApiManager', 'StartPracticeMode')
myUnityInstance.SendMessage('ApiManager', 'StartMultiplayerMode')
myUnityInstance.SendMessage('ApiManager', 'ExitToMainMenu')
myUnityInstance.SendMessage('ApiManager', 'GetPracticeStatus')
```

The Unity build is placed at `public/unity/` and served as static files.

---

## 10. Autonomous Agent System

### Standalone Agent Script (`skills-agent-example.ts`)

A CLI tool that can run without a browser:

```bash
# Natural language (uses LLM via OpenRouter)
npx tsx skills-agent-example.ts "start a bot match"
npx tsx skills-agent-example.ts "get the paid data"

# Check bot eligibility
npx tsx skills-agent-example.ts --wallet <PUBKEY> --check

# Autonomous bot loop
npx tsx skills-agent-example.ts --wallet <PUBKEY> --bot-loop
npx tsx skills-agent-example.ts --wallet <PUBKEY> --bot-loop --rounds 3 --timeout 180
```

### Bot Loop Flow

1. Check eligibility (`GET /api/player/status`)
2. If `botUnlocked` → `POST /api/game { action: "StartBotMode" }`
3. Long-poll `GET /api/game/finished?timeout=180` (waits for Unity)
4. On game end → `POST /api/game { action: "ExitToMainMenu" }`
5. 1.5s pause → repeat

### Agent API Route Intent Detection

The `/api/agent` route uses regex to classify user messages:

| Pattern | Detected As |
|---------|-------------|
| `bot match`, `vs bot`, `play bot`, `fight bot` | `StartBotMode` |
| `practice`, `solo`, `train`, `sandbox` | `StartPracticeMode` |
| `main menu`, `exit`, `go back`, `home` | `ExitToMainMenu` |
| `stats`, `score`, `result`, `how doing` | `GetPracticeStatus` |
| `data`, `fetch`, `paid`, `content`, `retrieve` | Paid data request |

---

## 11. Authentication (Disabled)

Auth guards exist in code but are commented out. To enable:

1. Set `AGENT_API_KEY=your-secret` in `.env.local`
2. Uncomment `// AUTH GUARD` blocks in:
   - `src/app/api/game/route.ts`
   - `src/app/api/paid-data/route.ts`
   - `src/app/api/skills/route.ts`
3. Pass header: `X-Agent-Key: your-secret`

---

## 12. Deployment

### Vercel Deployment

- Set all env vars in Vercel → Settings → Environment Variables
- The Unity WebGL build in `public/unity/` is served as static assets
- `proxy.ts` handles CORS (Next.js 16 uses `proxy.ts` instead of `middleware.ts`)
- All API routes use `export const dynamic = 'force-dynamic'`
- Redis Cloud is used for persistence across serverless invocations

### Local Development

```bash
npm install
npm run dev    # starts on http://localhost:3000
```

### Build

```bash
npm run build
npm start
```

### Lint / Format

```bash
npm run lint      # biome check
npm run format    # biome format --write
```

---

## 13. Configuration Files

### `next.config.ts`
```typescript
const nextConfig: NextConfig = {
  reactCompiler: true,
}
```

### `biome.json`
- Indent: 2 spaces
- Linter: recommended rules + Next.js + React domains
- `noUnknownAtRules` disabled (for Tailwind)
- Auto organize imports

### `tsconfig.json`
- Target: ES2017
- Module: ESNext (bundler resolution)
- Path alias: `@/*` → `./src/*`
- JSX: react-jsx
- Strict mode enabled

### `postcss.config.mjs`
- Uses `@tailwindcss/postcss` plugin

---

## 14. Design System (Agent Page)

The agent page uses inline `<style>` with a consistent design system:

| Token | Value | Usage |
|-------|-------|-------|
| Background | `#080c14` | Page background |
| Text Primary | `#e2e8f0` | Main text |
| Text Secondary | `#64748b` | Muted text |
| Text Tertiary | `#334155` | Hints, timestamps |
| Purple Primary | `#7c3aed` | Agent avatar, send button, user bubbles |
| Purple Light | `#a78bfa` | Labels, accents |
| Cyan Primary | `#06b6d4` | Game-related elements |
| Cyan Light | `#67e8f9` | Game tags, gaming pulse |
| Green | `#22c55e` | Online status, connected indicators |
| Red | `#ef4444` | Error status |
| Yellow | `#f59e0b` | Thinking status |
| Border Subtle | `rgba(255,255,255,0.05-0.1)` | Dividers, card borders |
| Glass | `rgba(255,255,255,0.03-0.05)` | Card/chip backgrounds |

### Animations
- `fadeUp` — messages fade in with 6px upward slide (0.22s)
- `spin` — loading spinners (0.7-0.9s)
- `bounce` — typing indicator dots (1.2s staggered)

---

## 15. Key Patterns for Rebuilding

### SSE Command Bridge Pattern

```typescript
// Module-level singleton queue + client set
const commandQueue: GameCommand[] = []
const clients: Set<ReadableStreamDefaultController> = new Set()

// POST — add to queue, push to all SSE clients
// GET — return ReadableStream, register controller, drain queue, heartbeat every 3s
```

### Long-Poll Pattern

```typescript
// Module-level waiters array
const waiters: Waiter[] = []

// GET — returns Promise<Response>, adds to waiters with timeout
// POST — resolves all waiters, clears timeouts
```

### LLM Cascade Pattern

Try free models in order. On 429/404/rate-limit errors, try next. Throw on other errors.

### Redis Singleton Pattern

Cache client at module level. Deduplicate concurrent `connect()` calls with a shared Promise. Retry up to 3 times with exponential backoff.

---

## 16. npm Dependencies Summary

### Production
| Package | Purpose |
|---------|---------|
| `next` | Framework |
| `react`, `react-dom` | UI library |
| `@solana/connector` | Wallet connection kit |
| `@solana/mpp` | Micro-Payment Protocol (client + server) |
| `@solana/wallet-adapter-react` | Wallet adapter hooks |
| `@solana/react-hooks` | Solana React hooks |
| `@base-ui/react` | Headless UI components (Dialog, Collapsible, Menu) |
| `@anthropic-ai/sdk` | Anthropic API client |
| `openai` | OpenAI-compatible API client (used with OpenRouter) |
| `redis` | Redis client |
| `bs58` | Base58 encoding/decoding for Solana keys |
| `lucide-react` | Icon library |

### Dev
| Package | Purpose |
|---------|---------|
| `typescript` | Type checking |
| `tailwindcss` + `@tailwindcss/postcss` | CSS framework |
| `@biomejs/biome` | Linter + formatter |
| `babel-plugin-react-compiler` | React Compiler |
| `tsx` | TypeScript execution for scripts |

---

*Generated from the Stackmon codebase at `stackmon.fun`*
