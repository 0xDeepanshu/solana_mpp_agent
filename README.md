# Solana MPP (Micro-Payment Protocol) Integration

This project demonstrates an implementation of the **Solana Micro-Payment Protocol (MPP)** within a Next.js application. It features a seamless wallet connection experience and an AI agent capable of handling autonomous payments for data access.

## Features

- **Solana Wallet Integration**: Support for Phantom, Solflare, and other Solana-compatible wallets via `@solana/wallet-adapter`.
- **Autonomous AI Agent**: An integrated AI agent (`/agent`) that can programmatically sign and broadcast payment transactions to access paid data.
- **MPP Payment Flows**: Implementation of the 402 Payment Required flow using the `@solana/mpp` SDK.
- **Modern UI**: Built with Next.js 15+, Tailwind CSS, and Framer Motion for a premium, responsive experience.

## Getting Started

### Prerequisites

- Node.js 20+
- A Solana wallet (e.g., Phantom)
- Some Devnet SOL for testing

### Setup

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
   Create a `.env.local` file in the root directory and add your keys:
   ```env
   # Solana Configuration
   SOLANA_RPC_URL=https://api.devnet.solana.com
   MPP_PROGRAM_ID=...
   
   # AI / Agent Configuration
   OPENROUTER_API_KEY=your_api_key
   AGENT_WALLET_PRIVATE_KEY=your_private_key_in_base58
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## Project Structure

- `src/app/agent`: The AI agent interface and logic.
- `src/app/api`: Backend API routes for handling paid data and transaction processing.
- `src/components`: Reusable UI components including specialized Solana wallet connectors.
- `src/lib`: Core logic for MPP integration and agent payment handling.
- `src/providers.tsx`: Global context providers for Solana and application state.

## Learn More

- [Solana MPP Documentation](https://github.com/solana-labs/mpp)
- [Next.js Documentation](https://nextjs.org/docs)


