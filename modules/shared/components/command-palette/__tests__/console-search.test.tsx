import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import React from 'react'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/user',
  useRouter: () => ({ push }),
}))
vi.mock('@/modules/cloud/hooks/use-environment', () => ({
  useViewer: () => ({ viewer: { address: '0xabc' } }),
  useEnvironments: () => ({
    environments: [
      { id: 'env-1', name: 'Sektar', state: { genericSubdomain: 'fair-bull-b6t7wwqr' } },
    ],
  }),
}))
vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useMyApps: () => ({ data: [{ id: 'app-1', name: 'Achra', slug: 'achra' }] }),
  useStandaloneEnvFilter: () => ({ isStandalone: () => true }),
}))
vi.mock('@/modules/orgs/hooks/use-orgs', () => ({
  useActiveOrg: () => ({ orgId: null }),
}))

import { ConsoleSearch } from '../console-search'

function setDesktop(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const searchBox = () => screen.getByRole('combobox', { name: 'Search the console' })

describe('ConsoleSearch (desktop)', () => {
  beforeEach(() => {
    setDesktop(true)
    push.mockClear()
  })
  afterEach(cleanup)

  it('keeps the results unmounted until the input is focused, then opens the dropdown', () => {
    render(<ConsoleSearch />)
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.focus(searchBox())
    expect(screen.getByRole('listbox')).toBeTruthy()
    expect(screen.getByText('New environment')).toBeTruthy()
    expect(screen.getByText('Sektar')).toBeTruthy()
    expect(screen.getByText('fair-bull-b6t7wwqr')).toBeTruthy()
  })

  it('filters the results as you type', () => {
    render(<ConsoleSearch />)
    fireEvent.change(searchBox(), { target: { value: 'achra' } })
    const list = screen.getByRole('listbox')
    expect(within(list).getByText('Achra')).toBeTruthy()
    expect(within(list).queryByText('Sektar')).toBeNull()
    expect(within(list).queryByText('New environment')).toBeNull()
  })

  it('shows an empty state when nothing matches', () => {
    render(<ConsoleSearch />)
    fireEvent.change(searchBox(), { target: { value: 'zzzz' } })
    expect(screen.getByText(/Nothing matches/)).toBeTruthy()
  })

  it('navigates to the selected result on Enter, then closes and clears', () => {
    render(<ConsoleSearch />)
    const input = searchBox() as HTMLInputElement
    fireEvent.change(input, { target: { value: 'sektar' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(push).toHaveBeenCalledWith('/user/environments/env-1')
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input.value).toBe('')
  })

  it('closes, clears and blurs on Escape', () => {
    render(<ConsoleSearch />)
    const input = searchBox() as HTMLInputElement
    input.focus()
    fireEvent.change(input, { target: { value: 'sektar' } })
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input.value).toBe('')
    expect(document.activeElement).not.toBe(input)
  })

  it('closes when clicking outside', () => {
    render(<ConsoleSearch />)
    fireEvent.focus(searchBox())
    expect(screen.getByRole('listbox')).toBeTruthy()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('focuses the input and opens the dropdown on ⌘K / Ctrl+K', () => {
    render(<ConsoleSearch />)
    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
    })
    expect(document.activeElement).toBe(searchBox())
    expect(screen.getByRole('listbox')).toBeTruthy()
  })

  it('shows the keyboard hint', () => {
    render(<ConsoleSearch />)
    expect(screen.getByText(/⌘K|Ctrl K/)).toBeTruthy()
  })
})

describe('ConsoleSearch (mobile)', () => {
  beforeEach(() => {
    setDesktop(false)
    push.mockClear()
  })
  afterEach(cleanup)

  it('opens a full-screen sheet from the search icon, with results and a close button', () => {
    render(<ConsoleSearch />)
    fireEvent.click(screen.getByRole('button', { name: 'Search the console' }))
    const sheet = screen.getByRole('dialog')
    expect(within(sheet).getByRole('combobox')).toBeTruthy()
    expect(within(sheet).getByText('Sektar')).toBeTruthy()
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close search' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the sheet on Escape and starts empty next time', () => {
    render(<ConsoleSearch />)
    const trigger = screen.getByRole('button', { name: 'Search the console' })
    fireEvent.click(trigger)
    const input = within(screen.getByRole('dialog')).getByRole('combobox')
    fireEvent.change(input, { target: { value: 'achra' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(trigger)
    const reopened = within(screen.getByRole('dialog')).getByRole<HTMLInputElement>('combobox')
    expect(reopened.value).toBe('')
  })

  it('opens the sheet on ⌘K on a small screen', () => {
    render(<ConsoleSearch />)
    act(() => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('navigates from the sheet and closes it', () => {
    render(<ConsoleSearch />)
    fireEvent.click(screen.getByRole('button', { name: 'Search the console' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Achra'))
    expect(push).toHaveBeenCalledWith('/user/apps/app-1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
