import { describe, expect, it } from 'vitest'
import {
  directoryView,
  hiddenReason,
  majorOf,
  plainDescription,
  toDirectoryEntry,
  type DirectoryEntry,
} from '../directory'

const NOW = Date.parse('2026-10-29T00:00:00Z')

const entry = (over: Partial<DirectoryEntry> = {}): DirectoryEntry => ({
  name: 'pkg',
  title: 'pkg',
  description: null,
  category: null,
  publisher: null,
  version: '1.0.0',
  releasedAt: '2026-10-01T00:00:00Z',
  createdAt: '2026-01-01T00:00:00Z',
  modules: {},
  deprecated: false,
  platformMajor: 6,
  recommended: false,
  ...over,
})

describe('hiddenReason', () => {
  it('lists maintained packages on the current platform', () => {
    expect(hiddenReason(entry(), NOW)).toBeNull()
  })

  it('hides deprecated, old-platform and stale packages', () => {
    expect(hiddenReason(entry({ deprecated: true }), NOW)).toBe('deprecated')
    expect(hiddenReason(entry({ platformMajor: 5 }), NOW)).toBe('old-platform')
    expect(hiddenReason(entry({ releasedAt: '2025-09-01T00:00:00Z' }), NOW)).toBe('stale')
  })

  it('keeps packages whose platform is unknown', () => {
    expect(hiddenReason(entry({ platformMajor: null }), NOW)).toBeNull()
  })
})

describe('plainDescription', () => {
  it('drops markdown emphasis and keeps link text', () => {
    expect(plainDescription('The **Reactor package** behind [Vetra CLI](../README.md).')).toBe(
      'The Reactor package behind Vetra CLI.',
    )
  })

  it('treats the generator template text as no description', () => {
    expect(plainDescription('This Document Model Boilerplate provides code generation…')).toBe(null)
    expect(plainDescription('')).toBeNull()
  })
})

describe('majorOf', () => {
  it('reads the major from exact versions and ranges', () => {
    expect(majorOf('6.2.2-dev.47')).toBe(6)
    expect(majorOf('^5.0.0')).toBe(5)
    expect(majorOf('~4.1')).toBe(4)
    expect(majorOf(undefined)).toBeNull()
    expect(majorOf('latest')).toBeNull()
  })
})

describe('directoryView', () => {
  const list = [
    entry({ name: 'old', releasedAt: '2026-05-01T00:00:00Z', createdAt: '2026-09-01T00:00:00Z' }),
    entry({ name: 'fresh', releasedAt: '2026-10-20T00:00:00Z', recommended: true }),
    entry({ name: 'gone', deprecated: true }),
  ]

  it('sorts by latest release and counts what it hides', () => {
    const view = directoryView(list, { tab: 'updated', query: '', showHidden: false }, NOW)
    expect(view.entries.map((e) => e.name)).toEqual(['fresh', 'old'])
    expect(view.hiddenCount).toBe(1)
  })

  it('sorts the New tab by first publish', () => {
    const view = directoryView(list, { tab: 'new', query: '', showHidden: false }, NOW)
    expect(view.entries.map((e) => e.name)).toEqual(['old', 'fresh'])
  })

  it('limits Recommended to the curated list', () => {
    const view = directoryView(list, { tab: 'recommended', query: '', showHidden: false }, NOW)
    expect(view.entries.map((e) => e.name)).toEqual(['fresh'])
  })

  it('shows hidden packages on request and searches every text field', () => {
    expect(
      directoryView(list, { tab: 'updated', query: '', showHidden: true }, NOW).entries,
    ).toHaveLength(3)
    expect(
      directoryView(list, { tab: 'updated', query: 'GON', showHidden: true }, NOW).entries,
    ).toHaveLength(1)
  })
})

describe('toDirectoryEntry', () => {
  it('reads dates, modules and platform from the registry data', () => {
    const e = toDirectoryEntry(
      {
        name: 'Knowledge Note',
        path: '/-/cdn/@powerhousedao/knowledge-note',
        documentTypes: [],
        manifest: {
          name: 'Knowledge Note',
          description: 'Notes',
          category: 'Productivity',
          publisher: { name: 'Powerhouse', url: '' },
          documentModels: [{}, {}],
          editors: [{}],
          apps: [],
          subgraphs: [],
          processors: [],
        } as never,
      },
      {
        name: '@powerhousedao/knowledge-note',
        'dist-tags': { latest: '1.0.52' },
        versions: {
          '1.0.52': {
            name: '@powerhousedao/knowledge-note',
            version: '1.0.52',
            peerDependencies: { 'document-model': '6.2.2-dev.47' },
          },
        },
        time: { created: '2026-03-27T00:00:00Z', '1.0.52': '2026-10-27T00:00:00Z' },
      },
    )
    expect(e).toMatchObject({
      name: '@powerhousedao/knowledge-note',
      version: '1.0.52',
      releasedAt: '2026-10-27T00:00:00Z',
      createdAt: '2026-03-27T00:00:00Z',
      modules: { documentModels: 2, editors: 1 },
      platformMajor: 6,
      publisher: 'Powerhouse',
    })
  })
})
