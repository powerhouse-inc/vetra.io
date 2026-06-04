import { type NextRequest, NextResponse } from 'next/server'
import { isCodeUsable } from '@/modules/invites/lib/codes'
import { clientIp, rateLimit } from '@/modules/invites/lib/rate-limit'
import { validateBodySchema } from '@/modules/invites/lib/schemas'
import { RATE_LIMIT_WINDOW_MS, VALIDATE_RATE_LIMIT } from '@/modules/invites/lib/constants'

export const dynamic = 'force-dynamic'

/** Validate-only: is this invite code currently usable? Never consumes it. */
export async function POST(request: NextRequest) {
  try {
    const rl = rateLimit(`validate:${clientIp(request)}`, VALIDATE_RATE_LIMIT, RATE_LIMIT_WINDOW_MS)
    if (!rl.allowed) {
      return NextResponse.json(
        { valid: false, error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec) } },
      )
    }

    const parsed = validateBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 400 })
    }
    const valid = await isCodeUsable(parsed.data.code)
    return NextResponse.json({ valid })
  } catch (error) {
    console.error('invite/validate error:', error)
    return NextResponse.json({ valid: false, error: 'Server error' }, { status: 500 })
  }
}
