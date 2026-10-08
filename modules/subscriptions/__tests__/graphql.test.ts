import { describe, it, expect } from 'vitest'
import type { FetchLike } from '@/modules/publisher/graphql'
import {
  applyStudioKey,
  cancelSubscription,
  fetchInviteCodeCheck,
  fetchMySubscriptions,
  fetchStudioAccess,
  redeemInviteCode,
} from '../graphql'

const capture = (data: unknown) => {
  const calls: Array<{ query: string; variables: unknown; auth: string | undefined }> = []
  const fetchImpl = (async (_url: string, init: RequestInit) => {
    calls.push({
      ...JSON.parse(init.body as string),
      auth: (init.headers as Record<string, string>).Authorization,
    })
    return new Response(JSON.stringify({ data }), { status: 200 })
  }) as unknown as FetchLike
  return { calls, fetchImpl }
}

const SUB_FIELDS =
  'licenseId appId appName kind termLabel issuer status start end mode environmentId environmentLabel openUrl stoppedAt deleteAfter warnings { kind at message }'

describe('vetraSubscriptions client', () => {
  it('checks a code without a token', async () => {
    const check = {
      valid: true,
      appId: 'a',
      appName: 'Vault',
      kind: 'pilot',
      termLabel: 'Pilot',
      mode: 'DEDICATED',
    }
    const { calls, fetchImpl } = capture({ vetraSubscriptions: { inviteCode: check } })
    await expect(fetchInviteCodeCheck('LFC_2026-vip', fetchImpl)).resolves.toEqual(check)
    expect(calls[0].auth).toBeUndefined()
    expect(calls[0].variables).toEqual({ code: 'LFC_2026-vip' })
    expect(calls[0].query).toContain(
      'inviteCode(code: $code) { valid appId appName kind termLabel mode }',
    )
  })

  it('lists my subscriptions with every contract field', async () => {
    const { calls, fetchImpl } = capture({ vetraSubscriptions: { mySubscriptions: [] } })
    await fetchMySubscriptions('tok', fetchImpl)
    expect(calls[0].auth).toBe('Bearer tok')
    expect(calls[0].query.replace(/\s+/g, ' ')).toContain(`mySubscriptions { ${SUB_FIELDS} }`)
  })

  it('reads studio access', async () => {
    const access = { allowed: true, licenseId: 'l', expires: null, hasAttachedKey: true }
    const { calls, fetchImpl } = capture({ vetraSubscriptions: { studioAccess: access } })
    await expect(fetchStudioAccess('tok', fetchImpl)).resolves.toEqual(access)
    expect(calls[0].query).toContain('studioAccess { allowed licenseId expires hasAttachedKey }')
  })

  it('redeems with the input passed through untouched', async () => {
    const { calls, fetchImpl } = capture({
      vetraSubscriptions: { redeemInviteCode: { licenseId: 'l' } },
    })
    await redeemInviteCode({ code: 'C', upgrades: 'old' }, 'tok', fetchImpl)
    expect(calls[0].query).toContain('mutation ($input: RedeemInviteCodeInput!)')
    expect(calls[0].query).toContain('redeemInviteCode(input: $input) {')
    expect(calls[0].variables).toEqual({ input: { code: 'C', upgrades: 'old' } })
  })

  it('cancels and applies the studio key with bare arguments', async () => {
    const a = capture({ vetraSubscriptions: { cancelSubscription: true } })
    await expect(cancelSubscription('l1', 'tok', a.fetchImpl)).resolves.toBe(true)
    expect(a.calls[0].query).toContain('cancelSubscription(licenseId: $licenseId)')
    const b = capture({ vetraSubscriptions: { applyStudioKey: true } })
    await expect(applyStudioKey('t-1', ['ANTHROPIC_API_KEY'], 'tok', b.fetchImpl)).resolves.toBe(
      true,
    )
    expect(b.calls[0].query).toContain('mutation ($tenantId: String!, $secretNames: [String!]!)')
    expect(b.calls[0].query).toContain(
      'applyStudioKey(tenantId: $tenantId, secretNames: $secretNames)',
    )
    expect(b.calls[0].variables).toEqual({ tenantId: 't-1', secretNames: ['ANTHROPIC_API_KEY'] })
  })
})
