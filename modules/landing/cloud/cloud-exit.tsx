import { InstallChip } from '../components/install-chip'
import { Container, SectionHeading } from '../components/section-heading'
import { SELF_HOST_URL } from '../lib/links'

export function CloudExit() {
  return (
    <section className="border-console-line bg-console-bg/70 border-y">
      <Container className="flex flex-wrap items-center gap-12 py-24">
        <div className="min-w-0 flex-[1_1_380px]">
          <SectionHeading
            eyebrow="// the exit door"
            title="Leaving is a feature."
            lead="How we run Vetra Cloud is our job. What runs your app is the open-source Powerhouse platform. Take your packages and a backup, and self-host with Docker or Kubernetes."
          />
        </div>
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-4">
          <p className="font-console-mono text-console-faint text-xs"># 1. install the platform</p>
          <InstallChip />
          <p className="font-console-mono text-console-faint text-xs">
            # 2. restore your backup and packages
          </p>
          <a
            href={SELF_HOST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-console-line-strong hover:bg-console-raised text-console-ink flex min-h-12 items-center justify-between rounded-lg border px-4 text-[15px]"
          >
            Read the self-hosting guide <span aria-hidden>↗</span>
          </a>
        </div>
      </Container>
    </section>
  )
}
