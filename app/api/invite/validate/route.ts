import { type NextRequest, NextResponse } from 'next/server'
import { isCodeUsable } from '@/modules/invites/lib/codes'
import { validateBodySchema } from '@/modules/invites/lib/schemas'

export const dynamic = 'force-dynamic'

/** Validate-only: is this invite code currently usable? Never consumes it. */
export async function POST(request: NextRequest) {
  try {
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
