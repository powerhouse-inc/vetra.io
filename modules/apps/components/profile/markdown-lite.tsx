import { Fragment, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { parseMarkdownLite, type Block, type Inline } from '../../lib/app-profile/markdown-lite'

function inline(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'text':
        return <Fragment key={i}>{node.text}</Fragment>
      case 'break':
        return <br key={i} />
      case 'code':
        return (
          <code key={i} className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]">
            {node.text}
          </code>
        )
      case 'strong':
        return (
          <strong key={i} className="font-semibold">
            {inline(node.children)}
          </strong>
        )
      case 'em':
        return <em key={i}>{inline(node.children)}</em>
      case 'link':
        return (
          <a
            key={i}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {inline(node.children)}
          </a>
        )
    }
  })
}

function block(node: Block, i: number): ReactNode {
  switch (node.type) {
    case 'heading':
      return (
        <p key={i} className={cn('text-foreground font-semibold', node.level === 1 ? 'text-base' : 'text-sm')}>
          {inline(node.children)}
        </p>
      )
    case 'paragraph':
      return <p key={i}>{inline(node.children)}</p>
    case 'list': {
      const List = node.ordered ? 'ol' : 'ul'
      return (
        <List key={i} className={cn('space-y-1 pl-5', node.ordered ? 'list-decimal' : 'list-disc')}>
          {node.items.map((item, j) => (
            <li key={j}>{inline(item)}</li>
          ))}
        </List>
      )
    }
    case 'quote':
      return (
        <blockquote key={i} className="border-border text-muted-foreground border-l-2 pl-3 italic">
          {inline(node.children)}
        </blockquote>
      )
  }
}

/** A description in Renown's markdown subset, as React elements only (as renown.id renders it). */
export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  return <div className={cn('text-foreground/90 space-y-2 break-words', className)}>{parseMarkdownLite(text).map(block)}</div>
}
