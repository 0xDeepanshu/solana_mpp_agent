import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ── Allowed origins ──────────────────────────────────────────────────────────
// Only stackmon.fun (and localhost for local dev) may call the API.
const ALLOWED_ORIGINS = [
    'https://stackmon.fun',
    'https://www.stackmon.fun',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://crasychasy.vercel.app',
    'https://crashdash.xyz',
    'https://www.crashdash.xyz'
]

/** Check whether the given origin is permitted. */
function isAllowedOrigin(origin: string | null): boolean {
    // No Origin header = same-origin / server-side fetch → always allowed
    if (!origin) return true
    return ALLOWED_ORIGINS.includes(origin)
}

const corsOptions = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Key',
    'Access-Control-Max-Age': '86400',
}

// Next.js 16: exported function must be named "proxy" (replaces "middleware")
export default function proxy(request: NextRequest) {
    const origin = request.headers.get('origin')

    // ── Block requests from unauthorized origins ──────────────────────────────
    if (!isAllowedOrigin(origin)) {
        return NextResponse.json(
            { error: 'Forbidden: unauthorized origin' },
            { status: 403 },
        )
    }

    // Resolve the value we'll send back in Access-Control-Allow-Origin.
    // Use the actual origin so credentials / CORS work correctly.
    const allowedOrigin = origin ?? ALLOWED_ORIGINS[0]

    // ── Pre-flight OPTIONS request ────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
        return NextResponse.json({}, {
            headers: {
                'Access-Control-Allow-Origin': allowedOrigin,
                ...corsOptions,
            },
        })
    }

    // ── Attach CORS headers to every API response ─────────────────────────────
    const response = NextResponse.next()
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    for (const [key, value] of Object.entries(corsOptions)) {
        response.headers.set(key, value)
    }
    return response
}

// Only run on API routes
export const config = {
    matcher: '/api/:path*',
}
