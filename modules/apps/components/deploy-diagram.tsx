import {
  Container,
  GitCommitHorizontal,
  Github,
  KeyRound,
  Layers,
  Rocket,
  type LucideIcon,
} from 'lucide-react'

type Node = { icon: LucideIcon; title: string; caption: string; accent?: boolean }

const NODES: Node[] = [
  { icon: GitCommitHorizontal, title: 'git push', caption: 'to main, a tag or a pull request' },
  { icon: Github, title: 'GitHub Action', caption: 'vetra-deploy-action builds your repo' },
  { icon: KeyRound, title: 'Renown token', caption: 'GitHub OIDC exchanged for a 10-min token' },
  { icon: Container, title: 'Registry + Harbor', caption: 'packages published, image pushed' },
  {
    icon: Rocket,
    title: 'Vetra deploy',
    caption: 'deployApp pins the exact versions',
    accent: true,
  },
  { icon: Layers, title: 'Environments', caption: 'production, or the PR preview' },
]

/**
 * The deploy pipeline as numbered tiles that read left-to-right, top-to-bottom
 * (one column on phones). Pure markup: renders on the server, works in both themes.
 */
export function DeployDiagram() {
  return (
    <figure className="bg-card overflow-hidden rounded-2xl border p-4 shadow-sm sm:p-6">
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {NODES.map((node, i) => (
          <li
            key={node.title}
            className={
              node.accent
                ? 'border-primary/50 bg-primary/5 relative flex gap-3 rounded-xl border p-4'
                : 'bg-background relative flex gap-3 rounded-xl border p-4'
            }
          >
            <span
              className={
                node.accent
                  ? 'bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'
                  : 'bg-foreground text-background flex h-9 w-9 shrink-0 items-center justify-center rounded-lg'
              }
            >
              <node.icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-muted-foreground font-mono text-[10px]">0{i + 1}</span>
                <span className="text-sm font-semibold">{node.title}</span>
              </span>
              <span className="text-muted-foreground mt-0.5 block text-xs">{node.caption}</span>
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="text-muted-foreground mt-4 text-xs">
        No long-lived secrets in your repo: the action proves where it runs with GitHub&apos;s OIDC
        token, and Renown only trusts it for the repository and branches your app is linked to.
      </figcaption>
    </figure>
  )
}
