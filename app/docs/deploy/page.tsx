import { ArrowRight, Download, Github } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CodeBlock } from '@/modules/apps/components/code-block'
import { DeployDiagram } from '@/modules/apps/components/deploy-diagram'
import { buildWorkflowYaml, WORKFLOW_PATH } from '@/modules/apps/lib/workflow'
import { Button } from '@/modules/shared/components/ui/button'

export const metadata: Metadata = {
  title: 'Deploy guide',
  description:
    'Connect a GitHub repository to Vetra: push to deploy production, get a preview environment for every pull request.',
}

const ACTION_URL = 'https://github.com/powerhouse-inc/vetra-deploy-action'

const TOC = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'quickstart', label: 'Quickstart' },
  { id: 'workflow', label: 'The workflow' },
  { id: 'monorepos', label: 'Monorepos' },
  { id: 'fusion', label: 'Front-ends (FUSION)' },
  { id: 'versions', label: 'Versions & dist-tags' },
  { id: 'previews', label: 'Preview environments' },
  { id: 'rollback', label: 'Rollback' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
] as const

const INPUTS: Array<[string, string, string]> = [
  ['app-id', 'required', 'Your app id, shown on the app’s Settings tab.'],
  ['package-dirs', '.', 'Directories with a package.json to publish, separated by spaces or new lines. Empty publishes nothing.'],
  ['build-command', 'pnpm build', 'Runs before publishing. Empty skips the build.'],
  ['install-command', 'pnpm install --frozen-lockfile', 'Installs dependencies.'],
  ['production-branch', 'main', 'Pushes to this branch deploy production.'],
  ['fusion-dockerfile', '(empty)', 'Path to a Dockerfile for a Next.js front-end. Empty = no image.'],
  ['fusion-context', '.', 'Docker build context for the front-end image.'],
  ['fusion-image-name', 'app', 'Image name inside your app’s registry project.'],
  ['wait', 'true', 'Wait until the deployment is READY or FAILED.'],
  ['timeout-minutes', '15', 'How long to wait.'],
  ['vetra-url', 'https://switchboard.vetra.io', 'Vetra API.'],
  ['renown-url', 'https://switchboard.renown.vetra.io', 'Renown token exchange.'],
]

const OUTPUTS: Array<[string, string]> = [
  ['deployment-id', 'The deployment created by this run.'],
  ['environment-url', 'The environment page on vetra.io.'],
  ['app-url', 'The deployed front-end or Connect URL.'],
  ['version', 'The package version that was published.'],
]

const MONOREPO_SNIPPET = `      - uses: powerhouse-inc/vetra-deploy-action@v1
        with:
          app-id: <APP_ID>
          package-dirs: |
            packages/document-models
            packages/editors
`

const FUSION_SNIPPET = `      - uses: powerhouse-inc/vetra-deploy-action@v1
        with:
          app-id: <APP_ID>
          fusion-dockerfile: apps/frontend/Dockerfile
          fusion-image-name: frontend
`

const DOCKERFILE = `FROM node:24-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_PUBLIC_SWITCHBOARD_URL=__NEXT_PUBLIC_SWITCHBOARD_URL__ \\
    NEXT_PUBLIC_CONNECT_URL=__NEXT_PUBLIC_CONNECT_URL__ \\
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter frontend build

FROM node:24-alpine
WORKDIR /app
COPY --from=build /repo/apps/frontend/.next/standalone ./
COPY --from=build /repo/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build /repo/apps/frontend/public ./apps/frontend/public
COPY ph-fusion-entrypoint.sh /ph-fusion-entrypoint.sh
USER 1000:1000
ENV FUSION_APP_DIR=/app PORT=3000 HOSTNAME=0.0.0.0 NODE_ENV=production
ENTRYPOINT ["/ph-fusion-entrypoint.sh"]
CMD ["node", "apps/frontend/server.js"]
`

function Section({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <h2 className="text-2xl font-semibold tracking-tight">
        <a href={`#${id}`} className="hover:text-primary">
          {title}
        </a>
      </h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-foreground/80 leading-7">{children}</p>
}

function C({ children }: { children: React.ReactNode }) {
  return <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2.5 font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="text-foreground/80 px-4 py-2.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Steps({ items }: { items: Array<{ title: string; body: React.ReactNode }> }) {
  return (
    <ol className="relative space-y-6 border-l pl-8 border-border">
      {items.map((item, i) => (
        <li key={item.title} className="relative">
          <span className="bg-foreground text-background absolute top-0 -left-[45px] flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
            {i + 1}
          </span>
          <p className="font-medium">{item.title}</p>
          <div className="text-foreground/80 mt-1 leading-7">{item.body}</div>
        </li>
      ))}
    </ol>
  )
}

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border p-5 border-border">
      <p className="font-medium">{title}</p>
      <div className="text-foreground/80 mt-2 space-y-2 text-sm leading-6">{children}</div>
    </div>
  )
}

export default function DeployGuidePage() {
  return (
    <div className="mx-auto mt-16 max-w-screen-xl px-4 py-12 sm:px-6">
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24 space-y-1 text-sm">
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
              On this page
            </p>
            {TOC.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-muted-foreground hover:text-foreground block rounded-md py-1 transition-colors"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="max-w-3xl min-w-0 space-y-14">
          <header className="space-y-5">
            <span className="bg-primary/10 text-primary inline-flex rounded-full px-3 py-1 text-xs font-medium">
              Guide
            </span>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Deploy with Vetra Apps</h1>
            <p className="text-muted-foreground text-lg leading-8">
              Connect a GitHub repository once. Every push to your production branch ships to
              production, and every pull request gets its own preview environment with Connect,
              Switchboard and your front-end.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/user/apps/new">
                  Create an app
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={ACTION_URL} target="_blank" rel="noopener noreferrer">
                  <Github className="h-4 w-4" />
                  vetra-deploy-action
                </a>
              </Button>
            </div>
          </header>

          <Section id="how-it-works" title="How it works">
            <P>
              An <strong>app</strong> links a GitHub repository to a production environment on
              Vetra. A GitHub Action in your repository builds the code, publishes your Powerhouse
              packages and (optionally) a front-end image, then asks Vetra to deploy those exact
              versions.
            </P>
            <DeployDiagram />
          </Section>

          <Section id="quickstart" title="Quickstart">
            <Steps
              items={[
                {
                  title: 'Create an app and connect GitHub',
                  body: (
                    <>
                      On <Link href="/user/apps/new" className="text-primary hover:underline">vetra.io</Link>,
                      install the <strong>Vetra Deploy</strong> GitHub App, pick your repository and
                      choose the production branch. Vetra creates the production environment for
                      you, or attaches one you already have.
                    </>
                  ),
                },
                {
                  title: 'Authorize the deploy identity',
                  body: 'Your app gets its own Renown identity. Approve it on Renown; for the next year GitHub Actions in that repository can deploy on your behalf, and nothing else can. vetra.io reminds you 30 days before it expires.',
                },
                {
                  title: `Add ${WORKFLOW_PATH}`,
                  body: 'Let Vetra open the setup pull request, or copy the workflow below. Merge it.',
                },
                {
                  title: 'Push to main',
                  body: 'The action publishes your packages and deploys production. The run summary links to the live URLs.',
                },
                {
                  title: 'Open a pull request',
                  body: 'A preview environment spins up for the PR and a comment links to it. Closing the PR removes it.',
                },
              ]}
            />
          </Section>

          <Section id="workflow" title="The workflow">
            <P>
              This is the file the setup pull request adds (and the one <C>ph init</C> scaffolds).
              Replace <C>&lt;APP_ID&gt;</C> with the id from your app&apos;s Settings tab; the app
              page shows the snippet with it filled in.
            </P>
            <CodeBlock code={buildWorkflowYaml('<APP_ID>')} filename={WORKFLOW_PATH} />
            <P>
              <C>id-token: write</C> lets the job request a GitHub OIDC token, which Renown exchanges
              for a short-lived deploy token. No secrets need to be stored in the repository.
            </P>
            <h3 className="text-lg font-semibold">Inputs</h3>
            <DataTable
              head={['Input', 'Default', 'Description']}
              rows={INPUTS.map(([name, def, desc]) => [
                <C key="n">{name}</C>,
                <span key="d" className="font-mono text-xs whitespace-nowrap">
                  {def}
                </span>,
                desc,
              ])}
            />
            <h3 className="text-lg font-semibold">Outputs</h3>
            <DataTable
              head={['Output', 'Description']}
              rows={OUTPUTS.map(([name, desc]) => [<C key="n">{name}</C>, desc])}
            />
          </Section>

          <Section id="monorepos" title="Monorepos">
            <P>
              By default the action publishes the package at the repository root. In a monorepo,
              list every package directory to publish with <C>package-dirs</C>. Each one is packed
              with <C>pnpm pack</C>, so <C>workspace:*</C> and <C>catalog:</C> dependencies resolve
              to real versions.
            </P>
            <CodeBlock code={MONOREPO_SNIPPET} filename={WORKFLOW_PATH} />
            <P>
              Every listed package is published by the same run and installed on the environment
              at exactly that version. Set <C>package-dirs</C> to an empty string for a
              front-end-only app.
            </P>
          </Section>

          <Section id="fusion" title="Front-ends (FUSION)">
            <P>
              A FUSION service is a Next.js front-end that runs next to the environment&apos;s
              Connect and Switchboard. Point the action at its Dockerfile: it builds the image,
              pushes <C>cr.vetra.io/&lt;app project&gt;/&lt;image&gt;:sha-&lt;12 hex&gt;</C> to your
              app&apos;s private registry project and deploys that tag.
            </P>
            <CodeBlock code={FUSION_SNIPPET} filename={WORKFLOW_PATH} />
            <h3 className="text-lg font-semibold">Image contract</h3>
            <ul className="text-foreground/80 list-disc space-y-2 pl-5 leading-7">
              <li>
                <C>output: &apos;standalone&apos;</C> in <C>next.config</C>. The server listens on{' '}
                <C>PORT</C> (3000) and <C>/</C> answers 2xx/3xx.
              </li>
              <li>
                Build every <C>NEXT_PUBLIC_*</C> variable with the placeholder value{' '}
                <C>__NEXT_PUBLIC_&lt;NAME&gt;__</C>. One image then serves every environment.
              </li>
              <li>
                Start through{' '}
                <a
                  href="/docs/ph-fusion-entrypoint.sh"
                  download
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  ph-fusion-entrypoint.sh
                  <Download className="h-3.5 w-3.5" aria-hidden />
                </a>{' '}
                (vendor it unchanged). At start it swaps each placeholder for the real value.
              </li>
              <li>Run as uid/gid 1000.</li>
              <li>
                Compare <C>NEXT_PUBLIC_*</C> flags at runtime, not at module scope, and don&apos;t
                call <C>new URL(...)</C> on them at import time: the placeholder is what the build
                sees.
              </li>
            </ul>
            <DataTable
              head={['Variable set by Vetra', 'Value']}
              rows={[
                [<C key="v">NEXT_PUBLIC_SWITCHBOARD_URL</C>, 'The environment’s Switchboard GraphQL URL'],
                [<C key="v">NEXT_PUBLIC_CONNECT_URL</C>, 'The environment’s Connect URL'],
                [<C key="v">NEXT_PUBLIC_RENOWN_URL</C>, 'https://www.renown.id'],
                [<C key="v">NEXT_PUBLIC_BASE_URL</C>, 'The front-end’s own URL'],
              ]}
            />
            <CodeBlock code={DOCKERFILE} filename="apps/frontend/Dockerfile" />
          </Section>

          <Section id="versions" title="Versions & dist-tags">
            <P>
              The action derives the version from <C>version</C> in package.json (without any
              prerelease part) and never commits back to your repository.
            </P>
            <DataTable
              head={['Trigger', 'Version', 'Registry', 'dist-tag', 'Deploys']}
              rows={[
                [
                  'Pull request #42',
                  <C key="v">&lt;base&gt;-pr.42.&lt;sha7&gt;</C>,
                  'registry.dev.vetra.io',
                  <C key="t">pr-42</C>,
                  'Preview',
                ],
                [
                  'Push to main',
                  <C key="v">&lt;base&gt;-main.&lt;run&gt;.&lt;sha7&gt;</C>,
                  'registry.vetra.io',
                  <C key="t">main</C>,
                  'Production',
                ],
                [
                  'Tag v1.4.0',
                  <C key="v">1.4.0</C>,
                  'registry.vetra.io',
                  <C key="t">latest</C>,
                  'Nothing (publish only)',
                ],
              ]}
            />
            <P>
              Pull-request builds can only reach <C>registry.dev.vetra.io</C> and their own preview:
              a PR can never publish to the production registry or deploy production.
            </P>
          </Section>

          <Section id="previews" title="Preview environments">
            <ul className="text-foreground/80 list-disc space-y-2 pl-5 leading-7">
              <li>One environment per open pull request, created on its first deploy.</li>
              <li>
                Slim by design: a small database without backups, the smallest service sizes, and
                packages from <C>registry.dev.vetra.io</C>. Data starts empty.
              </li>
              <li>Deleted when the pull request is closed or merged.</li>
              <li>
                At most <strong>5</strong> per app by default; at the limit the least recently
                deployed preview makes room. Previews idle for <strong>7 days</strong> are removed.
                Both are adjustable in the app&apos;s Settings.
              </li>
              <li>
                <strong>No secrets</strong>: previews get your front-end&apos;s non-secret
                variables only, which is also the safe default for untrusted branches.
              </li>
              <li>
                Pull requests from <strong>forks</strong> don&apos;t get previews: GitHub withholds
                the OIDC token from fork workflows.
              </li>
            </ul>
          </Section>

          <Section id="rollback" title="Rollback">
            <P>
              Open your app&apos;s <strong>Deployments</strong> tab and choose{' '}
              <strong>Rollback</strong> on any earlier successful production deployment. Vetra
              re-applies its exact package versions and image tag as a new deployment. The next
              push to the production branch deploys over it again, so revert the bad commit too.
            </P>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-3">
              <Problem title="“Unable to get ACTIONS_ID_TOKEN_REQUEST_URL” or no OIDC token">
                <p>
                  The job lacks <C>permissions: id-token: write</C>. Add it at the workflow or job
                  level. Fork pull requests never get a token, so they are skipped by the{' '}
                  <C>if:</C> condition in the template.
                </p>
              </Problem>
              <Problem title="Token exchange refused: identity not authorized">
                <p>
                  The app&apos;s deploy identity hasn&apos;t been approved yet. Open the app on
                  vetra.io, choose <strong>Authorize on Renown</strong>, sign, then{' '}
                  <strong>Check again</strong>. The exchange also refuses refs other than the
                  production branch, <C>v*</C> tags and pull requests.
                </p>
              </Problem>
              <Problem title="IDENTITY_EXPIRED: deploy identity expired">
                <p>
                  The Renown authorization of the app&apos;s deploy identity is valid for a year.
                  Once it lapses the action fails with <C>IDENTITY_EXPIRED</C> and CI deploys
                  pause; what is already running keeps running. Open the app on vetra.io, choose{' '}
                  <strong>Re-authorize</strong>, sign on Renown, and re-run the failed workflow.
                  The app page warns you 30 days ahead.
                </p>
              </Problem>
              <Problem title="Publish fails with 403 on the registry">
                <p>
                  Package names on the Vetra registry belong to the Renown address that first
                  published them. The deploy identity publishes as you, so your existing packages
                  keep working; a name owned by another account is rejected. Rename the package
                  (for example under your own scope) or ask its owner to publish it.
                </p>
              </Problem>
              <Problem title="Deployment FAILED or timed out">
                <p>
                  The Deployments tab shows the error, and the Logs link opens the GitHub Actions
                  run. For runtime errors, open the environment page from the app and check the
                  service logs.
                </p>
              </Problem>
            </div>
          </Section>

          <footer className="flex flex-col items-start gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between border-border">
            <p className="text-muted-foreground text-sm">Ready? It takes about two minutes.</p>
            <Button asChild>
              <Link href="/user/apps/new">
                Create an app
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </footer>
        </article>
      </div>
    </div>
  )
}
