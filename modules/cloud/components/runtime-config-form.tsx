'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Info, KeyRound, Layers, Package as PackageIcon, Tag, Trash2 } from 'lucide-react'
import { useEffect, useImperativeHandle, useMemo, forwardRef } from 'react'
import { useFieldArray, useForm, type Path, type UseFormReturn } from 'react-hook-form'

import { DEFAULT_CONNECT_CONFIG, isOverridden } from '@/modules/cloud/runtime-config/defaults'
import {
  connectRuntimeConfigSchema,
  type ConnectRuntimeConfigFormValues,
} from '@/modules/cloud/runtime-config/schema'
import type { PHConnectRuntimeConfig } from '@/modules/cloud/runtime-config/types'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/modules/shared/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/modules/shared/components/ui/form'
import { Input } from '@/modules/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import { Switch } from '@/modules/shared/components/ui/switch'
import { cn } from '@/shared/lib/utils'

export type RuntimeConfigFormHandle = {
  getValues: () => ConnectRuntimeConfigFormValues
  setValues: (values: ConnectRuntimeConfigFormValues) => void
  isValid: () => boolean
}

type Props = {
  /** Current overrides (subset of config — undefined fields fall back to defaults). */
  overrides: PHConnectRuntimeConfig
  /** Called on every edit with the latest overrides (after pruning equal-to-default fields). */
  onChange: (overrides: PHConnectRuntimeConfig) => void
  disabled?: boolean
}

/**
 * Schema-grouped form view of the runtime config. Each top-level section
 * (Branding, App, Packages, Drives, Renown) is its own Card to match the
 * vetra.to design language (env-settings-drawer, auto-update-card).
 *
 * Overridden fields are rendered with a medium-weight label; defaults stay
 * muted. A single global "Reset to defaults" lives in the drawer header —
 * there are no per-field reset affordances.
 */
export const RuntimeConfigForm = forwardRef<RuntimeConfigFormHandle, Props>(
  function RuntimeConfigForm({ overrides, onChange, disabled }, ref) {
    const formValues = useMemo(() => buildFormValues(overrides), [overrides])

    const form = useForm<ConnectRuntimeConfigFormValues>({
      resolver: zodResolver(connectRuntimeConfigSchema),
      values: formValues,
      mode: 'onChange',
      disabled,
    })

    useImperativeHandle(
      ref,
      () => ({
        getValues: () => form.getValues(),
        setValues: (v) => form.reset(v),
        isValid: () => form.formState.isValid,
      }),
      [form],
    )

    useEffect(() => {
      const sub = form.watch((value) => {
        onChange(pruneToOverrides(value as ConnectRuntimeConfigFormValues))
      })
      return () => sub.unsubscribe()
    }, [form, onChange])

    return (
      <Form {...form}>
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <BrandingSection form={form} overrides={overrides} />
          <AppSection form={form} overrides={overrides} />
          <PackagesSection form={form} overrides={overrides} />
          <DrivesSection form={form} overrides={overrides} />
          <RenownSection form={form} overrides={overrides} />
        </form>
      </Form>
    )
  },
)

// ----- Section wrappers --------------------------------------------------

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="text-muted-foreground h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">{children}</CardContent>
    </Card>
  )
}

type SectionProps = {
  form: UseFormReturn<ConnectRuntimeConfigFormValues>
  overrides: PHConnectRuntimeConfig
}

function BrandingSection({ form, overrides }: SectionProps) {
  return (
    <SectionCard
      icon={Tag}
      title="Branding"
      description="App name shown in the browser tab and home-screen visual branding."
    >
      <TextField
        form={form}
        overrides={overrides}
        path="branding.appName"
        label="App name"
        placeholder={DEFAULT_CONNECT_CONFIG.branding.appName}
      />
      <TextField
        form={form}
        overrides={overrides}
        path="branding.homeBackground"
        label="Home background"
        description="URL of the hero image on the empty home screen. Leave empty for the bundled default."
        placeholder="https://example.com/background.png"
        mono
      />
    </SectionCard>
  )
}

function AppSection({ form, overrides }: SectionProps) {
  return (
    <SectionCard icon={Info} title="App" description="Top-level application behavior.">
      <SelectField
        form={form}
        overrides={overrides}
        path="app.logLevel"
        label="Log level"
        options={['debug', 'info', 'warn', 'error']}
      />
      <TextField
        form={form}
        overrides={overrides}
        path="app.basePath"
        label="Base path"
        placeholder={DEFAULT_CONNECT_CONFIG.app.basePath}
        mono
      />
    </SectionCard>
  )
}

function PackagesSection({ form, overrides }: SectionProps) {
  return (
    <SectionCard
      icon={PackageIcon}
      title="Packages"
      description="Connect package-manager behavior (distinct from the list of installed packages)."
    >
      <SwitchField
        form={form}
        overrides={overrides}
        path="packages.externalEnabled"
        label="External packages enabled"
        description="When off, Connect refuses to load any package that wasn't bundled at build time."
      />
    </SectionCard>
  )
}

function DrivesSection({ form, overrides }: SectionProps) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'drives.defaultDrives',
  })

  return (
    <SectionCard
      icon={Layers}
      title="Drives"
      description="Default-drive and add-drive UI behavior."
    >
      <SwitchField
        form={form}
        overrides={overrides}
        path="drives.allowAddDrive"
        label="Allow add drive (top-level)"
        description="When off, the SPA hides the 'add drive' affordance entirely."
      />

      <SelectField
        form={form}
        overrides={overrides}
        path="drives.preserveStrategy"
        label="Preserve strategy"
        options={['preserve-all', 'preserve-by-url-and-detach']}
        nullable
        nullableLabel="(default — not set)"
      />

      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          Sections
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <SectionToggles
            form={form}
            overrides={overrides}
            basePath="drives.sections.remote"
            label="Remote"
            sublabel="public + cloud drives"
          />
          <SectionToggles
            form={form}
            overrides={overrides}
            basePath="drives.sections.local"
            label="Local"
            sublabel="browser-local drives"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Default drives
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={form.formState.disabled}
            onClick={() => append({ url: '', name: null, icon: null })}
          >
            Add drive
          </Button>
        </div>
        {fields.length === 0 ? (
          <p className="text-muted-foreground text-xs">No default drives configured.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((f, i) => (
              <div key={f.id} className="bg-muted/30 flex items-start gap-2 rounded-md border p-2">
                <div className="flex-1 space-y-1">
                  <Input
                    placeholder="https://drive-url"
                    className="bg-background font-mono text-xs"
                    {...form.register(`drives.defaultDrives.${i}.url` as const)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="Name (optional)"
                      className="bg-background text-xs"
                      {...form.register(`drives.defaultDrives.${i}.name` as const)}
                    />
                    <Input
                      placeholder="Icon URL (optional)"
                      className="bg-background font-mono text-xs"
                      {...form.register(`drives.defaultDrives.${i}.icon` as const)}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={form.formState.disabled}
                  onClick={() => remove(i)}
                  aria-label="Remove drive"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

function SectionToggles({
  form,
  overrides,
  basePath,
  label,
  sublabel,
}: SectionProps & {
  basePath: 'drives.sections.remote' | 'drives.sections.local'
  label: string
  sublabel: string
}) {
  return (
    <div className="bg-muted/30 space-y-2 rounded-md border p-3">
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="text-muted-foreground text-[11px]">{sublabel}</div>
      </div>
      <div className="space-y-1.5">
        <SwitchField
          form={form}
          overrides={overrides}
          path={`${basePath}.enabled` as Path<ConnectRuntimeConfigFormValues>}
          label="Enabled"
          compact
        />
        <SwitchField
          form={form}
          overrides={overrides}
          path={`${basePath}.allowAdd` as Path<ConnectRuntimeConfigFormValues>}
          label="Allow add"
          compact
        />
        <SwitchField
          form={form}
          overrides={overrides}
          path={`${basePath}.allowDelete` as Path<ConnectRuntimeConfigFormValues>}
          label="Allow delete"
          compact
        />
      </div>
    </div>
  )
}

function RenownSection({ form, overrides }: SectionProps) {
  return (
    <SectionCard
      icon={KeyRound}
      title="Renown"
      description="Identity service used for authentication."
    >
      <TextField
        form={form}
        overrides={overrides}
        path="renown.url"
        label="URL"
        placeholder={DEFAULT_CONNECT_CONFIG.renown.url}
        mono
      />
      <TextField
        form={form}
        overrides={overrides}
        path="renown.networkId"
        label="Network ID"
        placeholder={DEFAULT_CONNECT_CONFIG.renown.networkId}
        mono
      />
      <NumberField
        form={form}
        overrides={overrides}
        path="renown.chainId"
        label="Chain ID"
        placeholder={String(DEFAULT_CONNECT_CONFIG.renown.chainId)}
      />
    </SectionCard>
  )
}

// ----- Field shell -------------------------------------------------------
//
// One subtle visual cue distinguishes overridden vs default fields: the
// label flips from muted to foreground when the value differs from the
// default. No badges, no per-field reset — those are noise. Resetting one
// field means clearing it; users do that by editing the value back.

function FieldShell({
  label,
  overridden,
  description,
  children,
  compact,
}: {
  label: string
  overridden: boolean
  description?: string
  children: React.ReactNode
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-2">
        <FormLabel
          className={cn(
            'text-xs font-normal',
            overridden ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </FormLabel>
        <FormControl>{children}</FormControl>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      <FormLabel
        className={cn(
          'text-sm',
          overridden ? 'text-foreground font-medium' : 'text-muted-foreground font-normal',
        )}
      >
        {label}
      </FormLabel>
      {description && <p className="text-muted-foreground text-xs">{description}</p>}
      <FormControl>{children}</FormControl>
      <FormMessage />
    </div>
  )
}

function TextField({
  form,
  overrides,
  path,
  label,
  description,
  placeholder,
  mono,
}: SectionProps & {
  path: Path<ConnectRuntimeConfigFormValues>
  label: string
  description?: string
  placeholder?: string
  mono?: boolean
}) {
  const overridden = isOverriddenPath(overrides, path)
  return (
    <FormField
      control={form.control}
      name={path}
      render={({ field }) => (
        <FormItem>
          <FieldShell label={label} overridden={overridden} description={description}>
            <Input
              placeholder={placeholder}
              className={mono ? 'font-mono text-sm' : 'text-sm'}
              value={typeof field.value === 'string' ? field.value : ''}
              onChange={(e) => field.onChange(e.target.value || undefined)}
              disabled={form.formState.disabled}
            />
          </FieldShell>
        </FormItem>
      )}
    />
  )
}

function NumberField({
  form,
  overrides,
  path,
  label,
  placeholder,
}: SectionProps & {
  path: Path<ConnectRuntimeConfigFormValues>
  label: string
  placeholder?: string
}) {
  const overridden = isOverriddenPath(overrides, path)
  return (
    <FormField
      control={form.control}
      name={path}
      render={({ field }) => (
        <FormItem>
          <FieldShell label={label} overridden={overridden}>
            <Input
              type="number"
              placeholder={placeholder}
              className="text-sm"
              value={
                typeof field.value === 'number'
                  ? field.value
                  : typeof field.value === 'string'
                    ? field.value
                    : ''
              }
              onChange={(e) => {
                const raw = e.target.value
                if (raw === '') field.onChange(undefined)
                else {
                  const n = Number(raw)
                  field.onChange(Number.isFinite(n) ? n : raw)
                }
              }}
              disabled={form.formState.disabled}
            />
          </FieldShell>
        </FormItem>
      )}
    />
  )
}

function SwitchField({
  form,
  overrides,
  path,
  label,
  description,
  compact,
}: SectionProps & {
  path: Path<ConnectRuntimeConfigFormValues>
  label: string
  description?: string
  compact?: boolean
}) {
  const overridden = isOverriddenPath(overrides, path)
  return (
    <FormField
      control={form.control}
      name={path}
      render={({ field }) => (
        <FormItem>
          <FieldShell
            label={label}
            overridden={overridden}
            description={description}
            compact={compact}
          >
            <Switch
              checked={!!field.value}
              onCheckedChange={(v) => field.onChange(v)}
              disabled={form.formState.disabled}
              aria-label={label}
            />
          </FieldShell>
        </FormItem>
      )}
    />
  )
}

function SelectField({
  form,
  overrides,
  path,
  label,
  options,
  nullable,
  nullableLabel,
}: SectionProps & {
  path: Path<ConnectRuntimeConfigFormValues>
  label: string
  options: readonly string[]
  nullable?: boolean
  nullableLabel?: string
}) {
  const overridden = isOverriddenPath(overrides, path)
  const NULL_TOKEN = '__null__'
  return (
    <FormField
      control={form.control}
      name={path}
      render={({ field }) => (
        <FormItem>
          <FieldShell label={label} overridden={overridden}>
            <Select
              value={
                typeof field.value === 'string' && field.value !== ''
                  ? field.value
                  : nullable
                    ? NULL_TOKEN
                    : ''
              }
              onValueChange={(v) => field.onChange(nullable && v === NULL_TOKEN ? undefined : v)}
              disabled={form.formState.disabled}
            >
              <SelectTrigger className="text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {nullable && (
                  <SelectItem value={NULL_TOKEN}>{nullableLabel ?? '(not set)'}</SelectItem>
                )}
                {options.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldShell>
        </FormItem>
      )}
    />
  )
}

// ----- Helpers -----------------------------------------------------------

/**
 * Build form values for the RHF state. The form always renders against
 * `effective` (defaults + overrides) so every field has a value; we keep
 * the raw `overrides` separately to compute the "default vs override" cue.
 */
function buildFormValues(overrides: PHConnectRuntimeConfig): ConnectRuntimeConfigFormValues {
  return {
    branding: {
      appName: overrides.branding?.appName ?? DEFAULT_CONNECT_CONFIG.branding.appName,
      homeBackground:
        overrides.branding?.homeBackground ?? DEFAULT_CONNECT_CONFIG.branding.homeBackground,
    },
    app: {
      logLevel: overrides.app?.logLevel ?? DEFAULT_CONNECT_CONFIG.app.logLevel,
      basePath: overrides.app?.basePath ?? DEFAULT_CONNECT_CONFIG.app.basePath,
    },
    packages: {
      externalEnabled:
        overrides.packages?.externalEnabled ?? DEFAULT_CONNECT_CONFIG.packages.externalEnabled,
    },
    drives: {
      allowAddDrive: overrides.drives?.allowAddDrive ?? DEFAULT_CONNECT_CONFIG.drives.allowAddDrive,
      defaultDrives: overrides.drives?.defaultDrives ?? DEFAULT_CONNECT_CONFIG.drives.defaultDrives,
      preserveStrategy: overrides.drives?.preserveStrategy,
      sections: {
        remote: {
          enabled:
            overrides.drives?.sections?.remote?.enabled ??
            DEFAULT_CONNECT_CONFIG.drives.sections.remote.enabled,
          allowAdd:
            overrides.drives?.sections?.remote?.allowAdd ??
            DEFAULT_CONNECT_CONFIG.drives.sections.remote.allowAdd,
          allowDelete:
            overrides.drives?.sections?.remote?.allowDelete ??
            DEFAULT_CONNECT_CONFIG.drives.sections.remote.allowDelete,
        },
        local: {
          enabled:
            overrides.drives?.sections?.local?.enabled ??
            DEFAULT_CONNECT_CONFIG.drives.sections.local.enabled,
          allowAdd:
            overrides.drives?.sections?.local?.allowAdd ??
            DEFAULT_CONNECT_CONFIG.drives.sections.local.allowAdd,
          allowDelete:
            overrides.drives?.sections?.local?.allowDelete ??
            DEFAULT_CONNECT_CONFIG.drives.sections.local.allowDelete,
        },
      },
    },
    renown: {
      url: overrides.renown?.url ?? DEFAULT_CONNECT_CONFIG.renown.url,
      networkId: overrides.renown?.networkId ?? DEFAULT_CONNECT_CONFIG.renown.networkId,
      chainId: overrides.renown?.chainId ?? DEFAULT_CONNECT_CONFIG.renown.chainId,
    },
  }
}

/**
 * Convert RHF form values back to a sparse `overrides` object — fields that
 * equal the default are stripped so we don't write trivial overrides.
 */
function pruneToOverrides(values: ConnectRuntimeConfigFormValues): PHConnectRuntimeConfig {
  const out: PHConnectRuntimeConfig = {}

  const branding: PHConnectRuntimeConfig['branding'] = {}
  if (
    values.branding?.appName !== undefined &&
    values.branding.appName !== DEFAULT_CONNECT_CONFIG.branding.appName
  ) {
    branding.appName = values.branding.appName
  }
  // Default is null (bundled image), so any non-empty string is an override;
  // an emptied field falls back to the default rather than writing "".
  const homeBackground = values.branding?.homeBackground
  if (typeof homeBackground === 'string' && homeBackground.length > 0) {
    branding.homeBackground = homeBackground
  }
  if (Object.keys(branding).length > 0) out.branding = branding

  const app: PHConnectRuntimeConfig['app'] = {}
  if (
    values.app?.logLevel !== undefined &&
    values.app.logLevel !== DEFAULT_CONNECT_CONFIG.app.logLevel
  ) {
    app.logLevel = values.app.logLevel
  }
  if (
    values.app?.basePath !== undefined &&
    values.app.basePath !== DEFAULT_CONNECT_CONFIG.app.basePath
  ) {
    app.basePath = values.app.basePath
  }
  if (Object.keys(app).length > 0) out.app = app

  const packages: PHConnectRuntimeConfig['packages'] = {}
  if (
    values.packages?.externalEnabled !== undefined &&
    values.packages.externalEnabled !== DEFAULT_CONNECT_CONFIG.packages.externalEnabled
  ) {
    packages.externalEnabled = values.packages.externalEnabled
  }
  if (Object.keys(packages).length > 0) out.packages = packages

  const drives: PHConnectRuntimeConfig['drives'] = {}
  if (
    values.drives?.allowAddDrive !== undefined &&
    values.drives.allowAddDrive !== DEFAULT_CONNECT_CONFIG.drives.allowAddDrive
  ) {
    drives.allowAddDrive = values.drives.allowAddDrive
  }
  if (values.drives?.defaultDrives && values.drives.defaultDrives.length > 0) {
    drives.defaultDrives = values.drives.defaultDrives.filter(
      (d) => d && typeof d.url === 'string' && d.url.length > 0,
    )
    if (drives.defaultDrives.length === 0) delete drives.defaultDrives
  }
  if (values.drives?.preserveStrategy !== undefined) {
    drives.preserveStrategy = values.drives.preserveStrategy
  }
  const sections: NonNullable<PHConnectRuntimeConfig['drives']>['sections'] = {}
  for (const which of ['remote', 'local'] as const) {
    const s: Partial<{ enabled: boolean; allowAdd: boolean; allowDelete: boolean }> = {}
    const v = values.drives?.sections?.[which]
    const def = DEFAULT_CONNECT_CONFIG.drives.sections[which]
    if (v?.enabled !== undefined && v.enabled !== def.enabled) s.enabled = v.enabled
    if (v?.allowAdd !== undefined && v.allowAdd !== def.allowAdd) s.allowAdd = v.allowAdd
    if (v?.allowDelete !== undefined && v.allowDelete !== def.allowDelete) {
      s.allowDelete = v.allowDelete
    }
    if (Object.keys(s).length > 0) sections[which] = s
  }
  if (Object.keys(sections).length > 0) drives.sections = sections
  if (Object.keys(drives).length > 0) out.drives = drives

  const renown: PHConnectRuntimeConfig['renown'] = {}
  if (values.renown?.url !== undefined && values.renown.url !== DEFAULT_CONNECT_CONFIG.renown.url) {
    renown.url = values.renown.url
  }
  if (
    values.renown?.networkId !== undefined &&
    values.renown.networkId !== DEFAULT_CONNECT_CONFIG.renown.networkId
  ) {
    renown.networkId = values.renown.networkId
  }
  if (
    values.renown?.chainId !== undefined &&
    values.renown.chainId !== DEFAULT_CONNECT_CONFIG.renown.chainId
  ) {
    renown.chainId = values.renown.chainId
  }
  if (Object.keys(renown).length > 0) out.renown = renown

  return out
}

function isOverriddenPath(overrides: PHConnectRuntimeConfig, path: string): boolean {
  return isOverridden(overrides, path.split('.'))
}
