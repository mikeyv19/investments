import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Simple in-memory rate limiter
// In production, consider using Redis or another distributed solution
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

// Rate limit configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60 // 60 requests per minute

export function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const key = `${ip}:${request.nextUrl.pathname}`
    const now = Date.now()

    // Get or create rate limit entry
    let rateLimitEntry = rateLimitMap.get(key)
    
    if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
      rateLimitEntry = {
        count: 0,
        resetTime: now + RATE_LIMIT_WINDOW,
      }
    }

    rateLimitEntry.count++
    rateLimitMap.set(key, rateLimitEntry)

    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance on each request
      cleanupRateLimitMap()
    }

    // Check if rate limit exceeded
    if (rateLimitEntry.count > RATE_LIMIT_MAX_REQUESTS) {
      return NextResponse.json(
        { 
          error: 'Too many requests',
          message: 'Please try again later',
          retryAfter: Math.ceil((rateLimitEntry.resetTime - now) / 1000),
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(rateLimitEntry.resetTime).toISOString(),
            'Retry-After': Math.ceil((rateLimitEntry.resetTime - now) / 1000).toString(),
          },
        }
      )
    }

    // Add rate limit headers to response
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString())
    response.headers.set(
      'X-RateLimit-Remaining',
      (RATE_LIMIT_MAX_REQUESTS - rateLimitEntry.count).toString()
    )
    response.headers.set('X-RateLimit-Reset', new Date(rateLimitEntry.resetTime).toISOString())

    return response
  }

  return NextResponse.next()
}

// Clean up expired entries from the rate limit map
function cleanupRateLimitMap() {
  const now = Date.now()
  const keysToDelete: string[] = []

  rateLimitMap.forEach((entry, key) => {
    if (now > entry.resetTime + RATE_LIMIT_WINDOW) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach(key => rateLimitMap.delete(key))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}