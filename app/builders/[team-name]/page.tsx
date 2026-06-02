import { notFound } from 'next/navigation'

import { BuilderProfile } from '@/modules/builders/components/builder-profile'
import { BuilderProfileTabs } from '@/modules/builders/components/builder-profile-tabs'
import { BuilderSpaces } from '@/modules/builders/components/builder-spaces'
import { TeamMembers } from '@/modules/builders/components/team-members'
import { fetchBuilderTeamBySlug, type BuilderSpace } from '@/modules/builders/lib/server-data'
import { Badge } from '@/modules/shared/components/ui/badge'
import { ANALYTICS_EVENTS, TrackView } from '@/shared/analytics'

// Force dynamic rendering to prevent build-time API requests
export const dynamic = 'force-dynamic'

interface TeamPageProps {
  params: Promise<{
    'team-name': string
  }>
}

export async function generateMetadata({ params }: TeamPageProps): Promise<unknown> {
  try {
    const teamSlug = (await params)['team-name']
    const teamData = await fetchBuilderTeamBySlug(teamSlug)

    if (!teamData) {
      return {
        title: 'Builder Not Found',
        description: 'The requested builder team could not be found.',
      }
    }

    const title = `${teamData.profileName || teamSlug} | Vetra Builder`
    const description =
      teamData.profileDescription ||
      `Explore ${teamData.profileName || teamSlug} builder profile on Vetra.`
    const url = `https://vetra.to/builders/${teamSlug}`
    const ogImage = teamData.profileLogo || 'https://vetra.to/vetra-logo.png'

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: 'Vetra',
        type: 'profile',
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: teamData.profileName || teamSlug,
          },
        ],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: [ogImage],
        site: '@vetra',
        creator: teamData.profileSocialsX,
      },
      alternates: {
        canonical: url,
      },
    }
  } catch {
    // Fallback metadata if fetch fails
    return {
      title: 'Vetra Builder',
      description: 'Explore builder profiles on Vetra.',
    }
  }
}

export default async function TeamPage({ params }: TeamPageProps) {
  const teamSlug = (await params)['team-name']

  // Fetch team data by slug
  const teamData = await fetchBuilderTeamBySlug(teamSlug)

  // If no team data found, show 404
  if (!teamData) {
    notFound()
  }

  // Transform the team data to match the expected format
  const spaces =
    teamData.spaces?.length > 0
      ? teamData.spaces.map((space) => ({
          title: space.title || 'Team Packages',
          description: space.description,
          packages:
            space.packages?.map((pkg) => ({
              title: pkg.name || 'Unknown Package',
              description: pkg.description || 'Package description',
              githubUrl: pkg.githubUrl,
              npmUrl: pkg.npmUrl,
              vetraDriveUrl: pkg.vetraDriveUrl,
            })) || [],
        }))
      : []

  // Transform team members data
  const teamMembers =
    teamData.members?.map((member) => ({
      id: member.id,
      phid: member.phid,
      ethAddress: member.ethAddress,
      name: member.name,
      avatar: member.profileImage,
      role: 'Developer',
      isRenown: !!member.phid, // Show renown link if phid exists
    })) || []

  // Generate industry expertise from package categories
  const industryExpertise = Array.from(
    new Set(
      teamData.spaces
        ?.flatMap(
          (space: BuilderSpace) => space.packages?.map((pkg) => pkg.category).filter(Boolean) || [],
        )
        .filter(Boolean) || [],
    ),
  ).filter((expertise): expertise is string => expertise !== undefined)

  return (
    <main className="container mx-auto mt-20 max-w-screen-xl px-6 py-12">
      <TrackView
        event={ANALYTICS_EVENTS.builderProfileView}
        properties={{ teamSlug, teamName: teamData.profileName }}
      />
      {/* Profile Header */}
      <BuilderProfile
        profileName={teamData.profileName}
        profileLogo={teamData.profileLogo}
        profileDescription={teamData.profileDescription}
        profileSocialsX={teamData.profileSocialsX}
        profileSocialsGithub={teamData.profileSocialsGithub}
        profileSocialsWebsite={teamData.profileSocialsWebsite}
        industryExpertise={industryExpertise}
      />

      {/* Tabbed Content */}
      <div className="mt-10">
        <BuilderProfileTabs
          packagesContent={
            <BuilderSpaces
              spaces={spaces}
              teamName={teamData.profileName || teamSlug}
              discordUrl="https://discord.com/invite/powerhouse"
            />
          }
          teamContent={
            teamMembers.length > 0 ? (
              <TeamMembers members={teamMembers} />
            ) : (
              <p className="text-foreground-70 py-8 text-center">No team members listed yet.</p>
            )
          }
          aboutContent={
            <div className="space-y-6">
              {teamData.profileDescription && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">About {teamData.profileName}</h3>
                  <p className="text-foreground-70 leading-relaxed">
                    {teamData.profileDescription}
                  </p>
                </div>
              )}
              {industryExpertise.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold">Industry Expertise</h3>
                  <div className="flex flex-wrap gap-2">
                    {industryExpertise.map((expertise, index) => (
                      <Badge key={index} className="bg-primary-30 text-primary">
                        {expertise}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          }
        />
      </div>
    </main>
  )
}
