import { afterEach, describe, expect, it, vi } from 'vitest'
import { track } from '../track'

// OpenPanel types `window.op` as always present; at runtime it only exists once its script loaded.
const win = window as unknown as { op?: (...args: unknown[]) => void }

describe('track', () => {
  afterEach(() => {
    delete win.op
  })

  it('sends the event and its properties to OpenPanel', () => {
    const op = vi.fn()
    win.op = op
    track('package_installed', { environmentId: 'env-1', packageName: '@acme/crm' })
    expect(op).toHaveBeenCalledWith('track', 'package_installed', {
      environmentId: 'env-1',
      packageName: '@acme/crm',
    })
  })

  it('sends events without properties', () => {
    const op = vi.fn()
    win.op = op
    track('signed_in')
    expect(op).toHaveBeenCalledWith('track', 'signed_in', undefined)
  })

  it('does nothing when OpenPanel is not loaded', () => {
    expect(() => track('signed_in')).not.toThrow()
  })

  it('swallows errors from the analytics script', () => {
    win.op = () => {
      throw new Error('blocked by an ad blocker')
    }
    expect(() => track('env_created', { environmentId: 'env-1' })).not.toThrow()
  })
})
