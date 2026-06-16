import type { Metadata } from 'next'
import { LegalDocument } from '@/modules/shared/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Privacy Policy',
}

export default function PrivacyPolicyPage() {
  return <LegalDocument />
}
