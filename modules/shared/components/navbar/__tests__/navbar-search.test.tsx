import { describe, it, expect, vi, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'

let pathname = '/user'
let user: object | undefined = { address: '0xabc' }

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@powerhousedao/reactor-browser', () => ({
  useRenownAuth: () => ({ user }),
}))
vi.mock('@/modules/shared/state/use-prefetch-on-intent', () => ({
  usePrefetchOnIntent: () => ({}),
}))
vi.mock('../components/navbar-right-side', () => ({ default: () => null }))
vi.mock('@/modules/shared/components/command-palette/console-search', () => ({
  ConsoleSearch: () => <div data-testid="console-search" />,
}))

import Navbar from '../navbar'

describe('navbar console search', () => {
  afterEach(cleanup)

  it('shows the search on console routes when signed in', () => {
    pathname = '/user/environments'
    user = { address: '0xabc' }
    render(<Navbar />)
    expect(screen.getByTestId('console-search')).toBeTruthy()
  })

  it('leaves the search alone in the console header (no Apps directory link)', () => {
    pathname = '/user/environments'
    user = { address: '0xabc' }
    render(<Navbar />)
    expect(document.querySelector('a[href="/apps"]')).toBeNull()
  })

  it('is not rendered on public routes', () => {
    pathname = '/studio'
    user = { address: '0xabc' }
    render(<Navbar />)
    expect(screen.queryByTestId('console-search')).toBeNull()
  })

  it('is not rendered when signed out', () => {
    pathname = '/user'
    user = undefined
    render(<Navbar />)
    expect(screen.queryByTestId('console-search')).toBeNull()
  })
})
