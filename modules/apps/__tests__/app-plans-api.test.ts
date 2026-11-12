import { describe, expect, it, vi } from 'vitest'

import {
  AppsApiError,
  createAppPlan,
  describeAppsError,
  fetchAppInstances,
  fetchAppPlans,
  fetchMyInstances,
  resetOptionalInstanceFields,
  retireAppPlan,
  setAppPlanTarget,
  updateAppPlan,
  type FetchLike,
} from '@/modules/apps/graphql'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sent(fetchImpl: ReturnType<typeof vi.fn<FetchLike>>, call = 0) {
  const init = fetchImpl.mock.calls[call][1]
  return JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> }
}

const PLAN = {
  id: 'p1',
  appId: 'app-1',
  slug: 'pro',
  name: 'Pro',
  kind: 'PRO',
  access: 'shared',
  size: 'VETRA_AGENT_S',
  targetVersion: '1.2.0',
  policy: 'manual',
  noticeHours: 72,
  status: 'active',
  createdAt: '2026-11-12T00:00:00Z',
  updatedAt: '2026-11-12T00:00:00Z',
}

const ok = (data: unknown) => vi.fn<FetchLike>(() => Promise.resolve(jsonResponse({ data })))

describe('plan queries', () => {
  it('fetchAppPlans selects every AppPlan field for the app', async () => {
    const fetchImpl = ok({ appPlans: [PLAN] })
    expect(await fetchAppPlans('app-1', 'tok', fetchImpl)).toEqual([PLAN])
    const { query, variables } = sent(fetchImpl)
    expect(variables).toEqual({ appId: 'app-1' })
    for (const f of Object.keys(PLAN)) expect(query).toContain(f)
  })

  it('fetchMyInstances selects the holder fields', async () => {
    const fetchImpl = ok({ myInstances: [] })
    expect(await fetchMyInstances('tok', fetchImpl)).toEqual([])
    const { query } = sent(fetchImpl)
    for (const f of ['instanceId', 'appId', 'appName', 'planName', 'access', 'url', 'reason'])
      expect(query).toContain(f)
  })

  it('fetchAppInstances asks for planId and holder, dropping them on an older backend', async () => {
    resetOptionalInstanceFields()
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(
        jsonResponse({
          errors: [{ message: 'Cannot query field "planId" on type "AppInstance".' }],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { appInstances: [] } }))
    expect(await fetchAppInstances('app-1', 'tok', fetchImpl)).toEqual([])
    expect(sent(fetchImpl, 0).query).toContain('planId')
    expect(sent(fetchImpl, 0).query).toContain('holder')
    expect(sent(fetchImpl, 1).query).not.toContain('planId')
    expect(sent(fetchImpl, 1).query).toContain('holder')
    resetOptionalInstanceFields()
  })
})

describe('plan mutations', () => {
  it('createAppPlan sends the input as given', async () => {
    const fetchImpl = ok({ createPlan: PLAN })
    const input = {
      appId: 'app-1',
      kind: 'PRO',
      access: 'own' as const,
      size: 'VETRA_AGENT_M' as const,
      targetVersion: '1.2.0',
    }
    expect(await createAppPlan(input, 'tok', fetchImpl)).toEqual(PLAN)
    const { query, variables } = sent(fetchImpl)
    expect(query).toMatch(/createPlan\(input: \$input\)/)
    expect(variables).toEqual({ input })
  })

  it('keeps the server wording of a refusal', async () => {
    const fetchImpl = vi.fn<FetchLike>(() =>
      Promise.resolve(
        jsonResponse({
          errors: [
            {
              message: 'Plans are not enabled on this Vetra',
              extensions: { code: 'BAD_USER_INPUT' },
            },
          ],
        }),
      ),
    )
    const err = await createAppPlan(
      { appId: 'app-1', kind: 'PRO', access: 'shared' },
      'tok',
      fetchImpl,
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AppsApiError)
    expect(describeAppsError(err)).toBe('Plans are not enabled on this Vetra')
  })

  it('updateAppPlan, setAppPlanTarget and retireAppPlan pass their variables', async () => {
    const u = ok({ updatePlan: PLAN })
    await updateAppPlan({ planId: 'p1', size: 'VETRA_AGENT_L' }, 'tok', u)
    expect(sent(u).variables).toEqual({ input: { planId: 'p1', size: 'VETRA_AGENT_L' } })

    const t = ok({ setPlanTarget: PLAN })
    await setAppPlanTarget('p1', '1.3.0', 'tok', t)
    expect(sent(t).variables).toEqual({ planId: 'p1', version: '1.3.0' })

    const r = ok({ retirePlan: { ...PLAN, status: 'retired' } })
    expect((await retireAppPlan('p1', 'tok', r)).status).toBe('retired')
    expect(sent(r).variables).toEqual({ planId: 'p1' })
  })
})
