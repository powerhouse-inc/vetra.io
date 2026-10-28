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
        'border-console-line-strong bg-console-bg text-console-ink overflow-hidden rounded-xl border shadow-sm',
        className,
      )}
    >
      <div className="border-console-line-strong flex items-center justify-between border-b py-1 pr-1 pl-4">
        <span className="text-console-muted flex min-w-0 items-center gap-2 font-mono text-xs">
          <FileCode2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate">{filename ?? 'snippet'}</span>
        </span>
        <CopyButton
          value={code}
          label={filename ? `Copy ${filename}` : 'Copy code'}
          className="text-console-muted hover:bg-console-raised hover:text-console-ink"
        />
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  )
}
