'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/modules/shared/components/ui/accordion'
import { ScrollReveal } from '@/modules/shared/components/ui/scroll-reveal'

const faqs = [
  {
    question: 'What can I do with Vetra?',
    answer:
      'Vetra lets you build software for your team using a simple chat interface — no coding required. Describe the workflow you need (a hiring tracker, a project board, a client portal) and Vetra sets it up. You can also browse ready-made templates and packages from the community and customize them to fit your needs. Everything you build runs on a shared structured data layer that connects your APIs, identity, AI, and the content your team creates every day.',
  },
  {
    question: 'How do I get started?',
    answer: (
      <>
        The fastest way is to head to{' '}
        <a
          href="https://academy.vetra.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Vetra Academy
        </a>{' '}
        for step-by-step guides. You can also sign up with one of our access codes and explore the
        Vetra Studio hands-on — no setup required. Most teams are up and running within an hour.
      </>
    ),
  },
  {
    question: 'Do I need to know how to code?',
    answer:
      "No. Vetra is designed so that anyone on your team can use it through a chat-style interface in the Vetra Studio. Just describe what you need in plain language. If you are a developer, you can also dive into the underlying code and customize everything — but it's completely optional.",
  },
  {
    question: 'Is Vetra open source?',
    answer:
      'Yes, Vetra is fully open source under a copyleft license. Copyleft means that if you modify the code and distribute it, you must share those changes under the same open terms — keeping the ecosystem open for everyone. In practice this means you can inspect every line of code, modify it, and run it on your own servers freely. Unlike most AI tools, the platform itself is open — not just the apps it creates.',
  },
  {
    question: 'How does AI work in Vetra? Can I use my own model?',
    answer:
      'Vetra uses AI agents to help you build, automate, and reason about your work. You can use Vetra\'s built-in AI out of the box. If you prefer to bring your own API key or run a self-hosted open-source model, that support is coming soon — so you stay in control of which model processes your data and what it costs. We believe AI should be a tool you own, not a vendor dependency.',
  },
  {
    question: 'What connects everything inside Vetra?',
    answer:
      'At the core of Vetra is a shared structured data layer. Every workspace, document, and workflow your team creates is stored in an open, typed format that is readable by the API, your identity layer, and AI agents alike. This means your AI assistant can reason over your actual work, your integrations can query it without custom glue code, and your data stays meaningful and portable over time — rather than locked inside a proprietary database schema.',
  },
  {
    question: 'How can I get help?',
    answer: (
      <>
        Join the{' '}
        <a
          href="https://discord.com/invite/pwQJwgaQKd"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Powerhouse Discord
        </a>{' '}
        to chat directly with the team and community. You can also browse guides and tutorials at{' '}
        <a
          href="https://academy.vetra.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Vetra Academy
        </a>
        .
      </>
    ),
  },
  {
    question: 'Can I connect Vetra to other tools?',
    answer:
      'Yes. Vetra is built to work alongside your existing tools. You can build custom integrations and connect it to calendars, databases, external APIs, and more. The platform is designed to be extended, so you can add integrations as your needs grow.',
  },
  {
    question: 'What is Vetra Cloud?',
    answer:
      'Vetra Cloud is our hosted option — we run everything for you so you can focus on building. It handles storage, scaling, and backups automatically. If you prefer, you can also run Vetra on your own servers at any time. We deliberately avoid hyperscaler and big-tech services and run on an independent, open-source infrastructure stack — so your data never ends up enriching platforms with competing interests. You get managed hosting without the lock-in that usually comes with it.',
  },
  {
    question: 'Can I move my data if I decide to leave?',
    answer:
      'Always. Your data is stored in an open structured format and is fully portable. You can export it, self-host it, or move it to another provider at any time. Vetra is built on the principle that sovereign infrastructure means you are never dependent on a single vendor — not for your data, your identity, or your compute.',
  },
  {
    question: 'How can I contribute?',
    answer: (
      <>
        Vetra is open source and welcomes contributions of all kinds — code, documentation, or
        templates. Join the conversation on{' '}
        <a
          href="https://discord.com/invite/pwQJwgaQKd"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Discord
        </a>{' '}
        or explore the codebase on GitHub to get started.
      </>
    ),
  },
  {
    question: 'Does Vetra support blockchain or crypto wallets?',
    answer:
      'Yes. If your team needs it, Vetra supports logging in with a crypto wallet and storing records on the blockchain. This is entirely optional — most teams never need it, but it is there if you do.',
  },
]

const leftColumn = faqs.slice(0, 6)
const rightColumn = faqs.slice(6, 12)

export function FaqSection() {
  return (
    <ScrollReveal>
      <section className="mx-auto max-w-screen-xl px-6 py-20">
        <h2 className="text-foreground mb-2 text-center text-3xl font-bold">
          Frequently Asked Questions
        </h2>
        <p className="text-foreground-70 mb-12 text-center">Everything you need to know.</p>

        <div className="grid gap-12 lg:grid-cols-2">
          <Accordion type="multiple">
            {leftColumn.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`left-${i}`}
                className="border-border/30 border-b-[0.5px] py-2 last:border-b-0"
              >
                <AccordionTrigger className="py-6 text-base">{faq.question}</AccordionTrigger>
                <AccordionContent className="pb-6">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Accordion type="multiple">
            {rightColumn.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`right-${i}`}
                className="border-border/30 border-b-[0.5px] py-2 last:border-b-0"
              >
                <AccordionTrigger className="py-6 text-base">{faq.question}</AccordionTrigger>
                <AccordionContent className="pb-6">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
    </ScrollReveal>
  )
}
