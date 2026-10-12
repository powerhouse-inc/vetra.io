import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// /builders is retired (redirects home), so profile and team flows must not send people there.
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sourceFiles(full)
    return /\.tsx?$/.test(name) ? [full] : []
  })
}

describe('profile and team flows', () => {
  it('never link to the retired /builders pages', () => {
    const offenders = sourceFiles(path.join(process.cwd(), 'app/profile')).filter((f) =>
      /['"`]\/builders/.test(readFileSync(f, 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
