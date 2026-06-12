export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isValidSlug(slug: string): boolean {
  if (slug.length < 3 || slug.length > 40) return false
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

export function isValidEthAddress(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr)
}

export function isValidUrl(url: string): boolean {
  if (url === '') return true
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
