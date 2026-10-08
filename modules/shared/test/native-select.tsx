import React from 'react'

/**
 * Radix Select cannot be driven in happy-dom. Tests replace it with:
 *   vi.mock('@/shared/components/ui/select', () => import('@/modules/shared/test/native-select'))
 * The native <select> takes its accessible name from the SelectTrigger's aria-label.
 */
export const SelectTrigger = (_: { 'aria-label'?: string; className?: string; children?: React.ReactNode }) => null
export const SelectValue = (_: { placeholder?: string }) => null
export const SelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const SelectItem = ({
  value,
  children,
  disabled,
}: {
  value: string
  children: React.ReactNode
  disabled?: boolean
}) => (
  <option value={value} disabled={disabled}>
    {children}
  </option>
)

function findTriggerLabel(node: React.ReactNode): string | undefined {
  for (const child of React.Children.toArray(node)) {
    if (!React.isValidElement(child)) continue
    const el = child as React.ReactElement<{ 'aria-label'?: string; children?: React.ReactNode }>
    if (el.type === SelectTrigger) return el.props['aria-label']
    const inner = findTriggerLabel(el.props.children)
    if (inner) return inner
  }
  return undefined
}

export function Select({
  value,
  onValueChange,
  disabled,
  children,
}: {
  value?: string
  onValueChange?: (v: string) => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <select
      aria-label={findTriggerLabel(children)}
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {children}
    </select>
  )
}
