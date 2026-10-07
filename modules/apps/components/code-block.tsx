import { FileCode2 } from 'lucide-react'

import { cn } from '@/shared/lib/utils'

import { CopyButton } from './copy-button'

/** Terminal-style code panel with a filename bar and copy button. */
export function CodeBlock({
  code,
  filename,
  className,
}: {
  code: string
  filename?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-zinc-800 py-1 pr-1 pl-4">
        <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-zinc-400">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{filename ?? 'snippet'}</span>
        </span>
        <CopyButton
          value={code}
          label={filename ? `Copy ${filename}` : 'Copy code'}
          className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}
