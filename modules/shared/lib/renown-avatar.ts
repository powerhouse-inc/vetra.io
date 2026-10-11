import { renownMediaUrl } from '@/modules/apps/lib/app-profile/renown'
import { renownSwitchboardUrl } from '@/modules/shared/config/renown'

/** The avatar fields of a Renown profile (renownUsers row). */
export interface RenownAvatarProfile {
  documentId?: string | null
  /** `attachment://v1:<sha256>` of an avatar uploaded on renown.id. */
  avatar?: string | null
  /** Legacy external image URL. */
  userImage?: string | null
}

/** Only images a page can safely load: http(s) URLs and inline raster images (as renown.id). */
export function isSafeImageUrl(url: string | null | undefined): url is string {
  return !!url && (/^https?:\/\//i.test(url) || /^data:image\/(png|jpeg|webp|gif);/i.test(url))
}

/**
 * The best image for a Renown user, in renown.id's order: the uploaded avatar
 * (versioned /media URL on Renown's site), else a safe userImage, else a safe
 * ENS avatar. Null means "show the fallback".
 */
export function resolveAvatarUrl({
  profile,
  ensAvatarUrl,
}: {
  profile?: RenownAvatarProfile | null
  ensAvatarUrl?: string | null
}): string | null {
  if (profile?.avatar && profile.documentId) {
    return renownMediaUrl(profile.documentId, 'avatar', profile.avatar)
  }
  if (isSafeImageUrl(profile?.userImage)) return profile.userImage
  if (isSafeImageUrl(ensAvatarUrl)) return ensAvatarUrl
  return null
}

const AVATAR_QUERY = `query VetraRenownAvatar($input: RenownUsersInput!) {
  renownUsers(input: $input) { documentId avatar userImage }
}`

/**
 * Reads the avatar fields of `address`'s Renown profile from the Renown
 * switchboard (the SDK's own profile query never selects `avatar`). Null when
 * the address has no profile; throws when the switchboard can't answer.
 */
export async function fetchRenownAvatarProfile(
  address: string,
  {
    endpoint = renownSwitchboardUrl(),
    fetchImpl = fetch,
  }: { endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<RenownAvatarProfile | null> {
  const lower = address.toLowerCase()
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: AVATAR_QUERY,
      variables: { input: { driveId: `renown-${lower}`, ethAddresses: [lower] } },
    }),
  })
  if (!response.ok) throw new Error(`Renown profile lookup failed (${response.status})`)
  const body = (await response.json()) as {
    data?: { renownUsers?: RenownAvatarProfile[] | null } | null
    errors?: { message: string }[]
  }
  if (body.errors?.length || !body.data?.renownUsers) {
    throw new Error(body.errors?.[0]?.message ?? 'Renown profile lookup failed')
  }
  const row = body.data.renownUsers[0]
  return row
    ? {
        documentId: row.documentId ?? null,
        avatar: row.avatar ?? null,
        userImage: row.userImage ?? null,
      }
    : null
}
