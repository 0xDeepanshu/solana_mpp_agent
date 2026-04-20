import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Unity WebGL can run on any port, so we allow all origins.
const corsOptions = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Key',
    'Access-Control-Max-Age':       '86400',
}

// Next.js 16: exported function must be named "proxy" (replaces "middleware")
export default function proxy(request: NextRequest) {
    // ── Pre-flight OPTIONS request ────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
        return NextResponse.json({}, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                ...corsOptions,
            },
        })
    }

    // ── Attach CORS headers to every API response ─────────────────────────────
    const response = NextResponse.next()
    response.headers.set('Access-Control-Allow-Origin', '*')
    for (const [key, value] of Object.entries(corsOptions)) {
        response.headers.set(key, value)
    }
    return response
}

// Only run on API routes
export const config = {
    matcher: '/api/:path*',
}
