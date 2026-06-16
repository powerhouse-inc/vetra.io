import type { ReactNode } from 'react'

/**
 * Combined Terms of Service & Privacy Policy draft.
 *
 * Both the "Terms & Conditions" and "Privacy Policy" footer links render this
 * same document for now. Replace the [Placeholder ...] markers and the DRAFT
 * banner once legal sign-off lands.
 */

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-foreground text-xl font-semibold">{title}</h2>
      <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  )
}

export function LegalDocument() {
  return (
    <div className="bg-background min-h-screen px-6 pt-28 pb-16">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-primary text-xs font-semibold tracking-wide uppercase">Draft</p>
          <h1 className="text-foreground text-3xl font-bold">
            Achra / Vetra — Terms of Service &amp; Privacy Policy
          </h1>
          <p className="text-muted-foreground text-sm">Effective Date: [Placeholder Date]</p>
        </header>

        <div className="text-muted-foreground space-y-3 text-sm leading-relaxed">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of the Achra
            website, affiliated websites, applications, services, and digital infrastructure. Achra
            (&ldquo;Achra&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) hosts
            the following domain websites (collectively, the &ldquo;Sites&rdquo;):
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Operational Hub: [Placeholder Link]</li>
            <li>Vetra Developer Platform: [Placeholder Link]</li>
            <li>Business Analysis Intelligence (BAI): [Placeholder Link]</li>
          </ul>
          <p>
            By using the Services, you agree to be bound by these Terms. If you do not want to agree
            to these Terms, you must not access or use the Services.
          </p>
        </div>

        <Section title="1. Achra’s Dual Role and Operating Model">
          <p>
            Achra operates in a dual capacity to provide a comprehensive ecosystem for our users:
          </p>
          <p>
            <strong className="text-foreground">Platform and Marketplace Operator:</strong> Achra
            facilitates access to independent third-party service providers. In this capacity, Achra
            assumes no liability for third-party services, deliverables, or external dispute
            resolution. Marketplace transactions are subject to a 10% commission fee (or as
            otherwise defined in your specific service plan).
          </p>
          <p>
            <strong className="text-foreground">Commercial Vehicle and Direct Provider:</strong>{' '}
            Achra directly holds client relationships and acts as the Offeror for specific
            proprietary services, including Vetra hosting, the Vetra platform, BAI consultancy, and
            specific Operational Hub (OH) products. In this capacity, Achra assumes standard
            merchant liability governed by applicable Service Level Agreements (SLAs) and charges
            fees via subscriptions or fixed pricing.
          </p>
        </Section>

        <Section title="2. Description of Services">
          <p>
            We provide software, platform, and advisory services designed to support the development
            and operation of AI-enabled systems and organizations.
          </p>
          <p>
            <strong className="text-foreground">Operational Hub</strong>
          </p>
          <p>
            This is a turnkey operational platform for builders, networks, and AI-assisted teams. We
            provide software and technical infrastructure to support the setup and operation of
            legal entities. The platform enables clients to access, engage, and contract with
            independent third-party service providers (e.g., legal counsel, accountants, payment
            providers) and to utilize standardized templates for entity setup.
          </p>
          <p>
            <strong className="text-foreground">Important Notice:</strong> All legal, financial, and
            administrative services are performed by third-party providers. Our role is strictly
            limited to providing the platform, tools, and integration layer. This Service does not
            offer direct legal, tax, or statutory accounting advice.
          </p>
          <p>
            <strong className="text-foreground">Business Analysis Intelligence (BAI)</strong>
          </p>
          <p>
            We provide AI data consultancy services focused on evaluating and improving the
            structure, quality, and usability of client data for artificial intelligence
            applications. This includes assessing existing data architectures, identifying gaps, and
            recommending enhancements to data models.
          </p>
          <p>
            <strong className="text-foreground">Vetra Hosting and Developer Platform</strong>
          </p>
          <p>
            We provide a platform for building and operating applications on the Powerhouse /
            Document Model stack. Services include hosting, runtime, registries, identity
            verification, and related infrastructure services.
          </p>
        </Section>

        <Section title="3. Account Creation and Onboarding">
          <p>
            To use our Services, you must complete the required onboarding and compliance steps,
            which may include identity, compliance, or regulatory verification processes (KYC/KYB)
            as required by applicable law.
          </p>
          <p>
            <strong className="text-foreground">Vetra Onboarding:</strong> Users authenticate via
            cryptographic wallet signatures (e.g., Renown) or email registration. Users may access a
            trial account with limited functionality or upgrade to a paid subscription by
            configuring services and entering payment details.
          </p>
          <p>
            <strong className="text-foreground">Operational Hub Onboarding:</strong> Users
            authenticate, access the admin panel, and select a product tier. Operational services
            are charged via an existing subscription framework, which includes a fixed monthly fee
            plus potential overage costs.
          </p>
          <p>
            <strong className="text-foreground">BAI Onboarding:</strong> Users initiate engagement
            via consultation, followed by a customized proposal and service agreement.
          </p>
          <p>
            You are responsible for safeguarding your account credentials. We are not liable for any
            loss or damage arising from your failure to secure your account.
          </p>
        </Section>

        <Section title="4. Eligibility">
          <p>
            You may use the Services only if you have the legal capacity to form a binding contract.
            If acting on behalf of an entity, you warrant that you are authorized to bind that
            entity. You represent and warrant that you:
          </p>
          <ul className="list-disc space-y-1 pl-6">
            <li>
              Are not subject to personal sanctions issued by the UN, US, EU, UK, or Switzerland.
            </li>
            <li>Access the Services for legitimate business purposes only.</li>
            <li>
              Are not accessing the Services from a Prohibited Jurisdiction, including but not
              limited to: Belarus, Cuba, Iran, North Korea, Russia, Syria, or any other countries
              restricted by the Swiss State Secretariat for Economic Affairs (SECO) or applicable
              international bodies.
            </li>
          </ul>
        </Section>

        <Section title="5. Relationship with Third-Party Providers">
          <p>
            Certain specialized professional services are performed by independent third parties. By
            using the Services, you acknowledge:
          </p>
          <p>
            <strong className="text-foreground">Independent Contracting:</strong> You are
            responsible for entering into separate, direct agreements with these specialists.
          </p>
          <p>
            <strong className="text-foreground">No Contractual Party:</strong> We act solely as a
            coordinator and are not a party to these third-party agreements.
          </p>
          <p>
            <strong className="text-foreground">No Liability:</strong> We assume no responsibility
            for the advice, performance, or omissions of third-party providers.
          </p>
        </Section>

        <Section title="6. Your Right to Use the Services">
          <p>
            We grant you a personal, worldwide, royalty-free, non-assignable, and non-exclusive
            right to access and use the Sites provided as part of the Services. Nothing in these
            Terms gives you the right to use our name, logos, or proprietary rights. You agree not
            to misuse our Services, interfere with our technical delivery systems, or use the
            Services for any illegal or fraudulent activities.
          </p>
        </Section>

        <Section title="7. Fees, Payment Flows, and Dispute Resolution">
          <p>
            We reserve the right to charge fees for the use of specific functions of the Services,
            determined by the scope of operations selected during onboarding.
          </p>
          <p>
            <strong className="text-foreground">Subscriptions and Usage:</strong> Fees are collected
            via supported third-party payment providers (e.g., Stripe). You acknowledge that such
            solutions are governed by separate terms and conditions.
          </p>
          <p>
            <strong className="text-foreground">Flow of Funds and Revenue Sharing:</strong>{' '}
            Accounting models, including mandatory revenue sharing to the Operational Hub and
            platform commission fees, are processed automatically. [Placeholder: Specific payment
            flow charts and Stripe dispute resolution mechanics to be detailed in supplemental
            documentation].
          </p>
          <p>
            You maintain ultimate control over your treasury and are responsible for any fees
            associated with external specialists.
          </p>
        </Section>

        <Section title="8. Privacy and Cookie Policy">
          <p>
            This section summarizes our Privacy Policy. For full details, please review our
            comprehensive Privacy Policy at [Placeholder Link].
          </p>
          <p>
            We are committed to protecting your personal and corporate data. We collect, process,
            and use your information (including identity verification data and operational metrics)
            solely to perform the Services, improve user experience, and comply with regulatory
            requirements. We do not disclose personally-identifying information to third parties
            except as necessary to deliver the Services or as required by law.
          </p>
        </Section>

        <Section title="9. Limitations, Release, and Indemnification">
          <p>
            The Services are Available &ldquo;AS IS&rdquo;. Your access to and use of the Services
            is at your own risk. We disclaim all warranties, whether express or implied, of
            merchantability, fitness for a particular purpose, or non-infringement.
          </p>
          <p>
            By using the Services, you agree that our liability is limited to the maximum extent
            permissible by applicable law. You agree to release us from any claims and damages
            arising out of your disputes with independent third-party service providers.
            Furthermore, you agree to indemnify and hold us harmless from any claims, liabilities,
            and expenses (including attorneys&rsquo; fees) arising out of your violation of these
            Terms.
          </p>
        </Section>

        <Section title="10. Termination">
          <p>
            You may end your legal agreement with us at any time by deactivating your accounts and
            discontinuing your use of the Services. We may suspend or terminate your account or
            cease providing you with all or part of the Services at any time if we reasonably
            believe you have violated these Terms, create risk or legal exposure for us, or if the
            provision of Services is no longer commercially viable.
          </p>
        </Section>

        <Section title="11. General Provisions">
          <p>
            <strong className="text-foreground">Modifications:</strong> We may revise these Terms
            from time to time. We will notify you 30 days in advance of any material changes. By
            continuing to use the Services, you agree to be bound by the revised Terms.
          </p>
          <p>
            <strong className="text-foreground">Severability:</strong> If any provision is held
            invalid, the remaining provisions will remain in full force.
          </p>
          <p>
            <strong className="text-foreground">Governing Law &amp; Jurisdiction:</strong> These
            Terms are an agreement between you and Achra Ltd, London, UK. These Terms are governed
            by the laws of the United Kingdom. Any disputes arising under or in connection with
            these Terms are subject to the exclusive jurisdiction of the courts of the City of
            London, UK.
          </p>
          <p>
            <strong className="text-foreground">Contact:</strong> If you have any questions, please
            contact [Placeholder Legal Email Address].
          </p>
        </Section>
      </article>
    </div>
  )
}
