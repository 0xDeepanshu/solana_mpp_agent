# Stackmon - Solana MPP & AI Agent Integration

This project is the Next.js backend and web frontend for **Stackmon** (formerly StakeStack), demonstrating an advanced implementation of the **Solana Micro-Payment Protocol (MPP)** alongside an autonomous AI gameplay agent and Unity WebGL game integration.

## 🌟 Core Features

- **Solana Micro-Payment Protocol (MPP)**: Seamlessly integrates 402 Payment Required flows using the `@solana/mpp` SDK. Users and agents can pay micro-transactions for data or actions.
- **Autonomous AI Gameplay Agent**: An integrated AI agent capable of programmatically playing the game, signing and broadcasting payment transactions, and utilizing predefined gameplay "skills" via long-polling.
- **Custom Solana Wallet Integration**: Tailored wallet connection experience supporting Phantom, Solflare, and others via `@solana/wallet-adapter-react`, featuring custom UI components (`WalletModal`, `WalletDropdown`).
- **Redis Session Management**: Robust, persistent session management backed by Redis Cloud (`redis` package) to maintain state between the Next.js backend, AI agents, and Unity game clients.
- **Unity WebGL Bridge**: Features a custom `proxy.ts` to seamlessly handle CORS and route requests dynamically for Unity WebGL builds running on dynamic ports.
- **Modern Tech Stack**: Built with Next.js 15+ (App Router), React 19, Tailwind CSS v4, Biome for linting, and fully typed in TypeScript.

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- A Solana wallet (e.g., Phantom or Solflare)
- Devnet SOL for testing
- A Redis Cloud instance (or local Redis server)

### Setup & Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd solana_mpp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env.local` file in the root directory and configure your keys:
   ```env
   # Solana Configuration
   NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
   MPP_PROGRAM_ID=your_mpp_program_id

   # AI / Agent Configuration
   OPENROUTER_API_KEY=your_openrouter_api_key
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   AGENT_WALLET_PRIVATE_KEY=your_agent_private_key_base58

   # Redis Configuration
   REDIS_URL=redis://default:password@your-redis-url:port
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:3000`.

## 📂 Project Architecture

- **`src/app/`**: Next.js App Router structure.
  - **`agent/`**: The AI agent interface, visualization, and logic.
  - **`api/`**: Backend API routes.
    - `/agent`: API routes for AI agent automation and transaction signing.
    - `/game`: Game state, matchmaking, and match store routes.
    - `/paid-data`: Endpoints protected by Solana MPP (402 Payment Required).
    - `/player`, `/session`, `/skills`: Player records, status, and gameplay skills definitions.
- **`src/components/`**: Reusable UI components. Includes specialized, premium-styled Solana wallet connectors (`WalletConnect`, `WalletDropdown`, `WalletModal`).
- **`src/lib/`**: Core shared logic.
  - `agent-mpp.ts`: Agent-specific MPP payment handling.
  - `matchStore.ts`: In-memory or Redis-backed match state.
  - `mpp.ts`: Core Solana MPP utility functions.
  - `redis.ts`: Redis client configuration and connection management.
- **`src/proxy.ts`**: Dedicated proxy middleware to fix CORS policy issues and allow cross-origin requests from Unity's dynamic ports to the Next.js backend.
- **`src/providers.tsx`**: Global context providers for Solana wallet adapters and application state.

## 🤖 Autonomous Agent Integration

The project includes an autonomous agent designed to interact with the Unity game client. The agent:
1. Listens for game state via long-polling (avoiding fixed-duration delays).
2. Executes actions using predefined skills.
3. Automatically funds actions using its configured `AGENT_WALLET_PRIVATE_KEY` via the Solana MPP integration.

## 🔗 Learn More

- [Solana MPP Documentation](https://github.com/solana-labs/mpp)
- [Next.js Documentation](https://nextjs.org/docs)
- [Redis Node Client](https://github.com/redis/node-redis)

---
*Domain: stackmon.fun*
