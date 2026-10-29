import { describe, expect, it, vi } from 'vitest'
import {
  applyRestorePlan,
  deployedVersions,
  emptyConfig,
  restorePlan,
  sameConfig,
  snapshotFromState,
  type ConfigSnapshot,
  type HistoryOperation,
  type RestoreActions,
} from '@/modules/cloud/lib/config-history'
import type { CloudEnvironmentState } from '@/modules/cloud/types'

const ALICE = '0xAbC0000000000000000000000000000000000001'

let n = 0
function op(type: string, input: unknown = {}, extra: Partial<HistoryOperation> = {}) {
  n += 1
  return {
    index: n,
    timestampUtcMs: String(Date.UTC(2026, 9, 1, 12, n)),
    action: { type, input, context: { signer: { user: { address: ALICE } } } },
    ...extra,
  } satisfies HistoryOperation
}

const clint = (name: string, size: string | null = null) => ({
  package: { registry: 'https://r', name, version: '1.0.0' },
  env: [{ name: 'A', value: '1', isSecret: false }],
  serviceCommand: null,
  selectedRessource: size,
})

function history(): HistoryOperation[] {
  n = 0
  return [
    op('SET_LABEL', { label: 'Staging' }),
    op('ENABLE_SERVICE', { type: 'CONNECT', prefix: 'connect' }),
    op('ENABLE_SERVICE', { type: 'SWITCHBOARD', prefix: 'switchboard' }),
    op('ADD_PACKAGE', { packageName: '@acme/base', version: '1.0.0' }),
    op('INITIALIZE', { genericSubdomain: 'blue-fox', genericBaseDomain: 'vetra.io' }),
    op('MARK_CHANGES_PUSHED'),
    op('MARK_DEPLOYMENT_STARTED'),
    op('REPORT_DEPLOYMENT_SUCCEEDED'),
    // v2: bigger switchboard, extra package
    op('SET_SERVICE_SIZE', { prefix: 'switchboard', size: 'VETRA_AGENT_L' }),
    op('ADD_PACKAGE', { packageName: '@acme/crm' }),
    op('SET_PACKAGE_VERSION', { packageName: '@acme/base', version: '1.1.0' }),
    // a rejected op leaves state alone
    op('REMOVE_PACKAGE', { packageName: '@acme/base' }, { error: 'NotOwnerError' }),
    op('APPROVE_CHANGES'),
    // a wake re-approves the same config: not a new version
    op('SLEEP_ENVIRONMENT'),
    op('WAKE_ENVIRONMENT'),
    // v3: agent + custom domain, connect off
    op('ENABLE_SERVICE', {
      type: 'CLINT',
      prefix: 'bot',
      clintConfig: clint('@acme/bot', 'VETRA_AGENT_M'),
      selectedRessource: 'VETRA_AGENT_M',
    }),
    op('DISABLE_SERVICE', { type: 'CONNECT', prefix: 'connect' }),
    op('SET_CUSTOM_DOMAIN', { enabled: true, domain: 'acme.com' }),
    op('SET_APEX_SERVICE', { type: 'SWITCHBOARD' }),
    op('APPROVE_CHANGES'),
  ]
}

describe('deployedVersions', () => {
  it('lists distinct approvals newest first with signer, time and changes', () => {
    const versions = deployedVersions(history())
    expect(versions.map((v) => v.index)).toEqual([20, 13, 5])
    const [v3, v2, v1] = versions
    expect(v1.signer).toBe(ALICE.toLowerCase())
    expect(v1.time).toBe(new Date(Date.UTC(2026, 9, 1, 12, 5)).toISOString())
    expect(v1.config).toMatchObject({
      label: 'Staging',
      genericSubdomain: 'blue-fox',
      packages: { '@acme/base': { version: '1.0.0', registry: null } },
    })
    expect(v1.changes).toContain('Turn on Connect')
    expect(v2.changes).toEqual([
      'Size of Switchboard: S → L',
      '@acme/base: 1.0.0 → 1.1.0',
      'Add @acme/crm latest',
    ])
    expect(v2.config.packages['@acme/base']).toBeDefined()
    expect(v3.changes).toEqual([
      'Turn off Connect',
      'Turn on Agent: bot',
      'Custom domain: off → acme.com; Service on the bare domain: none → Switchboard',
    ])
    expect(v3.config.services.find((s) => s.prefix === 'bot')?.size).toBe('VETRA_AGENT_M')
  })

  it('returns nothing for a document never approved', () => {
    n = 0
    expect(deployedVersions([op('SET_LABEL', { label: 'x' })])).toEqual([])
  })
})

describe('restorePlan', () => {
  const versions = deployedVersions(history())
  const [v3, v2, v1] = versions

  it('is empty when nothing differs', () => {
    expect(restorePlan(v2.config, v2.config).steps).toEqual([])
  })

  it('rolls v3 back to v2 with the minimal calls', () => {
    const plan = restorePlan(v3.config, v2.config)
    expect(plan.steps.map((s) => s.kind)).toEqual([
      'disableService',
      'enableService',
      'setCustomDomain',
    ])
    expect(plan.lines).toEqual([
      'Turn off Agent: bot',
      'Turn on Connect',
      'Custom domain: acme.com → off',
    ])
    expect(plan.steps[0]).toMatchObject({ type: 'CLINT', prefix: 'bot' })
    expect(plan.steps[2]).toMatchObject({ enabled: false, domain: null, apexService: null })
  })

  it('rolls v2 back to v1: size, removed package, version', () => {
    const plan = restorePlan(v2.config, v1.config)
    expect(plan.lines).toEqual([
      'Remove @acme/crm',
      'Size of Switchboard: L → S',
      '@acme/base: 1.1.0 → 1.0.0',
    ])
  })

  it('re-enables a CLINT agent with its config and size', () => {
    const plan = restorePlan(v2.config, v3.config)
    const enable = plan.steps.find((s) => s.kind === 'enableService')
    expect(enable).toMatchObject({
      type: 'CLINT',
      prefix: 'bot',
      clintConfig: { package: { name: '@acme/bot' }, selectedRessource: 'VETRA_AGENT_M' },
    })
    // size rides on the enable; no separate size step for the agent
    expect(plan.steps.some((s) => s.kind === 'setServiceSize' && s.prefix === 'bot')).toBe(false)
  })

  it('updates agent settings, labels and the apex alone', () => {
    const base: ConfigSnapshot = {
      ...emptyConfig(),
      label: 'A',
      customDomain: { enabled: true, domain: 'acme.com' },
      apexService: 'CONNECT',
      services: [
        {
          type: 'CLINT',
          prefix: 'bot',
          enabled: true,
          size: 'VETRA_AGENT_S',
          config: { ...clint('@acme/bot'), selectedRessource: 'VETRA_AGENT_S' },
        } as ConfigSnapshot['services'][number],
      ],
    }
    const target: ConfigSnapshot = {
      ...base,
      label: 'B',
      apexService: 'SWITCHBOARD',
      services: [
        { ...base.services[0], config: { ...base.services[0].config!, serviceCommand: 'x' } },
      ],
    }
    expect(restorePlan(base, target).lines).toEqual([
      'Name: A → B',
      'Settings of Agent: bot',
      'Service on the bare domain: Connect → Switchboard',
    ])
  })

  it('treats the live state the same as the folded history', () => {
    const state = {
      owner: null,
      label: 'Staging',
      genericSubdomain: 'blue-fox',
      genericBaseDomain: 'vetra.io',
      customDomain: null,
      defaultPackageRegistry: null,
      status: 'READY',
      apexService: null,
      services: [
        {
          type: 'CONNECT',
          prefix: 'connect',
          enabled: true,
          url: null,
          status: 'ACTIVE',
          version: null,
          config: null,
          selectedRessource: 'VETRA_AGENT_S',
        },
        {
          type: 'SWITCHBOARD',
          prefix: 'switchboard',
          enabled: true,
          url: null,
          status: 'ACTIVE',
          version: null,
          config: null,
          selectedRessource: 'VETRA_AGENT_S',
        },
      ],
      packages: [{ registry: '', name: '@acme/base', version: '1.0.0' }],
    } as unknown as CloudEnvironmentState
    expect(sameConfig(snapshotFromState(state), v1.config)).toBe(true)
  })
})

describe('applyRestorePlan', () => {
  const actions = () =>
    ({
      setLabel: vi.fn(() => Promise.resolve()),
      setGenericSubdomain: vi.fn(() => Promise.resolve()),
      enableService: vi.fn(() => Promise.resolve()),
      disableService: vi.fn(() => Promise.resolve()),
      setServiceSize: vi.fn(() => Promise.resolve()),
      setServiceConfig: vi.fn(() => Promise.resolve()),
      addPackage: vi.fn(() => Promise.resolve()),
      removePackage: vi.fn(() => Promise.resolve()),
      setPackageVersion: vi.fn(() => Promise.resolve()),
      setCustomDomain: vi.fn(() => Promise.resolve()),
    }) satisfies RestoreActions

  it('calls the detail-hook methods in order', async () => {
    const [, v2, v1] = deployedVersions(history())
    const a = actions()
    await applyRestorePlan(restorePlan(v2.config, v1.config).steps, a)
    expect(a.removePackage).toHaveBeenCalledWith('@acme/crm')
    expect(a.setServiceSize).toHaveBeenCalledWith('switchboard', 'VETRA_AGENT_S')
    expect(a.setPackageVersion).toHaveBeenCalledWith('@acme/base', '1.0.0')
  })

  it('stops at the first failure and reports progress', async () => {
    const [, v2, v1] = deployedVersions(history())
    const a = actions()
    a.setServiceSize.mockImplementation(() => Promise.reject(new Error('nope')))
    await expect(
      applyRestorePlan(restorePlan(v2.config, v1.config).steps, a),
    ).rejects.toMatchObject({ message: 'nope', done: 1 })
    expect(a.setPackageVersion).not.toHaveBeenCalled()
  })
})
