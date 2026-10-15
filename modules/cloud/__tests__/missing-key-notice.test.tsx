import { describe, it, expect, vi } from 'vitest'

vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

import { toast } from 'sonner'
import { showMissingKeyNotice } from '@/modules/cloud/studio/missing-key-notice'

describe('showMissingKeyNotice', () => {
  it('warns with the add-key instructions and an action that opens the environment', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { assign })
    showMissingKeyNotice('env-42')
    const [msg, opts] = vi.mocked(toast.warning).mock.calls[0]
    expect(msg).toMatch(/without a Claude key.*ANTHROPIC_API_KEY/)
    const action = (opts as { action: { label: string; onClick: () => void } }).action
    expect(action.label).toBe('Open environment')
    action.onClick()
    expect(assign).toHaveBeenCalledWith('/user/environments/env-42')
    vi.unstubAllGlobals()
  })
})
