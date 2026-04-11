# StakeStack Agent Skills

> Give this file to **any AI agent** as a system prompt. The agent will be able to
> autonomously control the StakeStack Unity game and make Solana MPP payments.

---

## Overview

| Property      | Value                               |
|---------------|-------------------------------------|
| Base URL      | `http://localhost:3000`             |
| Auth          | None (open for now)                 |
| Network       | Solana Devnet                       |
| Currency      | USDC (devnet mint `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) |
| Game          | StakeStack — competitive blockchain staking game |

> **Changing the base URL**: Open `skills.md` and replace `http://localhost:3000`
> with your deployed URL (e.g. `https://your-app.vercel.app`). That's the only
> thing you need to change.

---

## Skill 1 — `control_game`

Send a command to the StakeStack Unity WebGL game. Commands are delivered via an
SSE bridge; the game must have its page open in a browser tab for commands to
take effect.

### Endpoint

```
POST http://localhost:3000/api/game
Content-Type: application/json
```

### Request Body

```json
{ "action": "<one of the valid actions below>" }
```

### Valid Actions

| `action` value        | What it does in the game          |
|-----------------------|-----------------------------------|
| `StartBotMode`        | Start a Bot Match (vs AI)         |
| `StartPracticeMode`   | Start a Practice / Solo match     |
| `ExitToMainMenu`      | Exit current match → Main Menu    |
| `GetPracticeStatus`   | Fetch practice stats from Unity   |

> **Note:** `StartMultiplayerMode` exists in the Unity bridge but is disabled —
> do NOT use it yet.

### Success Response `200`

```json
{ "ok": true, "queued": { "action": "StartBotMode", "id": "<uuid>", "ts": 1712345678901 } }
```

### Error Response `400`

```json
{ "error": "Invalid action. Must be one of: StartBotMode, StartPracticeMode, ExitToMainMenu, GetPracticeStatus" }
```

### Example Curl

```bash
curl -X POST http://localhost:3000/api/game \
  -H "Content-Type: application/json" \
  -d '{"action":"StartBotMode"}'
```

### Natural Language → Action Mapping

When a user says something like the phrases below, map to the corresponding action:

| User says…                                        | Use action            |
|---------------------------------------------------|-----------------------|
| "start a bot match", "play vs bot", "fight the AI"| `StartBotMode`        |
| "practice mode", "solo mode", "train"             | `StartPracticeMode`   |
| "go to main menu", "exit", "go back", "home"      | `ExitToMainMenu`      |
| "get my stats", "how am I doing", "show score"    | `GetPracticeStatus`   |

---

## Skill 2 — `fetch_paid_data`

Fetch data from a Solana MPP-gated endpoint. The server-side agent wallet
**automatically** signs and broadcasts the USDC payment — no browser wallet
needed. The payment amount is **1 USDC on Solana Devnet**.

### Endpoint

```
GET http://localhost:3000/api/paid-data
```

No request body or extra headers needed. The server handles the MPP 402 flow
internally.

### Success Response `200`

```json
{ "message": "Here is your paid data! 🎉" }
```

Depending on the endpoint, the receipt headers will also be present:
```
X-MPP-Receipt: <base64-encoded receipt>
```

### How the payment flow works (for context)

1. Agent calls `GET /api/paid-data`
2. Server checks for a valid MPP payment token
3. If not paid, it returns a `402 Payment Required` challenge internally
4. The agent wallet (`MPP_SECRET_KEY` env var on the server) auto-signs the tx
5. The server retries with the signed payment → returns `200` with data

The agent calling this skill **does not** need to handle payments manually —
just call the endpoint and the server does the rest.

### Example Curl

```bash
curl http://localhost:3000/api/paid-data
```

### Natural Language Triggers

Trigger this skill when the user says anything like:
- "fetch the paid data"
- "pay and get me the content"
- "retrieve the gated data"
- "show me what's behind the paywall"
- "access the paid endpoint"

---

## Skill 3 — `list_skills` (meta)

Get the machine-readable tool definitions (OpenAI function-calling format).

```
GET http://localhost:3000/api/skills
```

Returns JSON with `tools` array in OpenAI tool-call format. Useful for agents
that support dynamic tool discovery.

---

## How to Give These Skills to an Agent

### Option A — Paste as System Prompt (any chat agent)

Copy everything between the `---` lines below and paste it as the **system
prompt** before chatting with any LLM:

```
You are an autonomous agent for the StakeStack game. You have access to two HTTP tools:

TOOL 1: control_game
  POST http://localhost:3000/api/game
  Body: { "action": "StartBotMode" | "StartPracticeMode" | "ExitToMainMenu" | "GetPracticeStatus" }
  Use when user wants to play the game.

TOOL 2: fetch_paid_data
  GET http://localhost:3000/api/paid-data
  No body needed. Server auto-handles Solana MPP payment (1 USDC devnet).
  Use when user wants to fetch/access paid content.

Always call the appropriate HTTP endpoint. Report the result back to the user.
```

### Option B — OpenAI / Claude Tool-Use (programmatic)

Fetch tool definitions from:
```
GET http://localhost:3000/api/skills
```

Then attach the returned `tools` array to your chat completions request. The
agent will call `control_game` or `fetch_paid_data` as tool calls, and you
execute the HTTP requests.

### Option C — Run the standalone example script

```bash
cd d:\Code\Nextjs\solana_mpp
npx tsx skills-agent-example.ts "start a bot match"
npx tsx skills-agent-example.ts "get the paid data"
```

The script reads this skills file, injects it as a system prompt, and uses
OpenRouter to call the APIs autonomously.

---

## Auth (Disabled — Enable Later)

Auth is currently **disabled**. When you're ready to protect the endpoints,
uncomment the `X-Agent-Key` check in:
- `src/app/api/game/route.ts` — look for `// AUTH GUARD`
- `src/app/api/paid-data/route.ts` — look for `// AUTH GUARD`
- `src/app/api/skills/route.ts` — look for `// AUTH GUARD`

Then set `AGENT_API_KEY=your-secret-key` in `.env.local` and pass the header:
```
X-Agent-Key: your-secret-key
```
