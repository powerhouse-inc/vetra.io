'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { Textarea } from '@/modules/shared/components/ui/textarea'
import { formatTimestamp } from '@/modules/shared/lib/time'

import { describeAppsError } from '../graphql'
import { useHolderInstanceMutations, useMyInstanceSettings } from '../hooks/use-apps'
import {
  DOMAIN_STATUS_LABEL,
  DOMAIN_STEPS,
  SETTING_KIND_LABEL,
  isDomainName,
  isMountPath,
  settingNameProblem,
} from '../lib/holder'
import type { HolderInstance, HolderSettingKind } from '../types'
import { CopyButton } from './copy-button'

const SELECT_CLASS =
  'border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'

function Err({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p role="alert" className="text-destructive text-sm">
      {describeAppsError(error)}
    </p>
  )
}

/** The settings the holder set on their own instance: plain, secret (write-only) and files. */
function HolderSettingsSection({ instanceId }: { instanceId: string }) {
  const settings = useMyInstanceSettings(instanceId)
  const { setSetting, deleteSetting } = useHolderInstanceMutations(instanceId)
  const [kind, setKind] = useState<HolderSettingKind>('PLAIN')
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [mountPath, setMountPath] = useState('')

  const isFile = kind === 'FILE'
  const nameProblem = name ? settingNameProblem(name, settings.data) : null
  const overrides = !!name && !!settings.data?.publisherNames.includes(name)
  const valid =
    value !== '' &&
    (isFile ? isMountPath(mountPath) && (!name || !nameProblem) : !!name && !nameProblem)

  const submit = () =>
    setSetting.mutate(
      {
        kind,
        value,
        ...(name ? { name } : {}),
        ...(isFile ? { mountPath } : {}),
      },
      {
        onSuccess: () => {
          toast.success('Setting saved; your instance restarts with it')
          setName('')
          setValue('')
          setMountPath('')
        },
      },
    )

  return (
    <section aria-label="Settings" className="space-y-3">
      <h3 className="text-sm font-semibold">Settings</h3>
      <p className="text-muted-foreground text-xs">
        Only you see these. Your instance restarts when you change one. Secrets and files cannot be
        read again, only replaced.
      </p>
      {settings.isPending ? (
        <Skeleton className="h-10 w-full" />
      ) : settings.error ? (
        <Err error={settings.error} />
      ) : settings.data.settings.length === 0 ? (
        <p className="text-muted-foreground text-sm">No settings yet.</p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border text-sm">
          {settings.data.settings.map((s) => (
            <li
              key={s.name}
              data-testid={`holder-setting-${s.name}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2"
            >
              <span className="font-mono">{s.name}</span>
              <span className="bg-muted text-muted-foreground rounded px-1 text-[10px] uppercase">
                {SETTING_KIND_LABEL[s.kind]}
              </span>
              {s.kind === 'PLAIN' && s.value !== null && (
                <span className="text-muted-foreground font-mono text-xs break-all">{s.value}</span>
              )}
              {s.kind === 'FILE' && s.mountPath && (
                <span className="text-muted-foreground font-mono text-xs">{s.mountPath}</span>
              )}
              {settings.data.publisherNames.includes(s.name) && (
                <span className="text-warning text-xs">replaces the app&apos;s own value</span>
              )}
              <span className="ml-auto flex gap-1">
                {s.kind !== 'PLAIN' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setKind(s.kind)
                      setName(s.name)
                      setMountPath(s.mountPath ?? '')
                      setValue('')
                    }}
                  >
                    Replace
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${s.name}`}
                  disabled={deleteSetting.isPending}
                  onClick={() =>
                    deleteSetting.mutate(s.name, {
                      onSuccess: () => toast.success('Setting deleted'),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <Err error={deleteSetting.error} />
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) submit()
        }}
      >
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <div className="space-y-1">
            <Label htmlFor={`hs-kind-${instanceId}`}>Kind</Label>
            <select
              id={`hs-kind-${instanceId}`}
              value={kind}
              onChange={(e) => setKind(e.target.value as HolderSettingKind)}
              className={SELECT_CLASS}
            >
              <option value="PLAIN">Plain</option>
              <option value="SECRET">Secret</option>
              <option value="FILE">File</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`hs-name-${instanceId}`}>Name{isFile ? ' (optional)' : ''}</Label>
            <Input
              id={`hs-name-${instanceId}`}
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="MY_SETTING"
              aria-invalid={!!nameProblem}
            />
          </div>
        </div>
        {nameProblem && <p className="text-destructive text-xs">{nameProblem}</p>}
        {overrides && !nameProblem && (
          <p className="text-warning text-xs">
            The app sets {name} itself. Yours replaces its value on your instance.
          </p>
        )}
        {isFile && (
          <div className="space-y-1">
            <Label htmlFor={`hs-path-${instanceId}`}>Mount path</Label>
            <Input
              id={`hs-path-${instanceId}`}
              value={mountPath}
              onChange={(e) => setMountPath(e.target.value)}
              placeholder="/etc/app/config.json"
              aria-invalid={mountPath !== '' && !isMountPath(mountPath)}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor={`hs-value-${instanceId}`}>{isFile ? 'File contents' : 'Value'}</Label>
          {isFile ? (
            <Textarea
              id={`hs-value-${instanceId}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              className="font-mono text-xs"
            />
          ) : (
            <Input
              id={`hs-value-${instanceId}`}
              type={kind === 'SECRET' ? 'password' : 'text'}
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          )}
        </div>
        <Err error={setSetting.error} />
        <Button type="submit" size="sm" disabled={!valid || setSetting.isPending}>
          {setSetting.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save setting
        </Button>
      </form>
    </section>
  )
}

/** The custom domain: the records to create at the DNS provider, and where it stands. */
function HolderDomainSection({ instance }: { instance: HolderInstance }) {
  const { setDomain, removeDomain } = useHolderInstanceMutations(instance.instanceId)
  const [domain, setDomainText] = useState('')
  const current = instance.customDomain ?? null
  const clean = domain.trim().toLowerCase()
  const step = current ? DOMAIN_STEPS.indexOf(current.status) : -1

  return (
    <section aria-label="Domain" className="space-y-3">
      <h3 className="text-sm font-semibold">Custom domain</h3>
      <p className="text-muted-foreground text-xs">
        Applying a domain moves your instance to it: the generated address stops working, and HTTPS
        works once the certificate is issued, which takes a few minutes.
      </p>
      {current ? (
        <div className="space-y-3" data-testid="holder-domain">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm">{current.domain}</span>
            <span className="bg-muted rounded-full px-1.5 py-px text-[10px] font-medium uppercase">
              {DOMAIN_STATUS_LABEL[current.status]}
            </span>
            {current.since && (
              <span className="text-muted-foreground text-xs">
                since {formatTimestamp(current.since)}
              </span>
            )}
          </div>
          {step >= 0 && (
            <ol className="text-muted-foreground flex gap-3 text-xs">
              {DOMAIN_STEPS.map((s, i) => (
                <li key={s} className={i <= step ? 'text-foreground font-medium' : undefined}>
                  {i + 1}. {DOMAIN_STATUS_LABEL[s]}
                </li>
              ))}
            </ol>
          )}
          {current.status === 'FAILED' && current.reason && (
            <p role="alert" className="text-destructive text-sm">
              {current.reason}
            </p>
          )}
          {current.status !== 'ACTIVE' && current.records.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm">Create these records at your DNS provider:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="pr-3 pb-1 font-medium">Type</th>
                      <th className="pr-3 pb-1 font-medium">Host</th>
                      <th className="pr-3 pb-1 font-medium">Value</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {current.records.map((r) => (
                      <tr key={`${r.type}-${r.host}`} data-testid={`dns-${r.type}`}>
                        <td className="py-1 pr-3 font-mono">{r.type}</td>
                        <td className="py-1 pr-3 font-mono break-all">{r.host}</td>
                        <td className="py-1 pr-3 font-mono break-all">{r.value}</td>
                        <td className="py-1">
                          <CopyButton
                            value={r.value}
                            label={`Copy ${r.type} value`}
                            className="h-7 w-7"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {current.alternative && (
                <p className="text-muted-foreground text-xs">
                  Or, instead of the A record, a {current.alternative.type} record:{' '}
                  {current.alternative.host} →{' '}
                  <span className="text-foreground font-mono">{current.alternative.value}</span>
                  <CopyButton
                    value={current.alternative.value}
                    label="Copy alternative value"
                    className="ml-1 h-6 w-6 align-middle"
                  />{' '}
                  (not at an apex domain).
                </p>
              )}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={removeDomain.isPending}
            onClick={() =>
              removeDomain.mutate(undefined, {
                onSuccess: () => toast.success('Custom domain removed'),
              })
            }
          >
            Remove domain
          </Button>
          <Err error={removeDomain.error} />
        </div>
      ) : (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (isDomainName(clean))
              setDomain.mutate(clean, { onSuccess: () => toast.success('Domain set') })
          }}
        >
          <div className="min-w-60 flex-1 space-y-1">
            <Label htmlFor={`domain-${instance.instanceId}`}>Domain</Label>
            <Input
              id={`domain-${instance.instanceId}`}
              value={domain}
              onChange={(e) => setDomainText(e.target.value)}
              placeholder="notes.example.com"
              aria-invalid={clean !== '' && !isDomainName(clean)}
            />
          </div>
          <Button type="submit" disabled={!isDomainName(clean) || setDomain.isPending}>
            {setDomain.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Use this domain
          </Button>
          <div className="basis-full">
            <Err error={setDomain.error} />
          </div>
        </form>
      )}
    </section>
  )
}

/** What a holder manages on their own instance: settings and a custom domain. */
export function HolderInstancePanel({ instance }: { instance: HolderInstance }) {
  return (
    <div
      data-testid={`holder-panel-${instance.instanceId}`}
      className="border-border basis-full space-y-6 border-t pt-4"
    >
      <HolderSettingsSection instanceId={instance.instanceId} />
      <HolderDomainSection instance={instance} />
    </div>
  )
}
