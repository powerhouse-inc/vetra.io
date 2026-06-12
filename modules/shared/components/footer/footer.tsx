import Link from 'next/link'
import VetraLogotype from '@/modules/shared/components/svgs/Vetra-logo-with-text-black.svg'
import { PowerhouseLogoIsotype } from '../svgs'

const footerLinks = {
  product: [
    { label: 'Packages', href: '/packages' },
    { label: 'Builders', href: '/builders' },
    { label: 'Cloud', href: '/cloud' },
  ],
  resources: [
    { label: 'Academy', href: 'https://academy.vetra.io/' },
    {
      label: 'Vetra Studio',
      href: 'https://academy.vetra.io/academy/MasteryTrack/BuilderEnvironment/VetraStudio',
    },
    { label: 'LLM Docs', href: 'https://academy.vetra.io/academy/LLMDocs' },
  ],
  socials: [
    { label: 'Powerhouse on X', href: 'https://x.com/PowerhouseDAO' },
    { label: 'Discord', href: 'https://discord.gg/pwQJwgaQKd' },
  ],
}

function FooterLinkGroup({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h5 className="text-foreground mb-3 text-sm font-semibold">{title}</h5>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              target={link.href.startsWith('http') ? '_blank' : undefined}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="border-border bg-background border-t">
      <div className="mx-auto max-w-screen-xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div>
            <Link href="/">
              <VetraLogotype className="text-foreground h-8" />
            </Link>
            <p className="text-muted-foreground mt-2 text-sm">
              Open by default. Sovereign by design.
            </p>
          </div>
          <FooterLinkGroup title="Product" links={footerLinks.product} />
          <FooterLinkGroup title="Resources" links={footerLinks.resources} />
          <FooterLinkGroup title="Socials" links={footerLinks.socials} />
        </div>
        <div className="border-border mt-8 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <Link
            href="https://powerhouse.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm transition-colors"
          >
            Powered by <PowerhouseLogoIsotype className="size-4" />
          </Link>
          <div className="text-muted-foreground flex gap-6 text-sm">
            <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms-and-conditions" className="hover:text-foreground transition-colors">
              Terms & Conditions
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
