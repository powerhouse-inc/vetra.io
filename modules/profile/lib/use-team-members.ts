'use client'
import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { generateId } from './builder-team-actions'
import { loadBuilderTeamController } from './builder-team-controller'
import type { FullTeam } from './create-team-queries'

export function useTeamMembers(team: FullTeam | null | undefined) {
  const qc = useQueryClient()
  const { signer } = useCanSign()
  const [isPending, setIsPending] = useState(false)

  const inviteMember = useCallback(
    async (ethAddress: string) => {
      if (!team) throw new Error('No team loaded')
      if (!signer) throw new Error('You must be logged in with Renown')
      setIsPending(true)
      try {
        const controller = await loadBuilderTeamController({
          documentId: team.id,
          parentIdentifier: team.sourceDriveId,
          signer,
        })
        const id = generateId()
        controller.addMember({ id })
        controller.updateMemberInfo({ id, ethAddress: ethAddress.toLowerCase() })
        await controller.push()
        await qc.invalidateQueries({ queryKey: ['team-by-slug'] })
      } finally {
        setIsPending(false)
      }
    },
    [team, signer, qc],
  )

  const removeMemberById = useCallback(
    async (memberId: string) => {
      if (!team) throw new Error('No team loaded')
      if (!signer) throw new Error('You must be logged in with Renown')
      setIsPending(true)
      try {
        const controller = await loadBuilderTeamController({
          documentId: team.id,
          parentIdentifier: team.sourceDriveId,
          signer,
        })
        controller.removeMember({ id: memberId })
        await controller.push()
        await qc.invalidateQueries({ queryKey: ['team-by-slug'] })
      } finally {
        setIsPending(false)
      }
    },
    [team, signer, qc],
  )

  return { inviteMember, removeMember: removeMemberById, isPending }
}
