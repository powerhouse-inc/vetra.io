import { CopyButton } from '@/modules/apps/components/copy-button'
import { INSTALL_CMD } from '../lib/links'

export function InstallChip() {
  return (
    <div className="border-console-line-strong bg-console-surface/60 flex min-h-12 w-full max-w-full min-w-0 items-center gap-2 rounded-lg border py-1 pr-1 pl-4 sm:w-auto">
      <span className="text-console-signal font-console-mono text-sm" aria-hidden>
        $
      </span>
      <code className="font-console-mono text-console-ink min-w-0 truncate text-sm">
        {INSTALL_CMD}
      </code>
      <CopyButton value={INSTALL_CMD} label="Copy install command" className="text-console-muted" />
    </div>
  )
}
