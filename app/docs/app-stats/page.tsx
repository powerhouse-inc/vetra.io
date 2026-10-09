import { ArrowRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { CodeBlock } from '@/modules/apps/components/code-block'
import { CURL_SNIPPET, REPORT_USER_STAT_SNIPPET, USAGE_SNIPPET } from '@/modules/docs/report-user-stat-snippet'
import { Button } from '@/modules/shared/components/ui/button'

export const metadata: Metadata = {
  title: 'Report app stats',
  description:
    'Report users’ metric values from your Vetra environments. Renown shows them on your app page and on users’ profiles.',
}

const TOC = [
  { id: 'how-it-works', label: 'How it works' },
  { id: 'declare', label: 'Declare metrics' },
  { id: 'environment', label: 'Environment' },
  { id: 'report', label: 'Report a value' },
  { id: 'semantics', label: 'Semantics' },
  { id: 'helper', label: 'Helper' },
  { id: 'troubleshooting', label: 'Troubleshooting' },
] as const

const AGGREGATIONS: Array<[string, string, string]> = [
  ['Total (SUM)', 'Adds every user’s current value.', 'Notes written by everyone'],
  ['Highest (MAX)', 'The highest current value of any user.', 'Longest streak'],
  ['Average (AVG)', 'The mean of users’ current values.', 'Average score'],
  ['Users (COUNT_USERS)', 'How many users have a value above zero.', 'Users who published'],
]

const MUTATION = `mutation ReportUserStat($user: String!, $metric: String!, $value: Float!) {
  vetraLicensing {
    reportUserStat(user: $user, metric: $metric, value: $value)
  }
}`

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
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
    <div className="border-border overflow-x-auto rounded-xl border">
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
        <tbody className="divide-border divide-y">
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

function Problem({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border-border rounded-xl border p-5">
      <p className="font-medium">{title}</p>
      <div className="text-foreground/80 mt-2 space-y-2 text-sm leading-6">{children}</div>
    </div>
  )
}

export default function AppStatsDocsPage() {
  return (
    <div className="mx-auto mt-16 max-w-screen-xl px-4 py-12 sm:px-6">
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24 space-y-1 text-sm">
            <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">On this page</p>
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
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Report app stats</h1>
            <p className="text-muted-foreground text-lg leading-8">
              Your environments report each user’s current value of the metrics you declare. Renown adds them up and
              shows them on your app’s public page and on every user’s profile.
            </p>
            <Button asChild size="lg">
              <Link href="/user/apps">
                Open your apps
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </header>

          <Section id="how-it-works" title="How it works">
            <P>
              Your package code, running in an environment Vetra provisioned for a licence holder, calls Vetra with the
              environment’s reporting token. Vetra checks the environment, its licence and your app’s Renown identity,
              then forwards the value to Renown as your app. Renown keeps one current value per user and metric.
            </P>
            <P>
              Values show up on <C>renown.id/app/&lt;your app DID&gt;</C> (stat tiles, active users over 30 days, top
              contributors) and in the Stats section of each user’s profile, but only for metrics you declare as public.
            </P>
          </Section>

          <Section id="declare" title="Declare metrics">
            <P>
              Open your app on Vetra, go to the <strong>Profile</strong> tab and add metrics in the{' '}
              <strong>Metrics</strong> section: a label, the key your code reports, an optional unit, how values are
              combined, and whether it is public. Up to 16 metrics. Keys start with a letter and use letters, digits and{' '}
              <C>_ . : -</C> (at most 64 characters).
            </P>
            <DataTable
              head={['Aggregation', 'Shows', 'Example']}
              rows={AGGREGATIONS.map(([name, shows, example]) => [<strong key="n">{name}</strong>, shows, example])}
            />
            <P>
              A key you report but have not declared is stored, but not shown. Declare it later and its history appears.
            </P>
          </Section>

          <Section id="environment" title="Environment">
            <P>Vetra writes two variables into each licensed environment’s secrets:</P>
            <DataTable
              head={['Variable', 'What it is']}
              rows={[
                [
                  <C key="t">VETRA_REPORTING_TOKEN</C>,
                  'This environment’s reporting token. A secret: send it only in the header below, never log it.',
                ],
                [<C key="u">VETRA_LICENSING_URL</C>, 'The endpoint to call, for example https://switchboard.vetra.io/graphql/vetra-licensing.'],
              ]}
            />
            <P>
              The first time Vetra writes them, the environment restarts once to pick them up. Local development has
              neither, and the helper below then sends nothing.
            </P>
          </Section>

          <Section id="report" title="Report a value">
            <P>
              Send the token in the <C>x-vetra-reporting-token</C> header (not <C>Authorization</C>), to{' '}
              <C>VETRA_LICENSING_URL</C> directly:
            </P>
            <CodeBlock code={MUTATION} filename="reportUserStat.graphql" />
            <CodeBlock code={CURL_SNIPPET} filename="shell" />
            <P>
              <C>user</C> is the user’s DID, for example <C>did:pkh:eip155:1:0x…</C>; <C>value</C> is any finite number.
            </P>
          </Section>

          <Section id="semantics" title="Semantics">
            <ul className="text-foreground/80 list-disc space-y-2 pl-5 leading-7">
              <li>Report the current value, not an increment. The newest report per user and metric wins.</li>
              <li>
                Sending the same value again is cheap and keeps the user counted as active (any report in the last 30
                days).
              </li>
              <li>
                <C>true</C> means queued: Renown has it within seconds, and pages refresh within a minute.
              </li>
              <li>
                <C>false</C> means not relayed: the user is not this environment’s licence holder, your app has no usable
                Renown identity (authorize it on the app’s Overview), or Renown refused your app in the last five minutes.
              </li>
              <li>
                Only environments Vetra provisions for a licence can report, and only for their holder. At most 32 metrics
                per user per app, 600 reports per minute per app.
              </li>
            </ul>
          </Section>

          <Section id="helper" title="Helper">
            <P>
              A dependency-free TypeScript file you can copy into your package. It reads the two variables, validates
              the metric and value, and resolves to <C>true</C> when Vetra queued the report.
            </P>
            <CodeBlock code={USAGE_SNIPPET} filename="usage.ts" />
            <CodeBlock code={REPORT_USER_STAT_SNIPPET} filename="report-user-stat.ts" />
          </Section>

          <Section id="troubleshooting" title="Troubleshooting">
            <div className="space-y-3">
              <Problem title="The variables are missing">
                <p>
                  Only environments provisioned for a licence get them, a few at a time; the environment restarts once
                  when they arrive. Wait a minute and check again.
                </p>
              </Problem>
              <Problem title="UNAUTHENTICATED: unknown reporting token">
                <p>
                  The token is from an earlier environment or was replaced. Restart the environment so it reads its
                  current secret.
                </p>
              </Problem>
              <Problem title="The call returns false">
                <p>
                  Report for the environment’s licence holder, and check that your app’s Renown identity is authorized on
                  its Overview. After a refusal Renown pauses your app for five minutes.
                </p>
              </Problem>
              <Problem title="Values arrive but nothing shows">
                <p>
                  Declare the key as a public metric in the app’s Profile tab. Keys are case-sensitive and must match
                  exactly.
                </p>
              </Problem>
            </div>
          </Section>
        </article>
      </div>
    </div>
  )
}
