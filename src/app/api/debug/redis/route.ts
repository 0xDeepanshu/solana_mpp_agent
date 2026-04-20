/**
 * GET /api/debug/redis
 * Temporary endpoint — shows Redis connection status and env var presence.
 * DELETE THIS after debugging.
 */

import { getRedisClient } from '@/lib/redis'

export async function GET() {
    const envCheck = {
        REDIS_HOST:     process.env.REDIS_HOST     ? `set (${process.env.REDIS_HOST})` : '❌ MISSING',
        REDIS_PORT:     process.env.REDIS_PORT     ? `set (${process.env.REDIS_PORT})` : '❌ MISSING',
        REDIS_USERNAME: process.env.REDIS_USERNAME ? 'set' : '❌ MISSING',
        REDIS_PASSWORD: process.env.REDIS_PASSWORD ? 'set (hidden)' : '❌ MISSING',
    }

    try {
        const redis = await getRedisClient()
        await redis.ping()
        return Response.json({ status: '✅ Redis connected', envCheck })
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return Response.json({ status: '❌ Redis failed', error: msg, envCheck }, { status: 500 })
    }
}

export const dynamic = 'force-dynamic'
