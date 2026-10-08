export const CHANNELS = [
  { value: 'LATEST', label: 'Latest release' },
  { value: 'STAGING', label: 'Staging builds' },
  { value: 'DEV', label: 'Dev builds' },
] as const

export type ChannelValue = (typeof CHANNELS)[number]['value']

export function channelLabel(channel: string): string {
  return CHANNELS.find((c) => c.value === channel)?.label ?? channel
}

export function artifactKindLabel(kind: string): string {
  return kind === 'FUSION_IMAGE' ? 'App image' : kind === 'PACKAGE' ? 'Package' : kind
}

export const NO_IMAGES_YET =
  'This app has not published an app image yet. Run the Vetra deploy workflow once, then pick the image here.'

export const NO_PACKAGES_YET =
  'This app has not published a package yet. Run the Vetra deploy workflow once, then pick the package here.'
