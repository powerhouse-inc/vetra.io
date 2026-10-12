import type { ReactNode } from 'react'

/** Product-window chrome for static UI mockups. `label` describes the mockup for screen readers. */
export function WindowFrame({
  title,
  label,
  children,
}: {
  title: string
  label: string
  children: ReactNode
}) {
  return (
    <figure
      role="img"
      aria-label={label}
      className="border-console-line-strong bg-console-surface m-0 overflow-hidden rounded-2xl border shadow-[0_40px_120px_-40px_rgba(59,227,138,0.25)]"
    >
      <div className="border-console-line font-console-mono text-console-faint flex items-center gap-2 border-b px-4 py-3 text-xs">
        <span className="bg-console-line-strong size-2.5 rounded-full" />
        <span className="bg-console-line-strong size-2.5 rounded-full" />
        <span className="bg-console-line-strong size-2.5 rounded-full" />
        <span className="ml-3 truncate">{title}</span>
        <span className="border-console-line-strong ml-auto rounded-md border px-2 py-0.5">⌘K</span>
      </div>
      {children}
    </figure>
  )
}
