// Copied verbatim from vetra-cloud-package/shared/subdomain-generator.ts
// Must produce identical output for the same document ID.

const ADJECTIVES = [
  'bright',
  'calm',
  'cool',
  'crisp',
  'bold',
  'eager',
  'fair',
  'fast',
  'glad',
  'happy',
  'keen',
  'kind',
  'lush',
  'mild',
  'neat',
  'nice',
  'pure',
  'rare',
  'safe',
  'slim',
  'soft',
  'sure',
  'tall',
  'true',
  'vast',
  'warm',
  'wise',
  'blue',
  'gold',
  'jade',
  'ruby',
  'sage',
  'teal',
  'wild',
  'zesty',
  'amber',
  'brave',
  'clear',
  'deep',
  'fresh',
  'green',
  'ivory',
  'light',
  'noble',
  'prime',
  'rapid',
  'sharp',
  'swift',
  'vivid',
  'coral',
]

const ANIMALS = [
  'bear',
  'bird',
  'bull',
  'colt',
  'crab',
  'crow',
  'deer',
  'dove',
  'duck',
  'fawn',
  'fish',
  'frog',
  'goat',
  'hawk',
  'hare',
  'ibis',
  'kite',
  'lamb',
  'lark',
  'lion',
  'lynx',
  'mole',
  'moth',
  'newt',
  'orca',
  'puma',
  'quail',
  'robin',
  'seal',
  'slug',
  'swan',
  'toad',
  'vole',
  'wasp',
  'wolf',
  'wren',
  'yak',
  'ant',
  'bat',
  'bee',
  'cat',
  'cod',
  'cow',
  'dog',
  'eel',
  'elk',
  'emu',
  'fox',
  'gnu',
  'hen',
]

function hashUUID(uuid: string): number {
  let hash = 0
  const clean = uuid.replace(/-/g, '')
  for (let i = 0; i < clean.length; i++) {
    const char = clean.charCodeAt(i)
    hash = ((hash << 5) - hash + char) | 0
  }
  return Math.abs(hash)
}

export function generateSubdomain(documentId: string): string {
  const hash = hashUUID(documentId)
  const adjective = ADJECTIVES[hash % ADJECTIVES.length]
  const animal = ANIMALS[Math.floor(hash / ADJECTIVES.length) % ANIMALS.length]
  // Unique, collision-proof suffix: the first 8 hex chars of the id (the same
  // fragment gitops appends for the namespace). Replaces the old `hash % 100`,
  // whose ~5k-combo space collided after ~80 envs and produced duplicate
  // ingress hosts (the host uses the bare subdomain).
  const shortId = documentId.replace(/-/g, '').slice(0, 8).toLowerCase()
  return `${adjective}-${animal}-${shortId}`
}
