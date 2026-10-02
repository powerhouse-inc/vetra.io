import { beforeEach, describe, expect, it } from 'vitest'

import {
  GITHUB_STATE_KEY,
  consumeGithubState,
  createGithubState,
  withGithubState,
} from '@/modules/apps/lib/github-state'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string) {
    return this.map.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.map.set(k, v)
  }
  removeItem(k: string) {
    this.map.delete(k)
  }
}

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
})

describe('GitHub OAuth state', () => {
  it('creates a random nonce and stores it', () => {
    const a = createGithubState(storage)
    expect(a).toMatch(/^[0-9a-f]{32}$/)
    expect(storage.getItem(GITHUB_STATE_KEY)).toBe(a)
    expect(createGithubState(storage)).not.toBe(a)
  })

  it('appends state to the GitHub URL, keeping existing params', () => {
    const url = withGithubState('https://github.com/apps/vetra-deploy/installations/new?x=1', 'abc')
    const parsed = new URL(url)
    expect(parsed.searchParams.get('state')).toBe('abc')
    expect(parsed.searchParams.get('x')).toBe('1')
    expect(
      new URL(
        withGithubState('https://github.com/login/oauth/authorize?state=old', 'n'),
      ).searchParams.getAll('state'),
    ).toEqual(['n'])
  })

  it('accepts the matching state exactly once', () => {
    const nonce = createGithubState(storage)
    expect(consumeGithubState(storage, nonce)).toBe(true)
    expect(storage.getItem(GITHUB_STATE_KEY)).toBeNull()
    expect(consumeGithubState(storage, nonce)).toBe(false)
  })

  it('rejects a missing, foreign or empty state', () => {
    expect(consumeGithubState(storage, 'anything')).toBe(false)
    createGithubState(storage)
    expect(consumeGithubState(storage, 'attacker')).toBe(false)
    // A failed attempt also burns the nonce: no retries against it.
    expect(storage.getItem(GITHUB_STATE_KEY)).toBeNull()
    createGithubState(storage)
    expect(consumeGithubState(storage, null)).toBe(false)
    expect(consumeGithubState(storage, '')).toBe(false)
  })
})
