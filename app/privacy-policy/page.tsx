import type { Metadata } from 'next'
import { LegalDocument } from '@/modules/shared/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Vetra collects, uses and protects your personal data.',
}

export default function PrivacyPolicyPage() {
  return <LegalDocument />
}
