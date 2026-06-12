'use client'
import { useCallback } from 'react'
import { driveCreateDocument } from '@powerhousedao/shared/document-drive'
import { client } from '@/modules/cloud/client'
import { teamDriveFor } from '@/modules/cloud/drive-context'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { generateId } from './builder-team-actions'
import { createNewBuilderTeamController } from './builder-team-controller'
import { fetchBuilderTeamBySlug } from './create-team-queries'

export type CreateTeamForm = {
  name: string
  slug: string
  description: string
  profileLogo: string
  profileSocialsX: string
  profileSocialsGithub: string
  profileSocialsWebsite: string
  members: { address: string }[]
}

// Build a powerhouse/document-drive document with a deterministic id so the
// per-team drive lives at `team:<slug>` rather than the random uuid that
// `driveCreateDocument` would otherwise assign. The reactor-browser
// `addDrive()` helper can't be used here — it depends on
// `window.ph.reactorClient` which vetra.to never initialises (vetra.to talks
// to the remote switchboard via GraphQL, not via a browser-resident
// reactor), and it silently drops the id/slug arguments anyway.
function buildTeamDriveDocument(args: { id: string; slug: string; name: string }): Record<string, unknown> {
  const doc = driveCreateDocument({
    global: { name: args.name, icon: null, nodes: [] },
  })
  doc.header.id = args.id
  doc.header.name = args.name
  // `slug` is a top-level document field in the reactor GraphQL schema (not
  // inside `header`). Spreading it at the root ensures the switchboard
  // registers the drive with the correct slug.
  return { ...(doc as unknown as Record<string, unknown>), slug: args.slug }
}

// Poll until the relational-DB read model reflects the newly created team.
// Returns true if found within the timeout, false if the processor is still
// catching up (the team was created successfully either way).
async function waitForSlug(slug: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const team = await fetchBuilderTeamBySlug(slug)
      if (team) return true
    } catch {
      // ignore transient errors and keep polling
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

export function useCreateTeam() {
  const { signer } = useCanSign()

  const createTeam = useCallback(
    async (form: CreateTeamForm): Promise<{ documentId: string; indexed: boolean }> => {
      if (!signer) {
        throw new Error('You must be logged in with Renown to create a team')
      }
      const creatorAddress = signer.user?.address
      if (!creatorAddress) {
        throw new Error('Signer has no user address')
      }

      // Create the per-team drive (`team:<slug>`) on the remote first. The
      // controller's signed batch below writes the BuilderTeam document
      // into that drive via `parentIdentifier`. Idempotent: a duplicate
      // create on an existing drive is treated as a no-op.
      const driveId = teamDriveFor(form.slug)
      const driveDocument = buildTeamDriveDocument({
        id: driveId,
        slug: form.slug,
        name: form.name,
      })
      try {
        await client.CreateDocument({ document: driveDocument })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (!/already exists/i.test(message)) {
          throw err
        }
      }

      const controller = createNewBuilderTeamController({
        parentIdentifier: driveId,
        signer,
      })
      // Profile fields
      controller.setTeamName({ name: form.name })
      controller.setSlug({ slug: form.slug })
      if (form.description) controller.setDescription({ description: form.description })
      if (form.profileLogo) controller.setLogo({ logo: form.profileLogo })
      if (form.profileSocialsX || form.profileSocialsGithub || form.profileSocialsWebsite) {
        controller.setSocials({
          xProfile: form.profileSocialsX || undefined,
          github: form.profileSocialsGithub || undefined,
          website: form.profileSocialsWebsite || undefined,
        })
      }
      // Creator first, then invited members.
      const allAddresses = [creatorAddress, ...form.members.map((m) => m.address)]
      for (const address of allAddresses) {
        const id = generateId()
        controller.addMember({ id })
        controller.updateMemberInfo({ id, ethAddress: address.toLowerCase() })
      }

      const result = await controller.push()
      const documentId = result.remoteDocument.id
      // Give the async processor up to 10 s to index the team. The team is
      // created regardless — `indexed: false` just means the page may need to
      // show a "still loading" state instead of instant content.
      const indexed = await waitForSlug(form.slug, 10_000)
      return { documentId, indexed }
    },
    [signer],
  )

  return { createTeam }
}
