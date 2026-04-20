import { NextRequest, NextResponse } from 'next/server'

// Origins allowed to call the API.
// Add your Unity WebGL host and any other front-ends here.
const ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:8080',        // common Unity WebGL dev server
    'null',                         // Unity WebGL from local file (file://)
    process.env.NEXT_PUBLIC_BASE_URL ?? '',
].filter(Boolean)

const CORS_HEADERS = {
    'Access-Control-Allow-Methods':  'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':  'Content-Type, Authorization, X-Agent-Key',
    'Access-Control-Max-Age':        '86400',
}

export function middleware(request: NextRequest) {
    const origin   = request.headers.get('origin') ?? ''
    const isAllowed = ALLOWED_ORIGINS.includes(origin)

    // ── Pre-flight OPTIONS request ────────────────────────────────────────────
    if (request.method === 'OPTIONS') {
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
                ...CORS_HEADERS,
            },
        })
    }

    // ── Actual request — attach CORS headers to the response ─────────────────
    const response = NextResponse.next()

    response.headers.set(
        'Access-Control-Allow-Origin',
        isAllowed ? origin : ALLOWED_ORIGINS[0]
    )
    for (const [key, value] of Object.entries(CORS_HEADERS)) {
        response.headers.set(key, value)
    }

    return response
}

// Only run middleware on API routes — skip static assets and pages
export const config = {
    matcher: '/api/:path*',
}
