import { cn } from '@/shared/lib/utils'

/** Stable 0–359 hue from a string, so an App keeps its colour everywhere. */
export function hueFor(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  return h
}

/** Monogram tile with a deterministic gradient — the App's visual identity. */
export function AppAvatar({
  name,
  seed,
  size = 'md',
  className,
}: {
  name: string
  seed?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const hue = hueFor(seed ?? name)
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-semibold text-white shadow-sm ring-1 ring-black/5 select-none',
        size === 'sm' && 'h-8 w-8 rounded-lg text-sm',
        size === 'md' && 'h-10 w-10 rounded-xl text-base',
        size === 'lg' && 'h-14 w-14 rounded-2xl text-2xl',
        className,
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 75% 40%))`,
      }}
    >
      {initial}
    </span>
  )
}
