import { Container, Eyebrow } from '../components/section-heading'

const WORKFLOW = `on: push
permissions:
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - uses: powerhouse-inc/vetra-deploy-action@v1
        with:
          app-id: \${{ vars.VETRA_APP_ID }}`

export function HomeRepoDeploy() {
  return (
    <section>
      <Container className="flex flex-wrap items-center gap-12 pb-24">
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <Eyebrow>{'// for teams who prefer code'}</Eyebrow>
          <h2 className="text-[clamp(30px,3.5vw,44px)] leading-[1.05] font-bold tracking-[-0.035em]">
            Studio is optional. Your repo is the source of truth.
          </h2>
          <p className="text-console-muted text-lg leading-relaxed">
            Clone what Studio wrote, keep editing in your IDE, and let the action ship it.
          </p>
        </div>
        <div className="border-console-line-strong bg-console-surface min-w-0 flex-[1_1_520px] overflow-hidden rounded-2xl border">
          <p className="border-console-line font-console-mono text-console-faint border-b px-4 py-2.5 text-xs">
            .github/workflows/deploy.yml
          </p>
          <pre className="font-console-mono m-0 overflow-x-auto p-4 text-[13px] leading-relaxed text-[#c5cdca]">
            {WORKFLOW}
          </pre>
        </div>
      </Container>
    </section>
  )
}
