import { describe, expect, it } from 'vitest'
import { buildEnvTopology, statusTone } from '@/modules/cloud/lib/env-topology'
import type { CloudEnvironmentService, CloudPackage } from '@/modules/cloud/types'

function svc(
  type: CloudEnvironmentService['type'],
  prefix: string,
  overrides: Partial<CloudEnvironmentService> = {},
): CloudEnvironmentService {
  return {
    type,
    prefix,
    enabled: true,
    url: null,
    status: 'ACTIVE',
    version: null,
    selectedRessource: null,
    ...overrides,
  }
}

const pkgs: CloudPackage[] = [
  { registry: 'https://r', name: '@acme/invoices', version: '1.0.0' },
  { registry: 'https://r', name: '@acme/crm', version: null },
]

describe('statusTone', () => {
  it('matches the overview StatusDot mapping', () => {
    expect(statusTone('ACTIVE')).toBe('success')
    expect(statusTone('READY')).toBe('success')
    expect(statusTone('DEPLOYING')).toBe('warning')
    expect(statusTone('PROVISIONING')).toBe('info')
    expect(statusTone('SUSPENDED')).toBe('destructive')
    expect(statusTone('BILLING_ISSUE')).toBe('destructive')
    expect(statusTone('WHATEVER')).toBe('muted')
    expect(statusTone(null)).toBe('muted')
  })
})

describe('buildEnvTopology', () => {
  it('lays out clients, switchboard with packages, and the database', () => {
    const t = buildEnvTopology({
      services: [
        svc('CLINT', 'rupert'),
        svc('SWITCHBOARD', 'switchboard'),
        svc('CONNECT', 'connect', { status: 'PROVISIONING' }),
        svc('FUSION', 'fusion'),
      ],
      packages: pkgs,
    })

    expect(t.nodes.map((n) => n.label)).toEqual([
      'Connect',
      'Fusion',
      'Agent: rupert',
      'Switchboard',
      'Database',
    ])
    expect(t.nodes.find((n) => n.kind === 'connect')?.tone).toBe('info')
    expect(t.nodes.find((n) => n.kind === 'agent')?.prefix).toBe('rupert')

    // Packages sit inside the Switchboard box.
    const hub = t.nodes.find((n) => n.kind === 'switchboard')!
    expect(t.packages.map((p) => p.name)).toEqual(['@acme/invoices', '@acme/crm'])
    for (const p of t.packages) {
      expect(p.x).toBeGreaterThan(hub.x)
      expect(p.x).toBeLessThan(hub.x + hub.width)
      expect(p.y).toBeGreaterThan(hub.y)
      expect(p.y).toBeLessThan(hub.y + hub.height)
    }

    // Database hangs below Switchboard.
    const db = t.nodes.find((n) => n.kind === 'database')!
    expect(db.y).toBeGreaterThan(hub.y + hub.height)

    expect(t.edges.map((e) => `${e.from}->${e.to}`)).toEqual([
      'CONNECT:connect->SWITCHBOARD:switchboard',
      'FUSION:fusion->SWITCHBOARD:switchboard',
      'CLINT:rupert->SWITCHBOARD:switchboard',
      'SWITCHBOARD:switchboard->database',
    ])

    // Everything fits inside the reported canvas.
    for (const n of t.nodes) {
      expect(n.x + n.width).toBeLessThanOrEqual(t.width)
      expect(n.y + n.height).toBeLessThanOrEqual(t.height)
      expect(n.y).toBeGreaterThanOrEqual(0)
    }
  })

  it('skips disabled services and services that are not part of the map', () => {
    const t = buildEnvTopology({
      services: [
        svc('SWITCHBOARD', 'switchboard'),
        svc('CONNECT', 'connect', { enabled: false }),
        svc('DOCLING', 'docling'),
      ],
      packages: [],
    })
    expect(t.nodes.map((n) => n.kind)).toEqual(['switchboard', 'database'])
    expect(t.edges).toHaveLength(1)
  })

  it('draws clients without edges when Switchboard is off', () => {
    const t = buildEnvTopology({
      services: [svc('CONNECT', 'connect'), svc('SWITCHBOARD', 'switchboard', { enabled: false })],
      packages: pkgs,
    })
    expect(t.nodes.map((n) => n.kind)).toEqual(['connect'])
    expect(t.packages).toEqual([])
    expect(t.edges).toEqual([])
    expect(t.width).toBeGreaterThan(0)
  })

  it('the database follows the Switchboard status', () => {
    const t = buildEnvTopology({
      services: [svc('SWITCHBOARD', 'switchboard', { status: 'SUSPENDED' })],
      packages: [],
    })
    expect(t.nodes.find((n) => n.kind === 'database')?.tone).toBe('destructive')
  })

  it('returns an empty map when nothing is enabled', () => {
    const t = buildEnvTopology({ services: [], packages: pkgs })
    expect(t.nodes).toEqual([])
    expect(t.width).toBe(0)
  })
})
