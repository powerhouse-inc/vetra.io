import { afterEach, describe, expect, it } from 'vitest'
import { defaultPackageRegistry, studioRegistry } from '@/modules/cloud/switchboard-url'

/*
  Every new environment (projects as well as studios) takes its package
  registry from the deployment: prod → registry.vetra.io, staging → dev. The
  project flow used to hardcode the dev registry, which put 25 prod tenants on
  it; its auto-heal even wrote the dev registry into prod environments.
*/

type WindowWithEnv = { __ENV?: Record<string, string> }

function setEnv(value: string | undefined) {
  const w = window as unknown as WindowWithEnv
  w.__ENV = value === undefined ? {} : { NEXT_PUBLIC_STUDIO_REGISTRY: value }
}

afterEach(() => {
  delete (window as unknown as WindowWithEnv).__ENV
})

describe('defaultPackageRegistry', () => {
  it("returns the deployment's registry when set (prod)", () => {
    setEnv('https://registry.vetra.io')
    expect(defaultPackageRegistry()).toBe('https://registry.vetra.io')
  })

  it('falls back to the dev registry when unset (staging, local)', () => {
    setEnv(undefined)
    expect(defaultPackageRegistry()).toBe('https://registry.dev.vetra.io')
  })

  it('is what studios use too', () => {
    setEnv('https://registry.vetra.io')
    expect(studioRegistry()).toBe(defaultPackageRegistry())
  })
})
