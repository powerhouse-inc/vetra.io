import type { ReactNode } from 'react'

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-console-mono text-console-signal text-sm">{children}</p>
}

export function SectionHeading({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string
  title: ReactNode
  lead?: ReactNode
}) {
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="text-[clamp(30px,4vw,52px)] leading-[1.02] font-bold tracking-[-0.04em]">
        {title}
      </h2>
      {lead ? <p className="text-console-muted text-lg leading-relaxed">{lead}</p> : null}
    </div>
  )
}

/** Standard horizontal rhythm for console sections. */
export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-screen-xl px-6 ${className ?? ''}`}>{children}</div>
}
