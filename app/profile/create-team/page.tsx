'use client'
import { useRenownAuth, usePHToast } from '@powerhousedao/reactor-browser'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useMemo, useState } from 'react'
import { LoginPrompt } from '../components/login-prompt'
import { Stepper, STEPS, type StepKey } from './components/stepper'
import { StepIdentity } from './components/step-identity'
import { StepBrand } from './components/step-brand'
import { StepSocials } from './components/step-socials'
import { StepMembers, type MemberRow } from './components/step-members'
import { SubmitBar } from './components/submit-bar'
import { isValidEthAddress, isValidSlug, isValidUrl } from '@/modules/profile/lib/validations'
import { useCreateTeam, type CreateTeamForm } from '@/modules/profile/lib/use-create-team'
import { useSlugAvailability } from '@/modules/profile/lib/use-slug-availability'

const emptyForm: CreateTeamForm = {
  name: '',
  slug: '',
  description: '',
  profileLogo: '',
  profileSocialsX: '',
  profileSocialsGithub: '',
  profileSocialsWebsite: '',
  members: [{ address: '' }],
}

function CreateTeamInner() {
  const auth = useRenownAuth()
  const router = useRouter()
  const params = useSearchParams()
  const toast = usePHToast()
  const stepParam = params.get('step')
  const stepIdx = Math.max(0, Math.min(STEPS.length - 1, parseInt(stepParam ?? '1', 10) - 1 || 0))
  const activeStep: StepKey = STEPS[stepIdx].key

  const [form, setForm] = useState<CreateTeamForm>(emptyForm)
  const [submitting, setSubmitting] = useState(false)

  const slugStatus = useSlugAvailability(form.slug, isValidSlug(form.slug))

  const goToStep = useCallback(
    (idx: number) => {
      const sp = new URLSearchParams(params.toString())
      sp.set('step', String(idx + 1))
      router.replace(`/profile/create-team?${sp.toString()}`, { scroll: false })
    },
    [params, router],
  )

  const { createTeam } = useCreateTeam()

  const allMembersValid = useMemo(() => {
    const creator = (auth.address ?? '').toLowerCase()
    return form.members.every((m, i) => {
      if (m.address === '') return true
      if (!isValidEthAddress(m.address)) return false
      if (m.address.toLowerCase() === creator) return false
      return !form.members.some(
        (o, j) => j !== i && o.address.toLowerCase() === m.address.toLowerCase(),
      )
    })
  }, [form.members, auth.address])

  const canAdvance = useMemo(() => {
    switch (activeStep) {
      case 'identity':
        return form.name.length > 0 && isValidSlug(form.slug) && slugStatus === 'available'
      case 'brand':
        return true
      case 'socials':
        return (
          isValidUrl(form.profileSocialsX) &&
          isValidUrl(form.profileSocialsGithub) &&
          isValidUrl(form.profileSocialsWebsite)
        )
      case 'members':
        return allMembersValid
    }
  }, [activeStep, form, slugStatus, allMembersValid])

  if (auth.status === 'loading' || auth.status === 'checking') {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }
  if (auth.status !== 'authorized' || !auth.address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoginPrompt onLogin={auth.login} />
      </div>
    )
  }

  const onNext = async () => {
    if (stepIdx < STEPS.length - 1) {
      goToStep(stepIdx + 1)
      return
    }
    setSubmitting(true)
    try {
      const cleaned: CreateTeamForm = {
        ...form,
        members: form.members.filter((m) => m.address !== ''),
      }
      const { indexed } = await createTeam(cleaned)
      toast?.(
        indexed ? 'Team created' : 'Team created — it may take a moment to appear',
        { type: 'success' },
      )
      router.push(`/builders/${form.slug}`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't create team — ${msg}`, { type: 'error' })
      setSubmitting(false)
    }
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Create new team</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Set up your team&apos;s profile and invite your first members.
        </p>
      </div>
      <Stepper active={activeStep} />
      {activeStep === 'identity' && (
        <StepIdentity
          name={form.name}
          slug={form.slug}
          slugStatus={slugStatus}
          onChange={(v) => setForm((f) => ({ ...f, ...v }))}
        />
      )}
      {activeStep === 'brand' && (
        <StepBrand
          name={form.name}
          description={form.description}
          profileLogo={form.profileLogo}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      )}
      {activeStep === 'socials' && (
        <StepSocials
          values={{
            profileSocialsX: form.profileSocialsX,
            profileSocialsGithub: form.profileSocialsGithub,
            profileSocialsWebsite: form.profileSocialsWebsite,
          }}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        />
      )}
      {activeStep === 'members' && (
        <StepMembers
          creator={{
            address: auth.address,
            displayName: auth.displayName,
            displayAddress: auth.displayAddress,
          }}
          members={form.members}
          onChange={(members: MemberRow[]) => setForm((f) => ({ ...f, members }))}
        />
      )}
      <SubmitBar
        canBack={stepIdx > 0}
        canNext={canAdvance}
        isLast={stepIdx === STEPS.length - 1}
        isSubmitting={submitting}
        onBack={() => goToStep(stepIdx - 1)}
        onNext={() => void onNext()}
      />
    </div>
  )
}

export default function CreateTeamPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      }
    >
      <CreateTeamInner />
    </Suspense>
  )
}
