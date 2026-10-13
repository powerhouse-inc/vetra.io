import { describe, expect, it, vi } from 'vitest'
import {
  fetchMyOrganizations,
  fetchMyOrganizationsAnswer,
  fetchOrganizationSummary,
  renownOrgsEndpoint,
} from '../graphql'

const ME = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
const org = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  did: `did:web:www.renown.id:org:${id}`,
  handle: name.toLowerCase(),
  name,
  avatar: null,
  verifiedDomains: [],
  archived: false,
  takenDown: false,
  ...extra,
})
const ok = (data: unknown) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

describe('Renown organisations client', () => {
  it('targets renown-orgs on the Renown switchboard', () => {
    expect(renownOrgsEndpoint()).toBe('https://switchboard.renown.vetra.io/graphql/renown-orgs')
  })

  it('lists the viewer’s memberships with the bearer, without archived or taken-down orgs, by name', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        ok({
          organizationsByMember: [
            { role: 'MEMBER', org: org('o2', 'Zeta') },
            { role: 'ADMIN', org: org('o1', 'Acme') },
            { role: 'OWNER', org: org('o3', 'Gone', { archived: true }) },
            { role: 'OWNER', org: org('o4', 'Down', { takenDown: true }) },
          ],
        }),
      ),
    )
    const orgs = await fetchMyOrganizations(ME, 'tok', fetchImpl)
    expect(orgs.map((o) => [o.name, o.role])).toStrictEqual([
      ['Acme', 'ADMIN'],
      ['Zeta', 'MEMBER'],
    ])
    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect((JSON.parse(init.body as string) as { variables: unknown }).variables).toStrictEqual({
      address: ME,
    })
  })

  it('retries without the bearer when Renown refuses it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('no', { status: 401 }))
      .mockResolvedValueOnce(
        ok({ organizationsByMember: [{ role: 'MEMBER', org: org('o1', 'Acme') }] }),
      )
    const orgs = await fetchMyOrganizations(ME, 'tok', fetchImpl as unknown as typeof fetch)
    expect(orgs).toHaveLength(1)
    const second = fetchImpl.mock.calls[1][1] as RequestInit
    expect((second.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('throws on GraphQL errors and answers null for an unknown org', async () => {
    const failing = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), { status: 200 }),
      ),
    )
    await expect(
      fetchMyOrganizations(ME, null, failing as unknown as typeof fetch),
    ).rejects.toThrow('boom')
    const empty = vi.fn(() => Promise.resolve(ok({ organization: null })))
    expect(await fetchOrganizationSummary('nope', empty as unknown as typeof fetch)).toBeNull()
  })
})

describe('R5: GraphQL-level refusal of the bearer', () => {
  it('retries once without the bearer on FORBIDDEN / UNAUTHENTICATED at HTTP 200', async () => {
    for (const code of ['FORBIDDEN', 'UNAUTHENTICATED']) {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ errors: [{ message: 'nope', extensions: { code } }] }), {
            status: 200,
          }),
        )
        .mockResolvedValueOnce(
          ok({ organizationsByMember: [{ role: 'MEMBER', org: org('o1', 'Acme') }] }),
        )
      const orgs = await fetchMyOrganizations(ME, 'tok', fetchImpl as unknown as typeof fetch)
      expect(orgs).toHaveLength(1)
      expect(fetchImpl).toHaveBeenCalledTimes(2)
      const second = fetchImpl.mock.calls[1][1] as RequestInit
      expect((second.headers as Record<string, string>).Authorization).toBeUndefined()
    }
  })

  it('marks the answer after a bearer refusal as partial (public memberships only)', async () => {
    const refused = () =>
      new Response(
        JSON.stringify({ errors: [{ message: 'nope', extensions: { code: 'FORBIDDEN' } }] }),
        { status: 200 },
      )
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(refused())
      .mockResolvedValueOnce(ok({ organizationsByMember: [] }))
      .mockResolvedValueOnce(ok({ organizationsByMember: [] }))
    const degraded = await fetchMyOrganizationsAnswer(
      ME,
      'tok',
      fetchImpl as unknown as typeof fetch,
    )
    expect(degraded.partial).toBe(true)
    const full = await fetchMyOrganizationsAnswer(ME, 'tok', fetchImpl as unknown as typeof fetch)
    expect(full.partial).toBe(false)
  })

  it('does not retry other GraphQL errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ errors: [{ message: 'boom', extensions: { code: 'INTERNAL' } }] }),
          { status: 200 },
        ),
      ),
    )
    await expect(fetchMyOrganizations(ME, 'tok', fetchImpl)).rejects.toThrow('boom')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
