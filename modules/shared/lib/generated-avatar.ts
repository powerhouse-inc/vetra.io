/** FNV-1a (32-bit) over the lower-cased seed's code points. */
function fnv1a(seed: string): number {
  let h = 0x811c9dc5
  for (const ch of seed.toLowerCase()) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/**
 * renown.id's avatar for a profile without a picture, so both sites draw the same one: a 5×5
 * grid mirrored left to right, one colour, all from the hash of the seed (a person's address,
 * an app's DID). `cells` is row by row.
 */
export function generatedAvatar(seed: string): { color: string; cells: boolean[] } {
  const h = fnv1a(seed)
  const cells: boolean[] = []
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const bit = 3 * row + (col < 3 ? col : 4 - col)
      cells.push(((h >>> bit) & 1) === 1)
    }
  }
  return { color: `hsl(${h % 360} 70% 55%)`, cells }
}
