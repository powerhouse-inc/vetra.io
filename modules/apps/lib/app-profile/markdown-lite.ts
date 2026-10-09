// The Markdown subset app descriptions may use, parsed to a small AST that is
// rendered as React elements (components/app/markdown-lite.tsx). There is no
// HTML path at all: unknown syntax, raw HTML and unsafe links stay plain text.
// Verbatim copy of renown.id utils/markdown-lite.ts (the public app page renders the same AST).
//
//   # / ## / ###     headings          - item / * item / 1. item / 1) item   lists
//   > quote          quotes            blank line   paragraph break, newline   line break
//   **bold**  *italic*  _italic_  `code`  [label](https://… | http://… | mailto:…)

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'break' }

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }

/** The href a link may render with: absolute http(s) or mailto, else null. */
export function safeHref(raw: string): string | null {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:'
      ? url.href
      : null
  } catch {
    return null
  }
}

const INLINE =
  /`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^()\s]+\)|\*[^*\s][^*\n]*\*|_[^_\s][^_\n]*_/
const LINK = /^\[([^\]\n]+)\]\(([^()\s]+)\)$/

export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  let rest = source
  while (rest.length > 0) {
    const match = INLINE.exec(rest)
    if (!match) {
      out.push({ type: 'text', text: rest })
      break
    }
    if (match.index > 0) out.push({ type: 'text', text: rest.slice(0, match.index) })
    const token = match[0]
    if (token.startsWith('`')) {
      out.push({ type: 'code', text: token.slice(1, -1) })
    } else if (token.startsWith('**')) {
      out.push({ type: 'strong', children: parseInline(token.slice(2, -2)) })
    } else if (token.startsWith('[')) {
      const link = LINK.exec(token)
      const label = link ? link[1] : token
      const href = link ? safeHref(link[2]) : null
      out.push(
        href ? { type: 'link', href, children: parseInline(label) } : { type: 'text', text: label },
      )
    } else {
      out.push({ type: 'em', children: parseInline(token.slice(1, -1)) })
    }
    rest = rest.slice(match.index + token.length)
  }
  return out
}

const HEADING = /^(#{1,3})\s+(.+)$/
const BULLET = /^\s*[-*]\s+(.+)$/
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.+)$/
const QUOTE = /^>\s?(.*)$/

function isSpecial(line: string): boolean {
  return HEADING.test(line) || BULLET.test(line) || NUMBERED.test(line) || QUOTE.test(line)
}

/** Lines joined by line breaks. */
function withBreaks(lines: string[]): Inline[] {
  const out: Inline[] = []
  lines.forEach((line, i) => {
    if (i > 0) out.push({ type: 'break' })
    out.push(...parseInline(line))
  })
  return out
}

export function parseMarkdownLite(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.trim() === '') {
      i++
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      const hashes = heading[1].length
      blocks.push({
        type: 'heading',
        level: hashes === 1 ? 1 : hashes === 2 ? 2 : 3,
        children: parseInline(heading[2].trim()),
      })
      i++
      continue
    }
    const ordered = NUMBERED.test(line)
    if (ordered || BULLET.test(line)) {
      const pattern = ordered ? NUMBERED : BULLET
      const items: Inline[][] = []
      for (;;) {
        const item = i < lines.length ? pattern.exec(lines[i]) : null
        if (!item) break
        items.push(parseInline(item[1].trim()))
        i++
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    if (QUOTE.test(line)) {
      const quoted: string[] = []
      for (;;) {
        const quote = i < lines.length ? QUOTE.exec(lines[i]) : null
        if (!quote) break
        quoted.push(quote[1].trim())
        i++
      }
      blocks.push({ type: 'quote', children: withBreaks(quoted) })
      continue
    }
    const paragraph: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isSpecial(lines[i])) {
      paragraph.push(lines[i].trim())
      i++
    }
    blocks.push({ type: 'paragraph', children: withBreaks(paragraph) })
  }
  return blocks
}
