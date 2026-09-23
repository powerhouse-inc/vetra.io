import { describe, expect, it } from 'vitest'
import {
  connectWorkflowsEnabled,
  reactorWorkflowsEnabled,
  readsAsEnabled,
  withWorkflowsEnabled,
} from '@/modules/cloud/lib/workflows'

describe('readsAsEnabled', () => {
  // Switchboard's OpenFeature client casts only "true"/"false", with "1"/"0"
  // answered before it — everything else means "not set", not "on".
  it.each(['true', ' true ', '1'])('reads %j as on', (raw) => {
    expect(readsAsEnabled(raw)).toBe(true)
  })

  it.each(['false', '0', 'yes', 'TRUE', '', undefined, null])('reads %j as off', (raw) => {
    expect(readsAsEnabled(raw)).toBe(false)
  })
})

describe('reactorWorkflowsEnabled', () => {
  it('finds the var among others', () => {
    expect(
      reactorWorkflowsEnabled([
        { key: 'OTHER', value: 'true' },
        { key: 'PH_WORKFLOWS_ENABLED', value: 'true' },
      ]),
    ).toBe(true)
  })

  it('is off when the var is absent', () => {
    expect(reactorWorkflowsEnabled([{ key: 'OTHER', value: 'true' }])).toBe(false)
  })
})

describe('connectWorkflowsEnabled', () => {
  it('reads the nested flag', () => {
    expect(connectWorkflowsEnabled({ connect: { app: { workflowsEnabled: true } } })).toBe(true)
  })

  it('is off for null, a missing app, or a non-object app', () => {
    expect(connectWorkflowsEnabled(null)).toBe(false)
    expect(connectWorkflowsEnabled({ connect: {} })).toBe(false)
    expect(connectWorkflowsEnabled({ connect: { app: 'nope' } })).toBe(false)
    expect(connectWorkflowsEnabled({ connect: { app: ['nope'] } })).toBe(false)
  })

  it('is off for a truthy non-true value', () => {
    expect(connectWorkflowsEnabled({ connect: { app: { workflowsEnabled: 'yes' } } })).toBe(false)
  })
})

describe('withWorkflowsEnabled', () => {
  it('sets the flag on an empty config', () => {
    expect(withWorkflowsEnabled(null, true)).toEqual({
      connect: { app: { workflowsEnabled: true } },
    })
  })

  it('preserves sibling connect subtrees and packageRegistryUrl', () => {
    const next = withWorkflowsEnabled(
      {
        connect: { branding: { appName: 'Acme' }, app: { logLevel: 'debug' } },
        packageRegistryUrl: 'https://registry.example',
      },
      true,
    )
    expect(next).toEqual({
      packageRegistryUrl: 'https://registry.example',
      connect: {
        branding: { appName: 'Acme' },
        app: { logLevel: 'debug', workflowsEnabled: true },
      },
    })
  })

  // Writing `false` would be a trivial override the runtime-config form strips
  // on its next save, so disabling deletes the key instead.
  it('deletes the key when disabling rather than writing false', () => {
    const next = withWorkflowsEnabled(
      { connect: { app: { logLevel: 'debug', workflowsEnabled: true } } },
      false,
    )
    expect(next).toEqual({ connect: { app: { logLevel: 'debug' } } })
  })

  it('drops app and connect once they are empty', () => {
    expect(withWorkflowsEnabled({ connect: { app: { workflowsEnabled: true } } }, false)).toEqual(
      {},
    )
  })

  it('keeps packageRegistryUrl when connect empties out', () => {
    expect(
      withWorkflowsEnabled(
        { connect: { app: { workflowsEnabled: true } }, packageRegistryUrl: 'https://r.example' },
        false,
      ),
    ).toEqual({ packageRegistryUrl: 'https://r.example' })
  })

  it('does not mutate the input', () => {
    const input = { connect: { app: { logLevel: 'debug' } } }
    withWorkflowsEnabled(input, true)
    expect(input).toEqual({ connect: { app: { logLevel: 'debug' } } })
  })
})
