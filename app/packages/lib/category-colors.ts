export interface CategoryStyle {
  border: string
  bg: string
  text: string
  dot: string
  label: string // for filter chip: "text bg border" combined
}

// Dark-mode pattern: mid-shade/15 bg + shade-300 text + mid-shade/30 border
// gives a clearly tinted, readable chip against the dark card surface (#252a34)

const categoryMap: Record<string, CategoryStyle> = {
  projectManagement: {
    border: 'border-t-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-400',
    label:
      'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-500/15 dark:border-blue-500/30',
  },
  analytics: {
    border: 'border-t-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-400',
    label:
      'text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30',
  },
  testing: {
    border: 'border-t-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
    label:
      'text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30',
  },
  peopleCulture: {
    border: 'border-t-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-500/15',
    text: 'text-pink-700 dark:text-pink-300',
    dot: 'bg-pink-400',
    label:
      'text-pink-700 bg-pink-100 border-pink-300 dark:text-pink-300 dark:bg-pink-500/15 dark:border-pink-500/30',
  },
  collaboration: {
    border: 'border-t-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-400',
    label:
      'text-violet-700 bg-violet-100 border-violet-300 dark:text-violet-300 dark:bg-violet-500/15 dark:border-violet-500/30',
  },
  finance: {
    border: 'border-t-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-500/15',
    text: 'text-yellow-700 dark:text-yellow-300',
    dot: 'bg-yellow-400',
    label:
      'text-yellow-700 bg-yellow-100 border-yellow-300 dark:text-yellow-300 dark:bg-yellow-500/15 dark:border-yellow-500/30',
  },
  governance: {
    border: 'border-t-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-500/15',
    text: 'text-cyan-700 dark:text-cyan-300',
    dot: 'bg-cyan-400',
    label:
      'text-cyan-700 bg-cyan-100 border-cyan-300 dark:text-cyan-300 dark:bg-cyan-500/15 dark:border-cyan-500/30',
  },
  legal: {
    border: 'border-t-purple-400',
    bg: 'bg-purple-100 dark:bg-purple-500/15',
    text: 'text-purple-700 dark:text-purple-300',
    dot: 'bg-purple-400',
    label:
      'text-purple-700 bg-purple-100 border-purple-300 dark:text-purple-300 dark:bg-purple-500/15 dark:border-purple-500/30',
  },
  engineering: {
    border: 'border-t-orange-400',
    bg: 'bg-orange-100 dark:bg-orange-500/15',
    text: 'text-orange-700 dark:text-orange-300',
    dot: 'bg-orange-400',
    label:
      'text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-300 dark:bg-orange-500/15 dark:border-orange-500/30',
  },
}

const fallbacks: CategoryStyle[] = [
  {
    border: 'border-t-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-400',
    label:
      'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-300 dark:bg-blue-500/15 dark:border-blue-500/30',
  },
  {
    border: 'border-t-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-400',
    label:
      'text-emerald-700 bg-emerald-100 border-emerald-300 dark:text-emerald-300 dark:bg-emerald-500/15 dark:border-emerald-500/30',
  },
  {
    border: 'border-t-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-400',
    label:
      'text-amber-700 bg-amber-100 border-amber-300 dark:text-amber-300 dark:bg-amber-500/15 dark:border-amber-500/30',
  },
  {
    border: 'border-t-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-500/15',
    text: 'text-pink-700 dark:text-pink-300',
    dot: 'bg-pink-400',
    label:
      'text-pink-700 bg-pink-100 border-pink-300 dark:text-pink-300 dark:bg-pink-500/15 dark:border-pink-500/30',
  },
  {
    border: 'border-t-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    text: 'text-violet-700 dark:text-violet-300',
    dot: 'bg-violet-400',
    label:
      'text-violet-700 bg-violet-100 border-violet-300 dark:text-violet-300 dark:bg-violet-500/15 dark:border-violet-500/30',
  },
]

const neutral: CategoryStyle = {
  border: 'border-t-gray-300',
  bg: 'bg-gray-100 dark:bg-gray-500/15',
  text: 'text-gray-600 dark:text-gray-300',
  dot: 'bg-gray-400',
  label:
    'text-gray-600 bg-gray-100 border-gray-300 dark:text-gray-300 dark:bg-gray-500/15 dark:border-gray-500/30',
}

function hashCode(s: string): number {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getCategoryStyle(category: string | undefined) {
  if (!category) return neutral
  const key = category.replace(/[\s_-]+/g, '').replace(/^./, (c) => c.toLowerCase())
  if (categoryMap[key]) return categoryMap[key]
  return fallbacks[hashCode(category) % fallbacks.length]
}

export const publisherLabel =
  'text-gray-600 bg-gray-100 border-gray-300 dark:text-gray-300 dark:bg-gray-500/15 dark:border-gray-500/30'
