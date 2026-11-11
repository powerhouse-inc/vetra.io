import { generatedAvatar } from '@/modules/shared/lib/generated-avatar'
import { cn } from '@/modules/shared/lib/utils'

/** renown.id's generated avatar for `seed` (a person's address, an app's DID). */
export function GeneratedAvatar({ seed, className }: { seed: string; className?: string }) {
  const { color, cells } = generatedAvatar(seed)
  return (
    <svg
      viewBox="0 0 5 5"
      role="img"
      aria-label="Generated avatar"
      className={cn('bg-secondary shrink-0', className)}
    >
      {cells.map((on, i) =>
        on ? (
          <rect key={i} x={i % 5} y={Math.floor(i / 5)} width={1} height={1} fill={color} />
        ) : null,
      )}
    </svg>
  )
}
