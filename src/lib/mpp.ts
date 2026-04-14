import { Mppx, solana } from '@solana/mpp/server'

// Devnet USDC mint: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
// Mainnet USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
export function getMppx() {
    return Mppx.create({
        secretKey: process.env.MPP_SECRET_KEY!,
        methods: [
            solana.charge({
                recipient: process.env.MPP_RECIPIENT_ADDRESS!,
                currency: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC on devnet
                decimals: 6,
                network: 'devnet',
            }),
        ],
    })
}
