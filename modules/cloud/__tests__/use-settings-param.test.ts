import { describe, expect, it } from 'vitest'
import { parseSettingsTab } from '../hooks/use-settings-param'

describe('parseSettingsTab', () => {
  it('opens the named settings tab', () => {
    expect(parseSettingsTab('domain')).toBe('domain')
    expect(parseSettingsTab('updates')).toBe('updates')
    expect(parseSettingsTab('activity')).toBe('activity')
    expect(parseSettingsTab('metadata')).toBe('metadata')
  })

  it('keeps the old hand-over link working', () => {
    expect(parseSettingsTab('organisation')).toBe('metadata')
  })

  it('keeps settings closed without a known tab', () => {
    expect(parseSettingsTab(null)).toBeNull()
    expect(parseSettingsTab('billing')).toBeNull()
  })
})
