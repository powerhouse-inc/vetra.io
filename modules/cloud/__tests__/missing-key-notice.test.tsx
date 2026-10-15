import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

import { toast } from 'sonner'
import { showMissingKeyNotice } from '@/modules/cloud/studio/missing-key-notice'

describe('showMissingKeyNotice', () => {
  it('warns with the add-key instructions and links to the environment', () => {
    showMissingKeyNotice('env-42')
    const [msg, opts] = vi.mocked(toast.warning).mock.calls[0]
    expect(msg).toMatch(/without a Claude key.*ANTHROPIC_API_KEY/)
    const { container } = render(<>{(opts as { description: React.ReactNode }).description}</>)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/user/environments/env-42')
  })
})
