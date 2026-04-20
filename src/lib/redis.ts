import { createClient, type RedisClientType } from 'redis'

// Vercel serverless: cache the client across warm invocations
let client: RedisClientType | null = null
let connecting: Promise<RedisClientType> | null = null

export async function getRedisClient(): Promise<RedisClientType> {
    // Return existing connected client
    if (client?.isOpen) return client

    // Deduplicate concurrent connect() calls (race-condition guard)
    if (connecting) return connecting

    connecting = (async () => {
        const host     = process.env.REDIS_HOST
        const port     = Number(process.env.REDIS_PORT ?? 6379)
        const username = process.env.REDIS_USERNAME ?? 'default'
        const password = process.env.REDIS_PASSWORD

        if (!host || !password) {
            throw new Error(
                '[redis] Missing env vars: REDIS_HOST and/or REDIS_PASSWORD are not set. ' +
                'Add them in Vercel → Settings → Environment Variables.'
            )
        }

        console.log(`[redis] Connecting to ${host}:${port}…`)

        const c = createClient({
            username,
            password,
            socket: {
                host,
                port,
                tls: true,          // Redis Cloud requires TLS on non-6379 ports
                reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
            },
        }) as RedisClientType

        c.on('error', (err) => console.error('[redis] Client error:', err))

        await c.connect()
        console.log('[redis] Connected ✅')

        client    = c
        connecting = null
        return c
    })()

    return connecting
}