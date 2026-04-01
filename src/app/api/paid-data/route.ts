import { mppx } from '@/lib/mpp'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    // 1. Check if user has paid
    let result: Awaited<ReturnType<ReturnType<typeof mppx.charge>>>
    try {
        result = await mppx.charge({
            amount: '1000000', // 1 USDC (devnet)
            currency: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // devnet USDC mint
        })(request)
    } catch (err) {
        console.error('[paid-data] mppx.charge threw:', err)
        return Response.json({ error: 'Payment handler error' }, { status: 500 })
    }

    // 2. If not paid → send back a 402 "pay first" challenge
    if (result.status === 402) {
        console.log('[paid-data] Returning 402 challenge')
        return result.challenge
    }

    // 3. If paid → give them the data with payment receipt
    console.log('[paid-data] Payment verified ✅')
    return result.withReceipt(
        Response.json({ message: 'Here is your paid data! 🎉' })
    )
}