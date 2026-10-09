// Browser upload of a prepared logo or cover through renown-package's gated
// upload route (POST <Renown switchboard>/api/@powerhousedao/renown-package/media/uploads),
// authorised by the signed-in user's Renown bearer — the same route and
// protocol renown.id uses for avatars (identity hub phase 1).
import { sha256Hex, type ImageKind } from './image'
import { renownPackageRoutes, renownSwitchboardOrigin } from './renown'

export class ImageUploadError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ImageUploadError'
  }
}

type ReserveResponse = {
  ref?: string
  deduped?: boolean
  reservationId?: string
  uploadTarget?: { method: 'PUT'; url: string; headers: Record<string, string> } | null
  code?: string
  error?: string
}

/**
 * Uploads `blob` as a `purpose` image and returns its attachment ref.
 * @throws {ImageUploadError} with the route's error code when it refuses.
 */
export async function uploadRenownImage(
  blob: Blob,
  purpose: ImageKind,
  bearer: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const sha256 = await sha256Hex(blob)
  const reserve = await fetchImpl(`${renownPackageRoutes()}/media/uploads`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ purpose, mimeType: blob.type, sizeBytes: blob.size, sha256 }),
  })
  const body = (await reserve.json().catch(() => ({}))) as ReserveResponse
  if (!reserve.ok || !body.ref) {
    throw new ImageUploadError(body.error ?? `Upload refused (${reserve.status})`, body.code)
  }
  if (body.deduped) return body.ref

  // S3: PUT to the presigned target with exactly its headers (it pins the
  // length, type and checksum). A filesystem switchboard (local development)
  // takes the bytes on its own reservation route.
  const put = body.uploadTarget
    ? await fetchImpl(body.uploadTarget.url, { method: 'PUT', headers: body.uploadTarget.headers, body: blob })
    : await fetchImpl(
        `${renownSwitchboardOrigin()}/attachments/reservations/${encodeURIComponent(body.reservationId ?? '')}`,
        {
          method: 'PUT',
          headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/octet-stream' },
          body: blob,
        },
      )
  if (!put.ok) throw new ImageUploadError(`Upload failed (${put.status})`, 'UPLOAD_FAILED')
  return body.ref
}
