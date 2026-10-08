import type { CloudResourceSize } from '@/modules/cloud/types'
import type {
  PublisherTemplate,
  PublisherTemplateService,
  SetTemplateDetailsInput,
  TemplateMode,
} from '../types'
import { channelLabel } from './artifacts'

// Mirrors TemplateServiceType in the vetra-app document model. Anything else is
// rejected by input validation with a schema error a publisher cannot act on.
export const SERVICE_TYPES = [
  { value: 'CONNECT', label: 'Connect — the document app' },
  { value: 'SWITCHBOARD', label: 'Switchboard — the API' },
  { value: 'FUSION', label: 'Your app image' },
  { value: 'DOCLING', label: 'Docling — document parsing' },
  { value: 'PAPERLESS', label: 'Paperless — document archive' },
  { value: 'SPECKLE', label: 'Speckle — 3D models' },
  { value: 'CLINT', label: 'Clint — not available yet' },
] as const

export const NOT_PROVISIONABLE = new Set<string>(['CLINT'])

export const SIZES: { value: CloudResourceSize; label: string }[] = [
  { value: 'VETRA_AGENT_S', label: 'Small' },
  { value: 'VETRA_AGENT_M', label: 'Medium' },
  { value: 'VETRA_AGENT_L', label: 'Large' },
  { value: 'VETRA_AGENT_XL', label: 'Extra large' },
  { value: 'VETRA_AGENT_XXL', label: 'Double extra large' },
]

/** "Connect", "Your app image": the part of the picker label before the dash. */
export function serviceLabel(type: string): string {
  const full = SERVICE_TYPES.find((t) => t.value === type)?.label
  return full ? full.split(' — ')[0] : type
}

/** "vault-app at kv, following latest release". */
export function describeService(s: PublisherTemplateService): string {
  const where = s.prefix ? ` at ${s.prefix}` : ''
  if (!s.artifactName) return `${serviceLabel(s.type)}${where}`
  const follows = s.artifactChannel ? `, following ${channelLabel(s.artifactChannel).toLowerCase()}` : ''
  return `${s.artifactName}${where}${follows}`
}

/** The whole template as one sentence, so a publisher can check it at a glance. */
export function describeTemplate(t: PublisherTemplate, sharedEnvironmentName?: string | null): string {
  if (t.mode === 'SHARED') {
    return t.sharedEnvironment
      ? `Owners get an account on ${sharedEnvironmentName ? `the ${sharedEnvironmentName} environment` : 'one shared environment'}.`
      : 'Owners get an account on your App Environment.'
  }
  if (t.services.length === 0) return 'Nothing to run yet — add at least one service.'
  const services = t.services.map(describeService).join(', ')
  const packages = t.packages
    .map((p) => (p.packageName ? (p.version ? `${p.packageName}@${p.version}` : p.packageName) : null))
    .filter((x): x is string => x !== null)
  const withPackages = packages.length > 0 ? `, with ${packages.join(' and ')} installed` : ''
  return `Each owner gets ${services}${withPackages}.`
}

export type TemplateForm = {
  name: string
  mode: TemplateMode
  /** '' = the App Environment. */
  sharedEnvironment: string
  /** '' = the default size. */
  size: string
  baseDomain: string
  packageRegistry: string
}

export function templateToForm(t: PublisherTemplate): TemplateForm {
  return {
    name: t.name ?? '',
    mode: t.mode,
    sharedEnvironment: t.sharedEnvironment ?? '',
    size: t.size ?? '',
    baseDomain: t.baseDomain ?? '',
    packageRegistry: t.packageRegistry ?? '',
  }
}

const orNull = (v: string): string | null => v.trim() || null

/**
 * The full set of fields. The server reads an omitted field as unchanged and an
 * explicit null as "clear", so an emptied field must travel as null.
 */
export function templateDetailsInput(
  templateId: string,
  f: TemplateForm,
): Omit<SetTemplateDetailsInput, 'appId'> {
  return {
    templateId,
    name: orNull(f.name),
    mode: f.mode,
    sharedEnvironment: f.mode === 'SHARED' ? orNull(f.sharedEnvironment) : null,
    size: orNull(f.size),
    baseDomain: orNull(f.baseDomain),
    packageRegistry: orNull(f.packageRegistry),
  }
}

export function isTemplateFormDirty(t: PublisherTemplate, f: TemplateForm): boolean {
  const next = templateDetailsInput(t.id, f)
  const current = templateDetailsInput(t.id, templateToForm(t))
  return (Object.keys(next) as Array<keyof typeof next>).some((k) => next[k] !== current[k])
}

/** The reducer refuses SHARED while services or packages exist; say so before trying. */
export function sharedModeBlocker(t: PublisherTemplate): string | null {
  return t.services.length > 0 || t.packages.length > 0
    ? 'Shared templates run nothing per owner. Remove its services and packages first.'
    : null
}
