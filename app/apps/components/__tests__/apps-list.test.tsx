import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { AppsList } from '../apps-list'
import type { DirectoryApp } from '../../lib/directory'

const entry = (over: Partial<DirectoryApp>): DirectoryApp => ({
  appId: 'a',
  appDid: null,
  name: 'App',
  holders: 0,
  plans: 1,
  tagline: null,
  category: null,
  logoUrl: null,
  pageUrl: null,
  ...over,
})

describe('AppsList', () => {
  it('lists apps in the order given, with their holders and plans', () => {
    render(
      <AppsList
        apps={[
          entry({ appId: 'studio', name: 'Vetra Studio', holders: 36, plans: 1 }),
          entry({ appId: 'sektar', name: 'Sektar Cloud', holders: 1, plans: 2 }),
        ]}
      />,
    )
    const items = screen.getAllByRole('listitem')
    expect(within(items[0]).getByText('Vetra Studio')).toBeTruthy()
    expect(within(items[0]).getByText('36 holders')).toBeTruthy()
    expect(within(items[0]).getByText('1 plan')).toBeTruthy()
    expect(within(items[1]).getByText('1 holder')).toBeTruthy()
    expect(within(items[1]).getByText('2 plans')).toBeTruthy()
  })

  it('links an app to its Renown page only when it has one, and shows its profile', () => {
    render(
      <AppsList
        apps={[
          entry({
            appId: 'sektar',
            name: 'Sektar Cloud',
            tagline: 'Budgets for DAOs',
            category: 'Productivity',
            pageUrl: 'https://www.renown.id/app/did:key:sektar',
          }),
          entry({ appId: 'studio', name: 'Vetra Studio' }),
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: /Sektar Cloud/ }).getAttribute('href')).toBe(
      'https://www.renown.id/app/did:key:sektar',
    )
    expect(screen.getByText('Budgets for DAOs')).toBeTruthy()
    expect(screen.getByText('Productivity')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Vetra Studio/ })).toBeNull()
  })

  it('says so when there is nothing to list', () => {
    render(<AppsList apps={[]} />)
    expect(screen.getByText('No apps here yet.')).toBeTruthy()
  })
})
