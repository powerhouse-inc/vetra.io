import { type NextRequest, NextResponse } from 'next/server'
import { getAccessStatus } from '@/modules/invites/lib/codes'
import { verifyRenownIdentity } from '@/modules/invites/lib/verify-identity'
import { statusBodySchema } from '@/modules/invites/lib/schemas'

export const dynamic = 'force-dynamic'

/**
 * Does the logged-in user already have access (and via which cohort)? Verifies
 * identity first, then reads their most recent valid redemption. Used by the
 * gate to skip straight to "granted" for returning users.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = statusBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ allowed: false, error: 'Invalid request' }, { status: 400 })
    }
    const { token } = parsed.data

    const identity = await verifyRenownIdentity(token)
    if (!identity) {
      return NextResponse.json(
        { allowed: false, error: 'Identity verification failed' },
        { status: 401 },
      )
    }

    const status = await getAccessStatus(identity.did)
    return NextResponse.json(status)
  } catch (error) {
    console.error('invite/status error:', error)
    return NextResponse.json({ allowed: false, error: 'Server error' }, { status: 500 })
  }
}
