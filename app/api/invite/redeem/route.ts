import { type NextRequest, NextResponse } from 'next/server'
import { redeemCode } from '@/modules/invites/lib/codes'
import { verifyRenownIdentity } from '@/modules/invites/lib/verify-identity'
import { redeemBodySchema } from '@/modules/invites/lib/schemas'

export const dynamic = 'force-dynamic'

/**
 * Consume a code for the logged-in user. Verifies the Renown credential
 * server-side (never trusts the client's claimed identity), then binds the code
 * to the returned DID.
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = redeemBodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid request' }, { status: 400 })
    }
    const { code, token } = parsed.data

    const identity = await verifyRenownIdentity(token)
    if (!identity) {
      return NextResponse.json(
        { ok: false, error: 'Identity verification failed' },
        { status: 401 },
      )
    }

    const result = await redeemCode(code, identity.did)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: 'Code is not valid' }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('invite/redeem error:', error)
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 })
  }
}
