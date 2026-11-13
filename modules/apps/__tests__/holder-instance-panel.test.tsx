import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { HolderInstance, HolderSettings } from '../types'

let settings: HolderSettings
const setSetting = vi.fn()
const deleteSetting = vi.fn()
const setDomain = vi.fn()
const removeDomain = vi.fn()
const mutation = (mutate: ReturnType<typeof vi.fn>) => ({
  mutate,
  reset: vi.fn(),
  isPending: false,
  error: null,
})

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-apps', () => ({
  useMyInstanceSettings: () => ({ data: settings, isPending: false, error: null }),
  useHolderInstanceMutations: () => ({
    setSetting: mutation(setSetting),
    deleteSetting: mutation(deleteSetting),
    setDomain: mutation(setDomain),
    removeDomain: mutation(removeDomain),
  }),
}))

import { HolderInstancePanel } from '../components/holder-instance-panel'

const instance = (over: Partial<HolderInstance> = {}) =>
  ({ instanceId: 'i1', access: 'own', ...over }) as HolderInstance

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  settings = {
    settings: [
      { name: 'API_URL', kind: 'PLAIN', value: 'https://x', mountPath: null, updatedAt: 'x' },
      { name: 'TOKEN', kind: 'SECRET', value: null, mountPath: null, updatedAt: 'x' },
    ],
    vetra: [],
    publisherNames: ['API_URL'],
    reservedNames: ['ADMINS'],
    reservedPrefixes: ['VETRA_'],
  }
})

describe('HolderInstancePanel settings', () => {
  it('shows plain values, never secret ones, and flags a name that replaces the app own', () => {
    render(<HolderInstancePanel instance={instance()} />)
    const plain = screen.getByTestId('holder-setting-API_URL')
    expect(plain.textContent).toContain('https://x')
    expect(plain.textContent).toContain("replaces the app's own value")
    const secret = screen.getByTestId('holder-setting-TOKEN')
    expect(within(secret).getByRole('button', { name: 'Replace' })).toBeTruthy()
    expect(within(plain).queryByRole('button', { name: 'Replace' })).toBeNull()
  })

  it('refuses reserved names and saves a valid secret', () => {
    render(<HolderInstancePanel instance={instance()} />)
    const save = screen.getByRole('button', { name: 'Save setting' }) as HTMLButtonElement
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'vetra_x' } })
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'v' } })
    expect(screen.getByText(/starting with VETRA_/)).toBeTruthy()
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'SECRET' } })
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'MY_KEY' } })
    expect(save.disabled).toBe(false)
    fireEvent.click(save)
    expect(setSetting).toHaveBeenCalledWith(
      { kind: 'SECRET', value: 'v', name: 'MY_KEY' },
      expect.anything(),
    )
  })

  it('needs an absolute mount path for a file', () => {
    render(<HolderInstancePanel instance={instance()} />)
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'FILE' } })
    fireEvent.change(screen.getByLabelText('File contents'), { target: { value: '{}' } })
    const save = screen.getByRole('button', { name: 'Save setting' }) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Mount path'), { target: { value: '/etc/app/c.json' } })
    expect(save.disabled).toBe(false)
  })
})

describe('HolderInstancePanel domain', () => {
  it('sets a valid domain', () => {
    render(<HolderInstancePanel instance={instance()} />)
    const button = screen.getByRole('button', { name: 'Use this domain' }) as HTMLButtonElement
    fireEvent.change(screen.getByPlaceholderText('notes.example.com'), {
      target: { value: 'nope' },
    })
    expect(button.disabled).toBe(true)
    fireEvent.change(screen.getByPlaceholderText('notes.example.com'), {
      target: { value: 'Notes.Example.com' },
    })
    fireEvent.click(button)
    expect(setDomain).toHaveBeenCalledWith('notes.example.com', expect.anything())
  })

  it('shows the TXT and A records to create while DNS is pending, with the warning', () => {
    render(
      <HolderInstancePanel
        instance={instance({
          customDomain: {
            domain: 'notes.example.com',
            status: 'DNS',
            reason: null,
            since: null,
            records: [
              { type: 'TXT', host: '_vetra-verify.notes.example.com', value: 'vetra-verify=abc' },
              { type: 'A', host: 'notes.example.com', value: '203.0.113.7' },
            ],
            alternative: { type: 'CNAME', host: 'notes.example.com', value: 'x.vetra.io' },
          },
        })}
      />,
    )
    expect(screen.getByTestId('dns-TXT').textContent).toContain('_vetra-verify.notes.example.com')
    expect(screen.getByTestId('dns-A').textContent).toContain('203.0.113.7')
    expect(screen.getByText('Waiting for DNS')).toBeTruthy()
    expect(screen.getByText(/generated address stops working/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Remove domain' }))
    expect(removeDomain).toHaveBeenCalled()
  })

  it('shows why a domain failed', () => {
    render(
      <HolderInstancePanel
        instance={instance({
          customDomain: {
            domain: 'a.example.com',
            status: 'FAILED',
            reason: 'TXT record missing',
            since: null,
            records: [],
            alternative: null,
          },
        })}
      />,
    )
    expect(screen.getByRole('alert').textContent).toContain('TXT record missing')
  })
})
