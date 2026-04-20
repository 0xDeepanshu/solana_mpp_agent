import { NextRequest, NextResponse } from 'next/server'

// Unity WebGL can run on any port, so we allow all origins.
// Tighten this to specific domains if you need stricter security.
const CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Agent-Key',
    'Access-Control-Max-Age':       '86400',
}

export function middleware(request: NextRequest) {
    // ── Pre-flight OPTIONS request ────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: CORS_HEADERS,
        })
    }

    // ── Attach CORS headers to every API response ─────────────────────────────
    const response = NextResponse.next()
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
        response.headers.set(key, value)
    }
    return response
}

// Only run on API routes
export const config = {
    matcher: '/api/:path*',
}
