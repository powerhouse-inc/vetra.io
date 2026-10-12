import { expect } from 'vitest'

/** Bracketed tokens like [PRICE] or [N] are design placeholders and must never ship. */
export function expectNoPlaceholders(text: string) {
  expect(text).not.toMatch(/\[[A-Z][A-Z ]*\]/)
}

/** Vetra Cloud's operations are closed; only the platform and generated packages are open. */
export function expectNoOpenCloudClaim(text: string) {
  expect(text.toLowerCase()).not.toContain('open source end to end')
  expect(text.toLowerCase()).not.toContain('built only from open parts')
  expect(text.toLowerCase()).not.toContain('run the same stack yourself')
}
