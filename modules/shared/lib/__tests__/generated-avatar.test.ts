import { describe, expect, it } from 'vitest'
import { generatedAvatar } from '../generated-avatar'

const rows = (cells: boolean[]) =>
  [0, 1, 2, 3, 4].map((r) =>
    cells
      .slice(r * 5, r * 5 + 5)
      .map((c) => (c ? '1' : '0'))
      .join(''),
  )

describe('generatedAvatar', () => {
  it("draws exactly what renown.id shows for a profile without a picture (Frank's, read off renown.id)", () => {
    const { color, cells } = generatedAvatar('0x2bbea0145d6fb9c6709a74c1179ca0be71bb3ac6')
    expect(color).toBe('hsl(338 70% 55%)')
    expect(rows(cells)).toStrictEqual(['01010', '10001', '00100', '01110', '11111'])
  })

  it('ignores case, as renown.id does, and is mirrored left to right', () => {
    const lower = generatedAvatar('0xabcdef0000000000000000000000000000000001')
    const upper = generatedAvatar('0xABCDEF0000000000000000000000000000000001')
    expect(upper).toStrictEqual(lower)
    for (const row of rows(lower.cells)) expect(row).toBe([...row].reverse().join(''))
  })
})
