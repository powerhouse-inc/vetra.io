'use client'

import { Lock, Plus, Trash2, Unlock } from 'lucide-react'
import type { CloudServiceEnv } from '@/modules/cloud/types'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'

type Props = {
  value: CloudServiceEnv[]
  onChange: (next: CloudServiceEnv[]) => void
  disabled?: boolean
}

/**
 * Per-row "secret" toggle:
 *   - Lock icon = secret (value will be encrypted at-rest in tenant_secrets,
 *     written via setTenantSecret on submit; the input is masked).
 *   - Unlock icon = plain env var (value is stored in the document; rendered
 *     as a normal env var in the agent pod).
 *
 * For EXISTING secret rows that were loaded from the document (value=null,
 * isSecret=true), the input shows an "encrypted — type to replace" placeholder.
 * Typing a new value queues a setTenantSecret call on submit; leaving the
 * input empty preserves the existing stored value (no DB write needed).
 */
export function EnvVarsEditor({ value, onChange, disabled }: Props) {
  const update = (idx: number, patch: Partial<CloudServiceEnv>) => {
    onChange(value.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }
  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))
  const add = () => onChange([...value, { name: '', value: '', isSecret: false }])
  return (
    <div className="space-y-2">
      {value.map((row, idx) => {
        const isSecret = row.isSecret === true
        const valueStr = row.value ?? ''
        return (
          <div key={idx} className="flex items-center gap-2">
            <Input
              aria-label={`env-name-${idx}`}
              placeholder="NAME"
              value={row.name}
              onChange={(e) => update(idx, { name: e.target.value })}
              disabled={disabled}
              className="font-mono text-sm"
            />
            <Input
              aria-label={`env-value-${idx}`}
              placeholder={
                isSecret && valueStr === ''
                  ? '•••• (encrypted — type to replace)'
                  : 'value'
              }
              value={valueStr}
              onChange={(e) => update(idx, { value: e.target.value })}
              disabled={disabled}
              type={isSecret ? 'password' : 'text'}
              autoComplete={isSecret ? 'new-password' : 'off'}
              className="font-mono text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={isSecret ? `unmark-secret-${idx}` : `mark-secret-${idx}`}
              title={
                isSecret
                  ? 'Currently encrypted. Click to mark as plain (value moves into document state).'
                  : 'Currently plain. Click to mark as secret (value will be encrypted at rest).'
              }
              onClick={() => update(idx, { isSecret: !isSecret })}
              disabled={disabled}
            >
              {isSecret ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="remove env var"
              onClick={() => remove(idx)}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )
      })}
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={add}
        disabled={disabled}
        className="gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" /> Add env var
      </Button>
    </div>
  )
}
