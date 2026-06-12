'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion'

export function CloudLandingFAQ() {
  // Split FAQs into two columns for desktop layout
  const faqs = [
    {
      question: 'What is Vetra Cloud?',
      answer:
        'Vetra Cloud is a comprehensive cloud infrastructure platform that provides scalable environments for AI-ready applications build with Vetra. It offers automated deployment, monitoring, and management tools to help developers focus on building great products instead of managing infrastructure. It relies on open source technologies to avoid vendor lock-in or proprietary dependencies.',
    },
    {
      question: 'How do I get started with Vetra Cloud?',
      answer:
        'Getting started is simple: Create your account, enter Vetra Studio, run through the product development workflow and create a product, deploy the package, and deploy your first application or software product with our one-click deployment process. Our platform automatically handles the infrastructure setup, scaling, and monitoring so you can focus on your business logic.',
    },
    {
      question: 'What are the pricing options?',
      answer:
        'As Vetra is currently in Beta we only offer dedicated access codes for our direct network. We offer flexible pricing tiers to suit different needs, from individual developers to large teams. Our plans include pay-as-you-scale options with transparent pricing for compute, storage, and bandwidth. Contact our team for enterprise pricing and custom solutions.',
    },
    {
      question: 'How secure is Vetra Cloud?',
      answer:
        'Security is our top priority. Although we are currently in a beta phase, we are implementing industry-standard security measures including end-to-end encryption, secure networking, regular security audits, and compliance with SOC 2 and other security frameworks. All data will be encrypted both in transit and at rest.',
    },
    {
      question: 'How does automatic scaling work?',
      answer:
        "Our platform automatically monitors your application's performance and resource usage. When demand increases, we automatically scale your infrastructure up to handle the load. When demand decreases, we scale down to optimize costs. This happens seamlessly without any downtime.",
    },
    {
      question: 'What monitoring and analytics are available?',
      answer:
        'Vetra Cloud provides comprehensive monitoring including real-time performance metrics, application logs, error tracking, and custom dashboards. You get insights into response times, resource usage, user activity, and can set up alerts for important events.',
    },
    {
      question: 'Can I self-host Vetra Cloud?',
      answer:
        "Yes! Vetra Cloud is built on open-source technologies and can be self-hosted on your own infrastructure. We will provide comprehensive documentation, Docker images, and deployment guides to help you set up your own instance. This gives you complete control over your data and infrastructure while still benefiting from Vetra's powerful features.",
    },
    {
      question: 'Is it E2EE and does it protect metadata privacy?',
      answer:
        'Vetra Cloud is in the beta phase and will soon implement end-to-end encryption (E2EE) to ensure your data remains secure. We also protect metadata privacy through advanced encryption techniques, ensuring that not only your data content but also information about your data patterns and usage remains private.',
    },
    {
      question: 'What support options are available?',
      answer:
        'We offer multiple support channels including documentation, discord, email support, and priority support for enterprise customers. Our team is committed to helping you succeed with responsive support.',
    },
  ]

  const leftColumn = faqs.slice(0, 5)
  const rightColumn = faqs.slice(5, 10)

  return (
    <section id="faq" className="mx-auto max-w-screen-xl px-6 py-20">
      <h2 className="text-foreground mb-2 text-center text-3xl font-bold">
        Frequently Asked Questions
      </h2>
      <p className="text-foreground-70 mb-12 text-center">
        Everything you need to know about Vetra Cloud.
      </p>

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
  )
}
