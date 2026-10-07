import { describe, expect, it } from 'vitest'

import { diffSettings } from '@/modules/apps/components/app-settings'
import { defaultAppName } from '@/modules/apps/components/new-app-wizard'
import { filterRepos } from '@/modules/apps/components/repo-picker'
import type { App, GithubRepo } from '@/modules/apps/types'

const repo = (fullName: string): GithubRepo => ({
  id: fullName,
  fullName,
  private: false,
  defaultBranch: 'main',
})

const app = {
  name: 'Achra',
  productionBranch: 'main',
  previewsEnabled: true,
  previewLimit: 5,
  previewTtlDays: 7,
} as App

const form = {
  name: 'Achra',
  productionBranch: 'main',
  previewsEnabled: true,
  previewLimit: '5',
  previewTtlDays: '7',
}

describe('new-app helpers', () => {
  it('defaults the app name to the repo name', () => {
    expect(defaultAppName('powerhouse-inc/achra')).toBe('achra')
    expect(defaultAppName('solo')).toBe('solo')
  })

  it('filters repositories case-insensitively', () => {
    const repos = [repo('powerhouse-inc/achra'), repo('powerhouse-inc/vetra.io'), repo('me/Notes')]
    expect(filterRepos(repos, 'VETRA').map((r) => r.fullName)).toEqual(['powerhouse-inc/vetra.io'])
    expect(filterRepos(repos, 'notes')).toHaveLength(1)
    expect(filterRepos(repos, '  ')).toHaveLength(3)
  })
})

describe('diffSettings', () => {
  it('returns an empty patch when nothing changed', () => {
    expect(diffSettings(app, form)).toEqual({})
  })

  it('returns only changed fields, trimmed and typed', () => {
    expect(
      diffSettings(app, { ...form, name: ' Achra 2 ', previewLimit: '3', previewsEnabled: false }),
    ).toEqual({ name: 'Achra 2', previewLimit: 3, previewsEnabled: false })
  })

  it('rejects invalid input', () => {
    expect(diffSettings(app, { ...form, name: ' ' })).toBeNull()
    expect(diffSettings(app, { ...form, previewLimit: '0' })).toBeNull()
    expect(diffSettings(app, { ...form, previewTtlDays: '2.5' })).toBeNull()
    expect(diffSettings(app, { ...form, previewTtlDays: '365' })).toBeNull()
    expect(diffSettings(app, { ...form, previewLimit: '21' })).toBeNull()
    expect(diffSettings(app, { ...form, previewTtlDays: '91' })).toBeNull()
  })

  it('matches the backend bounds (previews 1-20, TTL 1-90 days, name 1-100 chars)', () => {
    expect(diffSettings(app, { ...form, previewLimit: '20', previewTtlDays: '90' })).toEqual({
      previewLimit: 20,
      previewTtlDays: 90,
    })
    expect(diffSettings(app, { ...form, name: 'x'.repeat(100) })).toEqual({ name: 'x'.repeat(100) })
    expect(diffSettings(app, { ...form, name: 'x'.repeat(101) })).toBeNull()
  })
})
