import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMyEnvironments, setEnvironmentOrg, syncEnvironmentOrg } from '@/modules/cloud/graphql'
import {
  EnvironmentAccessError,
  EnvironmentHandOverError,
  cachedSyncEnvironmentOrg,
  describeEnvironmentOrgError,
  ensureCanOperateEnvironment,
  handOverTargets,
  handOverToOrg,
  resetOrgSyncCache,
  runSignedEnvironmentAction,
  withOrgSync,
} from '@/modules/cloud/org-sync'

afterEach(() => {
  vi.unstubAllGlobals()
  resetOrgSyncCache()
})

function stub(answers: Array<{ data?: unknown; errors?: { message: string }[] }>) {
  const bodies: { query: string; variables: Record<string, unknown> }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string) as (typeof bodies)[number])
      const next = answers.shift() ?? { data: null }
      return Promise.resolve(
        new Response(JSON.stringify(next), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    }),
  )
  return bodies
}

describe('organisation environments', () => {
  it('lists an organisation’s environments with scope ORG and orgId', async () => {
    const bodies = stub([{ data: { myEnvironments: [{ id: 'e1', ownerOrgId: 'o1' }] } }])
    const envs = await fetchMyEnvironments('ORG', 'tok', 'o1')
    expect(envs).toStrictEqual([{ id: 'e1', ownerOrgId: 'o1' }])
    expect(bodies[0].variables).toStrictEqual({ scope: 'ORG', orgId: 'o1' })
    expect(bodies[0].query).toContain('myEnvironments(scope: $scope, orgId: $orgId)')
  })

  it('syncs and hands over through the observability mutations', async () => {
    const access = { environmentId: 'e1', ownerOrgId: 'o1', canOperate: true, canView: true }
    const bodies = stub([
      { data: { syncEnvironmentOrg: access } },
      { data: { setEnvironmentOrg: access } },
    ])
    expect(await syncEnvironmentOrg('e1', 'tok')).toStrictEqual(access)
    expect(await setEnvironmentOrg('e1', 'o1', 'tok')).toStrictEqual(access)
    expect(bodies[1].variables).toStrictEqual({ environmentId: 'e1', orgId: 'o1' })
  })

  it('retries ENV_NOT_FOUND, then gives up with the env id', async () => {
    const sleep = vi.fn(() => Promise.resolve(undefined))
    stub([
      { errors: [{ message: 'ENV_NOT_FOUND' }] },
      {
        data: {
          setEnvironmentOrg: {
            environmentId: 'e1',
            ownerOrgId: 'o1',
            canOperate: true,
            canView: true,
          },
        },
      },
    ])
    await handOverToOrg('e1', 'o1', 'tok', { sleep })
    expect(sleep).toHaveBeenCalledTimes(1)

    stub(Array.from({ length: 3 }, () => ({ errors: [{ message: 'ENV_NOT_FOUND' }] })))
    await expect(handOverToOrg('e1', 'o1', 'tok', { attempts: 3, sleep })).rejects.toBeInstanceOf(
      EnvironmentHandOverError,
    )

    stub([{ errors: [{ message: 'FORBIDDEN' }] }])
    await expect(handOverToOrg('e1', 'o1', 'tok', { sleep })).rejects.toMatchObject({
      environmentId: 'e1',
      message: expect.stringContaining('FORBIDDEN') as unknown,
    })
  })

  it('loads even when the sync fails', async () => {
    const order: string[] = []
    const result = await withOrgSync(
      'e1',
      () => {
        order.push('load')
        return Promise.resolve('doc')
      },
      {
        sync: () => {
          order.push('sync')
          return Promise.reject(new Error('Cannot query field "syncEnvironmentOrg"'))
        },
        token: () => Promise.resolve('tok'),
      },
    )
    expect(result).toBe('doc')
    expect(order).toStrictEqual(['sync', 'load'])
  })
})

describe('signed actions on organisation environments', () => {
  const access = (canOperate: boolean) => ({
    environmentId: 'e1',
    ownerOrgId: 'o1',
    canOperate,
    canView: true,
  })
  const controller = (state: unknown) => ({
    state: { global: state },
    pull: vi.fn(() => Promise.resolve(undefined)),
  })
  const deps = (answer: () => Promise<ReturnType<typeof access>>) => ({
    sync: vi.fn(answer),
    token: () => Promise.resolve('tok'),
  })

  it('lets personal environments through without a sync', async () => {
    const d = deps(() => Promise.resolve(access(false)))
    await ensureCanOperateEnvironment(
      'e1',
      controller({ owner: '0xme', ownerOrgId: null }),
      '0xMe',
      d,
    )
    expect(d.sync).not.toHaveBeenCalled()
  })

  it('syncs first and proceeds only when the caller can operate', async () => {
    const ok = deps(() => Promise.resolve(access(true)))
    const listed = controller({ ownerOrgId: 'o1', orgOperators: ['0xme'] })
    await ensureCanOperateEnvironment('e1', listed, '0xMe', ok)
    expect(ok.sync).toHaveBeenCalledWith('e1', 'tok', '0xme')
    expect(listed.pull).not.toHaveBeenCalled()

    const refused = deps(() => Promise.resolve(access(false)))
    await expect(
      ensureCanOperateEnvironment(
        'e1',
        controller({ ownerOrgId: 'o1', orgOperators: [] }),
        '0xme',
        refused,
      ),
    ).rejects.toBeInstanceOf(EnvironmentAccessError)

    const broken = deps(() => Promise.reject(new Error('UNAUTHENTICATED')))
    await expect(
      ensureCanOperateEnvironment(
        'e1',
        controller({ ownerOrgId: 'o1', orgOperators: ['0xme'] }),
        '0xme',
        broken,
      ),
    ).rejects.toMatchObject({
      environmentId: 'e1',
      message: expect.stringContaining('UNAUTHENTICATED') as unknown,
    })
  })

  it('pulls when the local copy does not list the new operator yet', async () => {
    const ctrl = controller({ ownerOrgId: 'o1', orgOperators: ['0xother'] })
    await ensureCanOperateEnvironment(
      'e1',
      ctrl,
      '0xme',
      deps(() => Promise.resolve(access(true))),
    )
    expect(ctrl.pull).toHaveBeenCalledTimes(1)
  })

  it('reuses a sync answer for ten seconds per caller and environment', async () => {
    const bodies = stub([
      { data: { syncEnvironmentOrg: access(true) } },
      { data: { syncEnvironmentOrg: access(false) } },
      { data: { syncEnvironmentOrg: access(true) } },
    ])
    let t = 0
    const now = () => t
    expect((await cachedSyncEnvironmentOrg('e1', 'tok', { caller: '0xA', now })).canOperate).toBe(
      true,
    )
    t = 9_999
    expect((await cachedSyncEnvironmentOrg('e1', 'tok', { caller: '0xa', now })).canOperate).toBe(
      true,
    )
    expect(bodies).toHaveLength(1)
    t = 10_000
    expect((await cachedSyncEnvironmentOrg('e1', 'tok', { caller: '0xa', now })).canOperate).toBe(
      false,
    )
    expect((await cachedSyncEnvironmentOrg('e1', 'tok', { caller: '0xb', now })).canOperate).toBe(
      true,
    )
    expect(bodies).toHaveLength(3)
  })
})

describe('hand-over to an organisation', () => {
  const orgs = [
    { id: 'o1', role: 'PUBLISHER' },
    { id: 'o2', role: 'MEMBER' },
    { id: 'o3', role: 'OWNER' },
  ]
  const base = {
    ownerOrgId: null,
    owner: '0xMe',
    viewer: '0xme',
    status: 'READY',
    appLinked: false,
    orgs,
  }

  it('offers the owner of an active personal env the orgs where they publish', () => {
    expect(handOverTargets(base).map((o) => o.id)).toStrictEqual(['o1', 'o3'])
  })

  it('offers nothing to others, for org/app envs, or for released envs', () => {
    expect(handOverTargets({ ...base, viewer: '0xother' })).toStrictEqual([])
    expect(handOverTargets({ ...base, owner: null })).toStrictEqual([])
    expect(handOverTargets({ ...base, ownerOrgId: 'o1' })).toStrictEqual([])
    expect(handOverTargets({ ...base, appLinked: true })).toStrictEqual([])
    for (const status of ['TERMINATING', 'DESTROYED', 'ARCHIVED']) {
      expect(handOverTargets({ ...base, status })).toStrictEqual([])
    }
  })

  it('explains the server refusals', () => {
    expect(describeEnvironmentOrgError('ENV_NOT_ACTIVE')).toMatch(/no longer active/)
    expect(describeEnvironmentOrgError('ALREADY_ORG_OWNED')).toMatch(/already belongs/)
    expect(describeEnvironmentOrgError('APP_ENVIRONMENT')).toMatch(/follow their app/)
    expect(describeEnvironmentOrgError('FORBIDDEN', 'Acme')).toMatch(/publisher or above \(Acme\)/)
    expect(describeEnvironmentOrgError('boom')).toBe('boom')
  })
})

describe('signed action wiring (mutate)', () => {
  type Ctrl = {
    state: { global: unknown }
    pull: () => Promise<unknown>
    push: () => Promise<unknown>
    setLabel: (i: { label: string }) => void
  }
  function ctrl(state: unknown, push: () => Promise<unknown> = () => Promise.resolve()) {
    const order: string[] = []
    const c: Ctrl = {
      state: { global: state },
      pull: () => Promise.resolve(),
      push: () => {
        order.push('push')
        return push()
      },
      setLabel: () => order.push('dispatch'),
    }
    return { c, order }
  }

  it('gates, then dispatches and pushes', async () => {
    const { c, order } = ctrl({ ownerOrgId: 'o1', orgOperators: ['0xme'] })
    const gate = vi.fn(() => {
      order.push('gate')
      return Promise.resolve()
    })
    await runSignedEnvironmentAction('e1', c, '0xme', (x) => x.setLabel({ label: 'n' }), { gate })
    expect(order).toStrictEqual(['gate', 'dispatch', 'push'])
    expect(gate).toHaveBeenCalledWith('e1', c, '0xme')
  })

  it('a gate refusal dispatches nothing and re-asks the access', async () => {
    const { c, order } = ctrl({ ownerOrgId: 'o1', orgOperators: [] })
    const onOrgRefusal = vi.fn()
    const gate = () => Promise.reject(new EnvironmentAccessError('e1', 'no'))
    await expect(
      runSignedEnvironmentAction('e1', c, '0xme', (x) => x.setLabel({ label: 'n' }), {
        gate,
        onOrgRefusal,
      }),
    ).rejects.toBeInstanceOf(EnvironmentAccessError)
    expect(order).toStrictEqual([])
    expect(onOrgRefusal).toHaveBeenCalledTimes(1)
  })

  it('a server refusal on an org env re-asks the access; personal envs do not', async () => {
    const org = ctrl({ ownerOrgId: 'o1', orgOperators: ['0xme'] }, () =>
      Promise.reject(new Error('NotOwnerError')),
    )
    const onOrgRefusal = vi.fn()
    const gate = () => Promise.resolve()
    await expect(
      runSignedEnvironmentAction('e1', org.c, '0xme', (x) => x.setLabel({ label: 'n' }), {
        gate,
        onOrgRefusal,
      }),
    ).rejects.toThrow('NotOwnerError')
    expect(onOrgRefusal).toHaveBeenCalledTimes(1)

    const personal = ctrl({ owner: '0xme', ownerOrgId: null }, () =>
      Promise.reject(new Error('offline')),
    )
    await expect(
      runSignedEnvironmentAction('e1', personal.c, '0xme', (x) => x.setLabel({ label: 'n' }), {
        gate,
        onOrgRefusal,
      }),
    ).rejects.toThrow('offline')
    expect(onOrgRefusal).toHaveBeenCalledTimes(1)
  })

  it('a personal env action makes no sync request', async () => {
    const bodies = stub([])
    const { c, order } = ctrl({ owner: '0xme', ownerOrgId: null })
    await runSignedEnvironmentAction('e1', c, '0xme', (x) => x.setLabel({ label: 'n' }))
    expect(order).toStrictEqual(['dispatch', 'push'])
    expect(bodies).toHaveLength(0)
  })
})
